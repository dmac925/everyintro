import type { Env } from '../env';
import type { PublicJobRow } from '../../types';
import { all, run } from '../db';
import { upsertVectors, vectorsAvailable } from '../embeddings';

// Public ATS job boards → public_jobs. These are documented public JSON feeds,
// not scraping. Runs once per board per day from the jobs worker's cron.

type NormalisedJob = Omit<PublicJobRow, 'embedded' | 'first_seen_at' | 'last_seen_at'>;

// Rough UK filter on the location string.
// TODO(ingest): "Remote" also catches US-only remote roles — tighten per source.
const UK_LOCATION =
	/(united kingdom|\buk\b|england|scotland|wales|northern ireland|london|manchester|edinburgh|bristol|birmingham|leeds|glasgow|cambridge|oxford|belfast|cardiff|remote)/i;

export async function ingestSource(env: Env, source: string, board: string): Promise<number> {
	const companyRow = await all<{ company_name: string }>(
		env.DB,
		'SELECT company_name FROM job_sources WHERE source = ? AND board = ?',
		source,
		board
	);
	const companyName = companyRow[0]?.company_name ?? board;

	let jobs: NormalisedJob[];
	try {
		jobs = await FETCHERS[source](board, companyName);
	} catch (err) {
		await run(
			env.DB,
			`UPDATE job_sources SET last_fetched_at = datetime('now'), last_error = ? WHERE source = ? AND board = ?`,
			String(err),
			source,
			board
		);
		return 0;
	}
	jobs = jobs.filter((j) => !j.location || UK_LOCATION.test(j.location));

	const upsert = env.DB.prepare(
		`INSERT INTO public_jobs (id, source, board, company_name, title, location, work_mode, url, description_text, salary_min, salary_max)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET title = excluded.title, location = excluded.location,
			work_mode = excluded.work_mode, url = excluded.url, description_text = excluded.description_text,
			salary_min = excluded.salary_min, salary_max = excluded.salary_max, last_seen_at = datetime('now')`
	);
	for (let i = 0; i < jobs.length; i += 50) {
		await env.DB.batch(
			jobs.slice(i, i + 50).map((j) =>
				upsert.bind(j.id, j.source, j.board, j.company_name, j.title, j.location, j.work_mode, j.url, j.description_text, j.salary_min, j.salary_max)
			)
		);
	}
	await run(
		env.DB,
		`UPDATE job_sources SET last_fetched_at = datetime('now'), last_error = NULL WHERE source = ? AND board = ?`,
		source,
		board
	);

	await embedNewJobs(env, source, board);
	return jobs.length;
}

async function embedNewJobs(env: Env, source: string, board: string) {
	if (!vectorsAvailable(env)) return;
	const pending = await all<PublicJobRow>(
		env.DB,
		'SELECT * FROM public_jobs WHERE source = ? AND board = ? AND embedded = 0 LIMIT 100',
		source,
		board
	);
	for (let i = 0; i < pending.length; i += 25) {
		const chunk = pending.slice(i, i + 25);
		await upsertVectors(
			env,
			'job',
			chunk.map((j) => ({ id: j.id, text: `${j.title} at ${j.company_name}\n${j.location ?? ''}\n${(j.description_text ?? '').slice(0, 1500)}` }))
		);
		await run(
			env.DB,
			`UPDATE public_jobs SET embedded = 1 WHERE id IN (SELECT value FROM json_each(?))`,
			JSON.stringify(chunk.map((j) => j.id))
		);
	}
}

// ── Source fetchers ─────────────────────────────────────────────────────────

const FETCHERS: Record<string, (board: string, company: string) => Promise<NormalisedJob[]>> = {
	async greenhouse(board, company) {
		const data = await getJson<{ jobs: { id: number; title: string; absolute_url: string; location?: { name?: string }; content?: string }[] }>(
			`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`
		);
		return data.jobs.map((j) => ({
			id: `greenhouse:${board}:${j.id}`,
			source: 'greenhouse',
			board,
			company_name: company,
			title: j.title,
			location: j.location?.name ?? null,
			work_mode: guessWorkMode(j.location?.name),
			url: j.absolute_url,
			description_text: htmlToText(decodeEntities(j.content ?? '')),
			salary_min: null,
			salary_max: null
		}));
	},

	async lever(board, company) {
		const data = await getJson<
			{
				id: string;
				text: string;
				hostedUrl: string;
				categories?: { location?: string };
				workplaceType?: string;
				descriptionPlain?: string;
				salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
			}[]
		>(`https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`);
		return data.map((j) => {
			const annualGbp = j.salaryRange?.currency === 'GBP' && j.salaryRange.interval === 'per-year-salary';
			return {
				id: `lever:${board}:${j.id}`,
				source: 'lever',
				board,
				company_name: company,
				title: j.text,
				location: j.categories?.location ?? null,
				work_mode: j.workplaceType === 'on-site' ? 'onsite' : j.workplaceType === 'hybrid' || j.workplaceType === 'remote' ? j.workplaceType : guessWorkMode(j.categories?.location),
				url: j.hostedUrl,
				description_text: j.descriptionPlain ?? null,
				salary_min: annualGbp ? (j.salaryRange?.min ?? null) : null,
				salary_max: annualGbp ? (j.salaryRange?.max ?? null) : null
			};
		});
	},

	async ashby(board, company) {
		// TODO(ingest): parse `compensation` for salary bands.
		const data = await getJson<{
			jobs: { id: string; title: string; location?: string; isRemote?: boolean; workplaceType?: string; jobUrl: string; descriptionPlain?: string }[];
		}>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`);
		return data.jobs.map((j) => ({
			id: `ashby:${board}:${j.id}`,
			source: 'ashby',
			board,
			company_name: company,
			title: j.title,
			location: j.location ?? null,
			work_mode: j.isRemote ? 'remote' : (j.workplaceType?.toLowerCase().replace('-', '') ?? guessWorkMode(j.location)),
			url: j.jobUrl,
			description_text: j.descriptionPlain ?? null,
			salary_min: null,
			salary_max: null
		}));
	}
};

async function getJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'EveryIntro job ingest' } });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	return res.json() as Promise<T>;
}

function guessWorkMode(location?: string | null): string | null {
	if (!location) return null;
	if (/remote/i.test(location)) return 'remote';
	if (/hybrid/i.test(location)) return 'hybrid';
	return null;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');
}

function htmlToText(html: string): string {
	return html
		.replace(/<(br|\/p|\/li|\/h\d)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Env } from '../env';
import type { CandidateRow, PublicJobRow, User } from '../../types';
import { DIGEST_JOBS_CONSIDERED, MIN_FIT_TO_SHOW } from '../../config';
import { all, first } from '../db';
import { assertWithinBudget, claude, FALLBACK, logUsage, mockMode, modelFor } from '../claude';
import { nearest, vectorsAvailable } from '../embeddings';
import { candidateFacts, factsText } from '../matching/facts';
import { DigestOutput } from '../../schemas';
import { sendEmail, templates } from '../email';

// Weekly digest for one candidate: nearest public jobs → quick Claude rerank
// → store picks → email. The biggest steady-state cost line, so it runs weekly,
// only for recently active candidates, at low effort.
// TODO(cost): run these through the Message Batches API (50% cheaper).

const DIGEST_SYSTEM = `You pick job listings for a job seeker. Score each listing 1–5 for how well it fits what they want (5 = apply today, 1 = irrelevant). "why" is one short sentence to the job seeker. Return one result per listing using its ref.`;

export async function digestCandidate(env: Env, candidateId: string): Promise<void> {
	if (!vectorsAvailable(env) || mockMode(env)) return; // needs the vector index; skipped in local dev / mock
	await assertWithinBudget(env);
	const row = await first<CandidateRow>(env.DB, `SELECT * FROM candidates WHERE user_id = ? AND status = 'active'`, candidateId);
	if (!row?.blind_summary) return;
	const user = await first<User>(env.DB, 'SELECT id, email, name, kind FROM users WHERE id = ?', candidateId);
	if (!user) return;

	const profileText = `${factsText(candidateFacts(row))}\n${row.blind_summary}`;
	const nearestIds = await nearest(env, profileText, 'job', DIGEST_JOBS_CONSIDERED * 2);
	const jobs = await all<PublicJobRow>(
		env.DB,
		`SELECT * FROM public_jobs
		 WHERE id IN (SELECT value FROM json_each(?1))
		   AND id NOT IN (SELECT job_id FROM digest_items WHERE candidate_id = ?2)
		   AND (salary_max IS NULL OR ?3 IS NULL OR salary_max >= ?3)
		 LIMIT ?4`,
		JSON.stringify(nearestIds),
		candidateId,
		row.salary_floor,
		DIGEST_JOBS_CONSIDERED
	);
	if (jobs.length === 0) return;

	const refs = new Map(jobs.map((j, i) => [`j${i + 1}`, j]));
	const response = await claude(env).beta.messages.parse({
		model: modelFor(env),
		max_tokens: 8_000,
		...FALLBACK,
		output_config: { effort: 'low', format: betaZodOutputFormat(DigestOutput) },
		system: DIGEST_SYSTEM,
		messages: [
			{
				role: 'user',
				content: `<job_seeker>\n${profileText}\n</job_seeker>\n<listings>\n${[...refs]
					.map(([ref, j]) => `<listing ref="${ref}">${j.title} at ${j.company_name} (${j.location ?? 'location n/a'})\n${(j.description_text ?? '').slice(0, 800)}</listing>`)
					.join('\n')}\n</listings>`
			}
		]
	});
	await logUsage(env, 'digest', candidateId, response);
	if (!response.parsed_output) return;

	const picks = response.parsed_output.results
		.map((r) => ({ job: refs.get(r.ref), fit: Math.min(5, Math.max(1, r.fit)), why: r.why }))
		.filter((p): p is { job: PublicJobRow; fit: number; why: string } => Boolean(p.job) && p.fit >= MIN_FIT_TO_SHOW);
	if (picks.length === 0) return;

	const insert = env.DB.prepare('INSERT OR IGNORE INTO digest_items (candidate_id, job_id, fit, why) VALUES (?, ?, ?, ?)');
	await env.DB.batch(picks.map((p) => insert.bind(candidateId, p.job.id, p.fit, p.why)));

	await sendEmail(env, {
		to: user.email,
		...templates.digest(
			env,
			picks.slice(0, 5).map((p) => `${p.job.title} at ${p.job.company_name}\n${p.why}\n${p.job.url}`)
		)
	});
}

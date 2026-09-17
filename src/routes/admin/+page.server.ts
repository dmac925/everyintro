import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { all, first } from '$lib/server/db';
import { costGbp, spentTodayGbp } from '$lib/server/claude';

// Measured AI spend from llm_usage, so cost decisions (model choice, digest
// cadence, caps) are made on real numbers rather than the plan's estimates.
export const load: PageServerLoad = async ({ locals, url, platform }) => {
	requireUser(locals, url, 'admin');
	const env = getEnv(platform);

	const usage = await all<{
		purpose: string;
		model: string;
		calls: number;
		input: number;
		output: number;
		cache_read: number;
		cache_write: number;
	}>(
		env.DB,
		`SELECT purpose, model, COUNT(*) AS calls, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
			SUM(cache_read_tokens) AS cache_read, SUM(cache_write_tokens) AS cache_write
		 FROM llm_usage WHERE created_at > datetime('now', '-30 days')
		 GROUP BY purpose, model ORDER BY purpose`
	);

	const rows = usage.map((u) => {
		const gbp = costGbp(u.model, u.input, u.output, u.cache_read, u.cache_write);
		return { ...u, gbp, perCall: gbp / Math.max(1, u.calls) };
	});

	const count = async (sql: string) => (await first<{ n: number }>(env.DB, sql))?.n ?? 0;
	const [candidates, activeCandidates, companies, openRoles, intros, acceptedIntros, publicJobs] = await Promise.all([
		count('SELECT COUNT(*) AS n FROM candidates'),
		count(`SELECT COUNT(*) AS n FROM candidates WHERE status = 'active'`),
		count('SELECT COUNT(*) AS n FROM companies'),
		count(`SELECT COUNT(*) AS n FROM roles WHERE status = 'open'`),
		count('SELECT COUNT(*) AS n FROM intros'),
		count(`SELECT COUNT(*) AS n FROM intros WHERE status = 'accepted'`),
		count('SELECT COUNT(*) AS n FROM public_jobs')
	]);

	return {
		usage: rows,
		totalGbp: rows.reduce((s, r) => s + r.gbp, 0),
		todayGbp: await spentTodayGbp(env),
		budgetGbp: Number(env.LLM_DAILY_BUDGET_GBP) || null,
		mode: env.LLM_MODE === 'mock' ? 'mock' : (env.MODEL_OVERRIDE ?? 'live'),
		counts: { candidates, activeCandidates, companies, openRoles, intros, acceptedIntros, publicJobs }
	};
};

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { all, parseJson, run } from '$lib/server/db';
import { INTEREST_LIFTS_FIT, MIN_FIT_TO_SHOW } from '$lib/config';
import type { IntroStatus, MatchStatus } from '$lib/types';

// Roles on the platform that matched this candidate, plus the public listings
// from the weekly digest. Candidates can raise a hand on a platform role
// (issue #7); the employer sees an "Interested" badge on the anonymous card.

interface MatchedRole {
	match_id: string;
	fit: number;
	why_json: string;
	gaps_json: string;
	status: MatchStatus;
	interested_at: string | null;
	role_id: string;
	title: string | null;
	summary: string | null;
	salary_min: number | null;
	salary_max: number | null;
	work_mode: string | null;
	location: string | null;
	company_name: string;
	intro_status: IntroStatus | null;
}

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const [matched, jobs] = await Promise.all([
		all<MatchedRole>(
			env.DB,
			`SELECT m.id AS match_id, m.fit, m.why_json, m.gaps_json, m.status, m.interested_at,
				r.id AS role_id, r.title, r.summary, r.salary_min, r.salary_max, r.work_mode, r.location,
				c.name AS company_name, i.status AS intro_status
			 FROM matches m
			 JOIN roles r ON r.id = m.role_id
			 JOIN companies c ON c.id = r.company_id
			 LEFT JOIN intros i ON i.match_id = m.id
			 WHERE m.candidate_id = ? AND r.status = 'open' AND m.status IN ('shown', 'requested') AND m.fit >= ?
			 ORDER BY m.status = 'requested' DESC, m.fit DESC, m.created_at DESC`,
			user.id,
			MIN_FIT_TO_SHOW - INTEREST_LIFTS_FIT
		),
		all<{ id: string; title: string; company_name: string; location: string | null; url: string; fit: number; why: string; created_at: string }>(
			env.DB,
			`SELECT j.id, j.title, j.company_name, j.location, j.url, d.fit, d.why, d.created_at
			 FROM digest_items d JOIN public_jobs j ON j.id = d.job_id
			 WHERE d.candidate_id = ?
			 ORDER BY d.created_at DESC, d.fit DESC
			 LIMIT 100`,
			user.id
		)
	]);
	return {
		matched: matched.map((m) => ({ ...m, why: parseJson<string[]>(m.why_json, []), gaps: parseJson<string[]>(m.gaps_json, []) })),
		jobs
	};
};

export const actions: Actions = {
	interest: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const env = getEnv(platform);
		const matchId = String((await request.formData()).get('matchId'));
		const r = await run(
			env.DB,
			`UPDATE matches SET interested_at = datetime('now'), updated_at = datetime('now')
			 WHERE id = ? AND candidate_id = ? AND status = 'shown' AND interested_at IS NULL`,
			matchId,
			user.id
		);
		if (!r.meta.changes) return fail(400, { message: 'That role is no longer open to interest.' });
		return { interested: matchId };
	},
	withdraw: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const env = getEnv(platform);
		const matchId = String((await request.formData()).get('matchId'));
		await run(env.DB, `UPDATE matches SET interested_at = NULL, updated_at = datetime('now') WHERE id = ? AND candidate_id = ?`, matchId, user.id);
		return { withdrew: matchId };
	}
};

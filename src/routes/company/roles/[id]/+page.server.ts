import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireCompany, requireUser } from '$lib/server/guards';
import { all, first, parseJson, run } from '$lib/server/db';
import type { Env } from '$lib/server/env';
import { openRole, requestIntro } from '$lib/server/roles';
import { dispatch } from '$lib/server/jobs/dispatch';
import { candidateFacts, roleSpecOf } from '$lib/server/matching/facts';
import { missingRoleFields } from '$lib/schemas';
import { CARDS_PER_ROLE, MANUAL_REFRESH_MIN_HOURS, MIN_FIT_TO_SHOW } from '$lib/config';
import type { CandidateRow, CompanyRow, MatchCardData, MatchRow, RoleRow } from '$lib/types';

async function ownedRole(env: Env, company: CompanyRow, id: string): Promise<RoleRow> {
	const role = await first<RoleRow>(env.DB, 'SELECT * FROM roles WHERE id = ? AND company_id = ?', id, company.id);
	if (!role) error(404, 'Role not found.');
	return role;
}

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
	const user = requireUser(locals, url, 'employer');
	const env = getEnv(platform);
	const company = await requireCompany(env, user);
	const role = await ownedRole(env, company, params.id);
	const spec = roleSpecOf(role);

	type Row = MatchRow & Pick<CandidateRow, 'profile_json' | 'blind_summary'>;
	const rows = await all<Row>(
		env.DB,
		`SELECT m.*, c.profile_json, c.blind_summary FROM matches m JOIN candidates c ON c.user_id = m.candidate_id
		 WHERE m.role_id = ? AND m.status IN ('shown', 'requested') AND m.fit >= ?
		 ORDER BY m.status = 'requested' DESC, m.fit DESC, m.created_at ASC`,
		role.id,
		MIN_FIT_TO_SHOW
	);
	const requested = rows.filter((r) => r.status === 'requested');
	const shown = rows.filter((r) => r.status === 'shown').slice(0, CARDS_PER_ROLE);
	const toCard = (r: Row): MatchCardData => ({
		matchId: r.id,
		ref: r.id.slice(0, 4).toUpperCase(),
		fit: r.fit,
		why: parseJson<string[]>(r.why_json, []),
		gaps: parseJson<string[]>(r.gaps_json, []),
		status: r.status,
		facts: candidateFacts(r),
		summary: r.blind_summary ?? ''
	});

	return {
		role: { id: role.id, status: role.status, summary: role.summary, expiresAt: role.expires_at, lastMatchedAt: role.last_matched_at },
		spec,
		missing: missingRoleFields(spec).concat(role.summary ? [] : ['finish the intake chat']),
		cards: shown.map(toCard),
		requestedCards: requested.map(toCard),
		paid: url.searchParams.has('paid'),
		cancelled: url.searchParams.has('cancelled')
	};
};

export const actions: Actions = {
	open: async ({ params, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const role = await ownedRole(env, company, params.id);
		if (role.status !== 'draft' && role.status !== 'awaiting_payment') return fail(400, { message: 'This role is already open.' });
		if (missingRoleFields(roleSpecOf(role)).length || !role.summary) return fail(400, { message: 'Finish the role spec first.' });

		// Free to open: the fee is per hire, charged from /company/intros.
		await openRole(env, role, (p) => platform?.context?.waitUntil(p));
		return { opened: true };
	},

	requestIntro: async ({ params, request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const role = await ownedRole(env, company, params.id);
		const matchId = String((await request.formData()).get('matchId'));
		const match = await first<MatchRow>(env.DB, 'SELECT * FROM matches WHERE id = ? AND role_id = ?', matchId, role.id);
		if (!match) return fail(404, { message: 'Match not found.' });
		await requestIntro(env, company, role, match);
		return { requested: true };
	},

	pass: async ({ params, request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const role = await ownedRole(env, company, params.id);
		const form = await request.formData();
		// Pass reasons are kept for the feedback loop. TODO(matching): feed them into rerank.
		await run(
			env.DB,
			`UPDATE matches SET status = 'passed', pass_reason = ?, updated_at = datetime('now') WHERE id = ? AND role_id = ? AND status = 'shown'`,
			String(form.get('reason') ?? '') || null,
			String(form.get('matchId')),
			role.id
		);
		return { passed: true };
	},

	refresh: async ({ params, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const role = await ownedRole(env, company, params.id);
		if (role.status !== 'open') return fail(400, { message: 'Only open roles can be refreshed.' });
		const last = role.last_matched_at ? Date.parse(role.last_matched_at.replace(' ', 'T') + 'Z') : 0;
		if (Date.now() - last < MANUAL_REFRESH_MIN_HOURS * 3_600_000) {
			return fail(429, { message: `Matches refresh at most every ${MANUAL_REFRESH_MIN_HOURS} hours.` });
		}
		platform?.context?.waitUntil(dispatch(env, { type: 'match_role', roleId: role.id }));
		return { refreshing: true };
	},

	close: async ({ params, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const role = await ownedRole(env, company, params.id);
		await run(env.DB, `UPDATE roles SET status = 'closed' WHERE id = ?`, role.id);
		return { closed: true };
	}
};

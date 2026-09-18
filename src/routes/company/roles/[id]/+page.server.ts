import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireCompany, requireUser } from '$lib/server/guards';
import { all, first, parseJson, run } from '$lib/server/db';
import type { Env } from '$lib/server/env';
import { openRole, requestIntro } from '$lib/server/roles';
import { dispatch } from '$lib/server/jobs/dispatch';
import { askQuestion, QuestionError, questionsForRole } from '$lib/server/questions';
import { BudgetExceededError, friendlyError } from '$lib/server/claude';
import { candidateFacts, roleSpecOf } from '$lib/server/matching/facts';
import { missingRoleFields } from '$lib/schemas';
import { CARDS_PER_ROLE, INTEREST_LIFTS_FIT, MANUAL_REFRESH_MIN_HOURS, MAX_CARDS_PER_ROLE, MIN_FIT_TO_SHOW } from '$lib/config';
import type { CandidateRow, CompanyRow, IntroStatus, MatchCardData, MatchRow, RoleRow } from '$lib/types';

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

	// Everything scored at or above one band below the cutoff. The first page is
	// the strong fits (plus anyone who raised a hand); "show more" walks into the
	// weaker band, labelled, up to MAX_CARDS_PER_ROLE.
	type Row = MatchRow & Pick<CandidateRow, 'profile_json' | 'blind_summary'>;
	const rows = await all<Row>(
		env.DB,
		`SELECT m.*, c.profile_json, c.blind_summary FROM matches m JOIN candidates c ON c.user_id = m.candidate_id
		 WHERE m.role_id = ? AND m.status IN ('shown', 'requested') AND m.fit >= ?
		 ORDER BY m.status = 'requested' DESC, (m.interested_at IS NOT NULL) DESC, m.fit DESC, m.created_at ASC`,
		role.id,
		MIN_FIT_TO_SHOW - INTEREST_LIFTS_FIT
	);
	const strongEnough = (r: Row) => r.fit >= MIN_FIT_TO_SHOW || (r.interested_at != null && r.fit >= MIN_FIT_TO_SHOW - INTEREST_LIFTS_FIT);
	const requested = rows.filter((r) => r.status === 'requested');
	const shownAll = rows.filter((r) => r.status === 'shown');
	const ordered = [...shownAll.filter(strongEnough), ...shownAll.filter((r) => !strongEnough(r))];
	const want = Number(url.searchParams.get('show')) || CARDS_PER_ROLE;
	const visible = Math.min(MAX_CARDS_PER_ROLE, Math.max(CARDS_PER_ROLE, want));
	const shown = ordered.slice(0, visible);
	const questions = await questionsForRole(env, role.id);
	const toCard = (r: Row): MatchCardData => ({
		matchId: r.id,
		ref: r.id.slice(0, 4).toUpperCase(),
		fit: r.fit,
		why: parseJson<string[]>(r.why_json, []),
		gaps: parseJson<string[]>(r.gaps_json, []),
		status: r.status,
		interested: r.interested_at != null,
		weak: r.fit < MIN_FIT_TO_SHOW,
		questions: (questions.get(r.id) ?? []).map((q) => ({
			id: q.id,
			text: q.text,
			status: q.status,
			answer: q.answer,
			answerSource: q.answer_source,
			reason: q.refusal_reason,
			askedAt: q.created_at
		})),
		facts: candidateFacts(r),
		summary: r.blind_summary ?? ''
	});

	// Pipeline columns (issue #10). Candidate name and email are selected ONLY for accepted intros.
	const intros = await all<{
		id: string;
		match_id: string;
		status: IntroStatus;
		requested_at: string;
		responded_at: string | null;
		decline_reason: string | null;
		hired_at: string | null;
		fit: number;
		candidate_name: string | null;
		candidate_email: string | null;
	}>(
		env.DB,
		`SELECT i.id, i.match_id, i.status, i.requested_at, i.responded_at, i.decline_reason, i.hired_at, m.fit,
			CASE WHEN i.status = 'accepted' THEN u.name END AS candidate_name,
			CASE WHEN i.status = 'accepted' THEN u.email END AS candidate_email
		 FROM intros i JOIN matches m ON m.id = i.match_id JOIN users u ON u.id = i.candidate_id
		 WHERE i.role_id = ?
		 ORDER BY i.requested_at DESC`,
		role.id
	);
	const pipeline = {
		asked: intros.filter((i) => i.status === 'requested'),
		talking: intros.filter((i) => i.status === 'accepted' && !i.hired_at),
		hired: intros.filter((i) => i.hired_at),
		closed: intros.filter((i) => i.status === 'declined' || i.status === 'expired')
	};

	return {
		pipeline,
		shortlist: { visible: shown.length, total: Math.min(MAX_CARDS_PER_ROLE, ordered.length), page: CARDS_PER_ROLE },
		role: { id: role.id, status: role.status, summary: role.summary, expiresAt: role.expires_at, lastMatchedAt: role.last_matched_at },
		spec,
		missing: missingRoleFields(spec).concat(role.summary ? [] : ['finish the intake chat']),
		cards: shown.map(toCard),
		// A match stays 'requested' after the intro resolves; only unanswered intros belong in Asked.
		requestedCards: requested.filter((r) => pipeline.asked.some((i) => i.match_id === r.id)).map(toCard),
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

	// Follow-up question to one card (matchId) or several (matchId repeated).
	ask: async ({ params, request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const role = await ownedRole(env, company, params.id);
		if (role.status !== 'open') return fail(400, { message: 'Open the role before asking questions.' });
		const form = await request.formData();
		const matchIds = form.getAll('matchId').map(String);
		try {
			const r = await askQuestion(env, company, role, user.id, matchIds, String(form.get('text') ?? ''));
			const bits = [
				r.answered && `${r.answered} answered from the profile`,
				r.sent && `${r.sent} sent to the candidate`,
				r.refused && `${r.refused} not sent (see the card)`,
				r.skipped && `${r.skipped} skipped, at their weekly limit`
			].filter(Boolean);
			return { asked: true, notice: bits.join(', ') + '.' };
		} catch (err) {
			if (err instanceof QuestionError || err instanceof BudgetExceededError) return fail(400, { message: err.message });
			console.error('ask failed', err);
			return fail(500, { message: friendlyError(err) });
		}
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

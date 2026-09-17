import type { Env } from '../env';
import type { CandidateRow, ConversationRow, RoleRow } from '../../types';
import { first, parseJson, run } from '../db';
import {
	CandidateProfile,
	RoleSpec,
	emptyCandidateProfile,
	emptyRoleSpec,
	type CandidateProfile as CandidateProfileT,
	type RoleSpec as RoleSpecT
} from '../../schemas';

// Load/save the structured draft that an intake conversation is filling in.
//
// A candidate draft lives in one of two places: the candidates row (signed-in)
// or conversations.draft_json (anonymous homepage chat, until sign-in claims
// it). `CandidateHome` says which.

export type CandidateHome = { userId: string } | { conversationId: string };

export interface CandidateDraft {
	profile: CandidateProfileT | null;
	blind_summary: string | null;
	cv_key: string | null;
}

export function candidateHome(convo: ConversationRow): CandidateHome {
	return convo.user_id ? { userId: convo.user_id } : { conversationId: convo.id };
}

async function loadDraft(env: Env, conversationId: string): Promise<CandidateDraft> {
	const row = await first<Pick<ConversationRow, 'draft_json'>>(env.DB, 'SELECT draft_json FROM conversations WHERE id = ?', conversationId);
	const raw = parseJson<Partial<CandidateDraft>>(row?.draft_json, {});
	const profile = CandidateProfile.safeParse(raw.profile);
	return { profile: profile.success ? profile.data : null, blind_summary: raw.blind_summary ?? null, cv_key: raw.cv_key ?? null };
}

async function patchDraft(env: Env, conversationId: string, patch: Partial<CandidateDraft>) {
	const current = await loadDraft(env, conversationId);
	await run(env.DB, 'UPDATE conversations SET draft_json = ? WHERE id = ?', JSON.stringify({ ...current, ...patch }), conversationId);
}

export async function loadCandidateProfile(env: Env, home: CandidateHome): Promise<CandidateProfileT> {
	if ('conversationId' in home) return (await loadDraft(env, home.conversationId)).profile ?? emptyCandidateProfile();
	const row = await first<Pick<CandidateRow, 'profile_json'>>(env.DB, 'SELECT profile_json FROM candidates WHERE user_id = ?', home.userId);
	const parsed = CandidateProfile.safeParse(parseJson(row?.profile_json, null));
	return parsed.success ? parsed.data : emptyCandidateProfile();
}

export async function saveCandidateProfile(env: Env, home: CandidateHome, p: CandidateProfileT) {
	if ('conversationId' in home) return patchDraft(env, home.conversationId, { profile: p });
	await run(
		env.DB,
		`UPDATE candidates SET profile_json = ?, salary_floor = ?, location = ?, work_mode = ?,
			right_to_work_uk = ?, notice_weeks = ?, profile_version = profile_version + 1,
			last_active_at = datetime('now')
		 WHERE user_id = ?`,
		JSON.stringify(p),
		p.salary_floor_gbp,
		p.location,
		p.work_mode,
		p.right_to_work_uk == null ? null : Number(p.right_to_work_uk),
		p.notice_weeks,
		home.userId
	);
}

/** Blind summary written by complete_intake. Activates a signed-in candidate. */
export async function saveBlindSummary(env: Env, home: CandidateHome, summary: string) {
	if ('conversationId' in home) return patchDraft(env, home.conversationId, { blind_summary: summary });
	await run(
		env.DB,
		`UPDATE candidates SET blind_summary = ?, status = CASE WHEN status = 'onboarding' THEN 'active' ELSE status END WHERE user_id = ?`,
		summary,
		home.userId
	);
}

export async function saveCvKey(env: Env, home: CandidateHome, key: string) {
	if ('conversationId' in home) return patchDraft(env, home.conversationId, { cv_key: key });
	await run(env.DB, 'UPDATE candidates SET cv_key = ? WHERE user_id = ?', key, home.userId);
}

export async function loadRoleSpec(env: Env, roleId: string): Promise<RoleSpecT> {
	const row = await first<Pick<RoleRow, 'spec_json'>>(env.DB, 'SELECT spec_json FROM roles WHERE id = ?', roleId);
	const parsed = RoleSpec.safeParse(parseJson(row?.spec_json, null));
	return parsed.success ? parsed.data : emptyRoleSpec();
}

export async function saveRoleSpec(env: Env, roleId: string, r: RoleSpecT) {
	await run(
		env.DB,
		`UPDATE roles SET spec_json = ?, title = ?, salary_min = ?, salary_max = ?, location = ?,
			work_mode = ?, sponsorship = ?, spec_version = spec_version + 1
		 WHERE id = ?`,
		JSON.stringify(r),
		r.title,
		r.salary_min_gbp,
		r.salary_max_gbp,
		r.location,
		r.work_mode,
		r.sponsorship == null ? null : Number(r.sponsorship),
		roleId
	);
}

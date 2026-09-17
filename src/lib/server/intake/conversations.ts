import type { Cookies } from '@sveltejs/kit';
import type { Env } from '../env';
import type { ConversationKind, ConversationRow, User } from '../../types';
import { ANON_CHATS_PER_IP_PER_DAY, MAX_INTAKES_PER_30_DAYS } from '../../config';
import { all, first, newId, run } from '../db';
import { CandidateProfile } from '../../schemas';
import { saveCandidateProfile, type CandidateDraft } from './drafts';
import { dispatch } from '../jobs/dispatch';

export const ANON_COOKIE = 'ei_anon';

/** The latest conversation for a subject (candidate or role), if any. */
export async function latestConversation(env: Env, subjectId: string): Promise<ConversationRow | null> {
	return first<ConversationRow>(
		env.DB,
		'SELECT * FROM conversations WHERE subject_id = ? ORDER BY created_at DESC LIMIT 1',
		subjectId
	);
}

export class IntakeLimitError extends Error {}

/**
 * Start a fresh intake. Capped per subject per 30 days — intake is the most
 * expensive free action, so this is the main guard on candidate-side spend.
 */
export async function startConversation(
	env: Env,
	kind: ConversationKind,
	userId: string,
	subjectId: string
): Promise<ConversationRow> {
	const recent = await all<{ id: string }>(
		env.DB,
		`SELECT id FROM conversations WHERE subject_id = ? AND created_at > datetime('now', '-30 days')`,
		subjectId
	);
	if (recent.length >= MAX_INTAKES_PER_30_DAYS) {
		throw new IntakeLimitError(
			`You can start ${MAX_INTAKES_PER_30_DAYS} new chats every 30 days. Edit your details directly instead.`
		);
	}
	const id = newId();
	await run(
		env.DB,
		'INSERT INTO conversations (id, kind, user_id, subject_id) VALUES (?, ?, ?, ?)',
		id,
		kind,
		userId,
		subjectId
	);
	return (await first<ConversationRow>(env.DB, 'SELECT * FROM conversations WHERE id = ?', id))!;
}

// ── Anonymous (homepage) chats ──────────────────────────────────────────────

export async function hashIp(ip: string | null): Promise<string | null> {
	if (!ip) return null;
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`everyintro:${ip}`));
	return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Start (or resume) an anonymous candidate chat, keyed by a cookie token. Rate-limited per IP. */
export async function startAnonymousConversation(env: Env, cookies: Cookies, ip: string | null): Promise<ConversationRow> {
	const existing = await anonymousConversation(env, cookies);
	if (existing && existing.status === 'open') return existing;

	const ipHash = await hashIp(ip);
	if (ipHash) {
		const today = await first<{ n: number }>(
			env.DB,
			`SELECT COUNT(*) AS n FROM conversations WHERE ip_hash = ? AND created_at > datetime('now', '-1 day')`,
			ipHash
		);
		if ((today?.n ?? 0) >= ANON_CHATS_PER_IP_PER_DAY) {
			throw new IntakeLimitError('Too many chats started from this connection today. Sign in to continue.');
		}
	}
	const id = newId();
	const token = newId();
	await run(
		env.DB,
		`INSERT INTO conversations (id, kind, anon_token, ip_hash) VALUES (?, 'candidate_intake', ?, ?)`,
		id,
		token,
		ipHash
	);
	cookies.set(ANON_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
	return (await first<ConversationRow>(env.DB, 'SELECT * FROM conversations WHERE id = ?', id))!;
}

export async function anonymousConversation(env: Env, cookies: Cookies): Promise<ConversationRow | null> {
	const token = cookies.get(ANON_COOKIE);
	if (!token) return null;
	return first<ConversationRow>(env.DB, 'SELECT * FROM conversations WHERE anon_token = ? AND user_id IS NULL', token);
}

/**
 * On candidate sign-in: attach the anonymous chat to the account and move the
 * draft profile onto the candidates row. Skipped if there's no anon cookie.
 */
export async function claimConversation(env: Env, cookies: Cookies, user: User): Promise<ConversationRow | null> {
	const convo = await anonymousConversation(env, cookies);
	cookies.delete(ANON_COOKIE, { path: '/' });
	if (!convo) return null;

	const draft = parseDraft(convo.draft_json);
	await run(
		env.DB,
		`UPDATE conversations SET user_id = ?, subject_id = ?, anon_token = NULL, draft_json = NULL WHERE id = ?`,
		user.id,
		user.id,
		convo.id
	);
	if (draft?.profile) await saveCandidateProfile(env, { userId: user.id }, draft.profile);
	if (draft?.blind_summary || draft?.cv_key) {
		await run(
			env.DB,
			`UPDATE candidates SET blind_summary = COALESCE(?, blind_summary), cv_key = COALESCE(?, cv_key),
				status = CASE WHEN ? IS NOT NULL AND status = 'onboarding' THEN 'active' ELSE status END
			 WHERE user_id = ?`,
			draft.blind_summary ?? null,
			draft.cv_key ?? null,
			draft.blind_summary ?? null,
			user.id
		);
		if (draft.blind_summary) await dispatch(env, { type: 'embed_candidate', candidateId: user.id });
	}
	return { ...convo, user_id: user.id, subject_id: user.id, anon_token: null, draft_json: null };
}

export function parseDraft(json: string | null): CandidateDraft | null {
	if (!json) return null;
	try {
		const raw = JSON.parse(json) as Partial<CandidateDraft>;
		const profile = CandidateProfile.safeParse(raw.profile);
		return {
			profile: profile.success ? profile.data : null,
			blind_summary: raw.blind_summary ?? null,
			cv_key: raw.cv_key ?? null
		};
	} catch {
		return null;
	}
}

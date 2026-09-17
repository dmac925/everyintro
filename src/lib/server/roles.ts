import type { Env } from './env';
import type { CompanyRow, MatchRow, RoleRow, User } from '../types';
import { INTRO_EXPIRY_DAYS, ROLE_LIVE_DAYS } from '../config';
import { first, newId, run, sqlDate } from './db';
import { dispatch } from './jobs/dispatch';
import { sendEmail, templates } from './email';

/** Open a role for matching. Free: the fee is per hire, see billing.ts. */
export async function openRole(env: Env, role: RoleRow, waitUntil?: (p: Promise<unknown>) => void): Promise<void> {
	await run(env.DB, 'UPDATE companies SET roles_opened = roles_opened + 1 WHERE id = ?', role.company_id);
	await run(
		env.DB,
		`UPDATE roles SET status = 'open', opened_at = datetime('now'), expires_at = ? WHERE id = ?`,
		sqlDate(ROLE_LIVE_DAYS),
		role.id
	);
	// First match run. Inline in dev, so hand it to waitUntil rather than
	// blocking the request for the length of a rerank call.
	const job = dispatch(env, { type: 'match_role', roleId: role.id });
	if (waitUntil) waitUntil(job);
	else await job;
}

/** Employer asks to be introduced. The candidate sees it on /me/intros. */
export async function requestIntro(env: Env, company: CompanyRow, role: RoleRow, match: MatchRow) {
	if (match.status !== 'shown') return;
	await env.DB.batch([
		env.DB.prepare(`UPDATE matches SET status = 'requested', updated_at = datetime('now') WHERE id = ?`).bind(match.id),
		env.DB.prepare(
			`INSERT OR IGNORE INTO intros (id, match_id, role_id, candidate_id, company_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)`
		).bind(newId(), match.id, role.id, match.candidate_id, company.id, sqlDate(INTRO_EXPIRY_DAYS))
	]);
	const candidate = await first<User>(env.DB, 'SELECT id, email, name, kind FROM users WHERE id = ?', match.candidate_id);
	if (candidate) {
		await sendEmail(env, { to: candidate.email, ...templates.introRequested(env, role.title ?? 'a role', company.name) });
	}
}

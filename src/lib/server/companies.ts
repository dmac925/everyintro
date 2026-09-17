import type { Env } from './env';
import type { CompanyRow, User } from '../types';
import { first, newId } from './db';
import { isFreeMail } from '../freeMail';

export { FREE_MAIL, isFreeMail } from '../freeMail';

/** "acme.co.uk" → "Acme". A placeholder until the employer edits it. */
export function nameFromDomain(domain: string): string {
	const label = domain.split('.')[0] ?? domain;
	return label.charAt(0).toUpperCase() + label.slice(1);
}

export class CompanyError extends Error {}

/**
 * The employer's company, created from their email domain if needed. Used by
 * /post so a verified email goes straight to the role chat; /company/setup
 * still exists for the longer form (name, Companies House number).
 */
export async function ensureCompany(env: Env, user: User): Promise<CompanyRow> {
	const mine = await first<CompanyRow>(
		env.DB,
		'SELECT c.* FROM companies c JOIN company_members m ON m.company_id = c.id WHERE m.user_id = ?',
		user.id
	);
	if (mine) return mine;
	const domain = user.email.split('@')[1]?.toLowerCase() ?? '';
	if (isFreeMail(user.email)) throw new CompanyError('Use your work email. EveryIntro is for direct employers.');

	const existing = await first<CompanyRow>(env.DB, 'SELECT * FROM companies WHERE domain = ?', domain);
	const companyId = existing?.id ?? newId();
	const statements = [];
	if (!existing) {
		statements.push(env.DB.prepare('INSERT INTO companies (id, name, domain) VALUES (?, ?, ?)').bind(companyId, nameFromDomain(domain), domain));
	}
	statements.push(env.DB.prepare('INSERT OR IGNORE INTO company_members (company_id, user_id) VALUES (?, ?)').bind(companyId, user.id));
	await env.DB.batch(statements);
	return (await first<CompanyRow>(env.DB, 'SELECT * FROM companies WHERE id = ?', companyId))!;
}

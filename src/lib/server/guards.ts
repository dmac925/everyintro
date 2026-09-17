import { error, redirect } from '@sveltejs/kit';
import type { User, UserKind, CompanyRow } from '../types';
import type { Env } from './env';
import { first } from './db';

export function requireUser(locals: App.Locals, url: URL, kind?: UserKind): User {
	const user = locals.user;
	if (!user) redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
	if (kind && user.kind !== kind && user.kind !== 'admin') error(403, 'This area is for a different kind of account.');
	return user;
}

/** Employer's company, or redirect to setup if they haven't created one. */
export async function requireCompany(env: Env, user: User): Promise<CompanyRow> {
	const company = await companyForUser(env, user.id);
	if (!company) redirect(303, '/company/setup');
	return company;
}

export async function companyForUser(env: Env, userId: string): Promise<CompanyRow | null> {
	return first<CompanyRow>(
		env.DB,
		`SELECT c.* FROM companies c JOIN company_members m ON m.company_id = c.id WHERE m.user_id = ?`,
		userId
	);
}

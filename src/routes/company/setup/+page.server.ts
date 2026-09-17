import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { companyForUser, requireUser } from '$lib/server/guards';
import { first, newId } from '$lib/server/db';
import { FREE_MAIL } from '$lib/server/companies';

// Direct employers only: the company is keyed on the signer's work-email domain.
// TODO(verify): check the Companies House number against the free Companies
// House API (name + active status) and set verified_at; until then roles can
// still be created but the company shows as unverified.
// TODO(teams): joining an existing company should need an invite or email
// verification once real auth is in place.

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'employer');
	if (await companyForUser(getEnv(platform), user.id)) redirect(303, '/company');
	const domain = user.email.split('@')[1];
	return { domain, freeMail: FREE_MAIL.has(domain) };
};

export const actions: Actions = {
	default: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const domain = user.email.split('@')[1];
		if (FREE_MAIL.has(domain)) return fail(400, { message: 'Sign in with your work email. EveryIntro is for direct employers.' });

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const chNumber = String(form.get('companies_house_no') ?? '').trim().toUpperCase();
		if (!name) return fail(400, { message: 'Enter your company name.' });
		if (chNumber && !/^[A-Z0-9]{8}$/.test(chNumber)) return fail(400, { message: 'Companies House numbers are 8 characters, e.g. 01234567.' });

		const existing = await first<{ id: string }>(env.DB, 'SELECT id FROM companies WHERE domain = ?', domain);
		const companyId = existing?.id ?? newId();
		const statements = [];
		if (!existing) {
			statements.push(
				env.DB.prepare('INSERT INTO companies (id, name, domain, companies_house_no) VALUES (?, ?, ?, ?)').bind(companyId, name, domain, chNumber || null)
			);
		}
		statements.push(env.DB.prepare('INSERT OR IGNORE INTO company_members (company_id, user_id) VALUES (?, ?)').bind(companyId, user.id));
		await env.DB.batch(statements);
		redirect(303, '/company');
	}
};

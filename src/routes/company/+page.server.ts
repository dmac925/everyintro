import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireCompany, requireUser } from '$lib/server/guards';
import { all, newId, run } from '$lib/server/db';
import { IntakeLimitError, startConversation } from '$lib/server/intake/conversations';
import type { RoleStatus } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'employer');
	const env = getEnv(platform);
	const company = await requireCompany(env, user);
	const roles = await all<{
		id: string;
		title: string | null;
		status: RoleStatus;
		expires_at: string | null;
		created_at: string;
		shown: number;
		requested: number;
	}>(
		env.DB,
		`SELECT r.id, r.title, r.status, r.expires_at, r.created_at,
			(SELECT COUNT(*) FROM matches m WHERE m.role_id = r.id AND m.status = 'shown') AS shown,
			(SELECT COUNT(*) FROM matches m WHERE m.role_id = r.id AND m.status = 'requested') AS requested
		 FROM roles r WHERE r.company_id = ? ORDER BY r.created_at DESC`,
		company.id
	);
	return { company, roles };
};

export const actions: Actions = {
	createRole: async ({ locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const roleId = newId();
		await run(env.DB, 'INSERT INTO roles (id, company_id, created_by) VALUES (?, ?, ?)', roleId, company.id, user.id);
		try {
			await startConversation(env, 'role_intake', user.id, roleId);
		} catch (err) {
			if (err instanceof IntakeLimitError) return fail(429, { message: err.message });
			throw err;
		}
		redirect(303, `/company/roles/${roleId}/intake`);
	}
};

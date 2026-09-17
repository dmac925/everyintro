import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { registerUser } from '$lib/server/auth';
import { first, newId, run } from '$lib/server/db';
import { CompanyError, ensureCompany } from '$lib/server/companies';
import { IntakeLimitError, latestConversation, startConversation } from '$lib/server/intake/conversations';
import { loadRoleSpec } from '$lib/server/intake/drafts';
import { toChatLines } from '$lib/server/intake/engine';
import type { Env } from '$lib/server/env';
import type { User } from '$lib/types';

// Employer front door. The page verifies a work email through Clerk (email
// code, no password) on the client. As soon as a Clerk session exists, this
// load registers the employer, creates their company from the email domain and
// opens a draft role with an intake chat, all on the same page.

/** A draft role with an intake chat for this user, creating one if needed. */
async function draftRole(env: Env, user: User, companyId: string, wanted: string | null) {
	let role = wanted
		? await first<{ id: string }>(env.DB, `SELECT id FROM roles WHERE id = ? AND company_id = ? AND status = 'draft'`, wanted, companyId)
		: null;
	role ??= await first<{ id: string }>(
		env.DB,
		`SELECT id FROM roles WHERE company_id = ? AND created_by = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
		companyId,
		user.id
	);
	if (!role) {
		role = { id: newId() };
		await run(env.DB, 'INSERT INTO roles (id, company_id, created_by) VALUES (?, ?, ?)', role.id, companyId, user.id);
	}
	const convo = (await latestConversation(env, role.id)) ?? (await startConversation(env, 'role_intake', user.id, role.id));
	return { role, convo };
}

export const load: PageServerLoad = async ({ locals, url, platform, cookies }) => {
	const env = getEnv(platform);
	const { userId } = locals.auth();
	if (!userId) return { stage: 'verify' as const };

	const user = locals.user ?? (await registerUser(env, cookies, userId, 'employer'));
	if (user.kind === 'candidate') return { stage: 'candidate' as const, email: user.email };

	try {
		const company = await ensureCompany(env, user);
		const { role, convo } = await draftRole(env, user, company.id, url.searchParams.get('role'));
		return {
			stage: 'chat' as const,
			email: user.email,
			roleId: role.id,
			conversationId: convo.id,
			lines: toChatLines(convo.messages_json),
			complete: convo.status === 'complete',
			spec: await loadRoleSpec(env, role.id)
		};
	} catch (err) {
		if (err instanceof CompanyError || err instanceof IntakeLimitError) return { stage: 'blocked' as const, email: user.email, message: err.message };
		throw err;
	}
};

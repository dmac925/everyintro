import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireCompany, requireUser } from '$lib/server/guards';
import { first } from '$lib/server/db';
import { latestConversation, startConversation } from '$lib/server/intake/conversations';
import { loadRoleSpec } from '$lib/server/intake/drafts';
import { toChatLines } from '$lib/server/intake/engine';

export const load: PageServerLoad = async ({ params, locals, url, platform }) => {
	const user = requireUser(locals, url, 'employer');
	const env = getEnv(platform);
	const company = await requireCompany(env, user);
	const role = await first<{ id: string }>(env.DB, 'SELECT id FROM roles WHERE id = ? AND company_id = ?', params.id, company.id);
	if (!role) error(404, 'Role not found.');

	const convo = (await latestConversation(env, role.id)) ?? (await startConversation(env, 'role_intake', user.id, role.id));
	if (convo.user_id !== user.id) {
		// TODO(teams): let colleagues continue each other's intake.
		error(403, 'This role intake was started by a colleague.');
	}
	return {
		roleId: role.id,
		conversationId: convo.id,
		lines: toChatLines(convo.messages_json),
		complete: convo.status === 'complete',
		spec: await loadRoleSpec(env, role.id)
	};
};

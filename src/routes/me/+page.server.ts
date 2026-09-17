import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { first } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const [pendingIntros, digestCount] = await Promise.all([
		first<{ n: number }>(env.DB, `SELECT COUNT(*) AS n FROM intros WHERE candidate_id = ? AND status = 'requested'`, user.id),
		first<{ n: number }>(env.DB, 'SELECT COUNT(*) AS n FROM digest_items WHERE candidate_id = ?', user.id)
	]);
	return { pendingIntros: pendingIntros?.n ?? 0, digestCount: digestCount?.n ?? 0 };
};

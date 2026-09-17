import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/platform';
import { IntakeLimitError, latestConversation, startAnonymousConversation, startConversation } from '$lib/server/intake/conversations';

/**
 * Get a candidate intake conversation to post to. Signed-in candidates get
 * their latest (or a new one); anyone else gets an anonymous chat tied to a
 * cookie. Called lazily by the chat panel on the first message, so merely
 * loading the homepage creates nothing.
 */
export const POST: RequestHandler = async ({ locals, cookies, request, platform }) => {
	const env = getEnv(platform);
	try {
		const user = locals.user;
		if (user?.kind === 'candidate') {
			const convo = (await latestConversation(env, user.id)) ?? (await startConversation(env, 'candidate_intake', user.id, user.id));
			return json({ id: convo.id });
		}
		const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
		const convo = await startAnonymousConversation(env, cookies, ip);
		return json({ id: convo.id });
	} catch (err) {
		if (err instanceof IntakeLimitError) return json({ message: err.message }, { status: 429 });
		throw err;
	}
};

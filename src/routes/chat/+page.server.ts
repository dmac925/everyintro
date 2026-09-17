import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { ANON_TURNS_BEFORE_SIGNIN } from '$lib/config';
import {
	IntakeLimitError,
	anonymousConversation,
	latestConversation,
	startConversation
} from '$lib/server/intake/conversations';
import { candidateHome, loadCandidateProfile } from '$lib/server/intake/drafts';
import { toChatLines } from '$lib/server/intake/engine';
import { emptyCandidateProfile } from '$lib/schemas';

// The candidate intake chat, for anonymous visitors and signed-in candidates
// alike. Nothing is created here: an anonymous visitor with no cookie gets the
// greeting and the panel starts a conversation on their first message.
export const load: PageServerLoad = async ({ locals, cookies, platform }) => {
	const user = locals.user;
	if (user?.kind === 'employer') redirect(303, '/company');
	if (user?.kind === 'admin') redirect(303, '/admin');
	const env = getEnv(platform);

	const convo = user ? await latestConversation(env, user.id) : await anonymousConversation(env, cookies);
	if (!convo) return { conversationId: null, lines: [], profile: emptyCandidateProfile(), complete: false, gated: false, signedIn: Boolean(user) };

	return {
		conversationId: convo.id,
		lines: toChatLines(convo.messages_json),
		profile: await loadCandidateProfile(env, candidateHome(convo)),
		complete: convo.status === 'complete',
		gated: !convo.user_id && (convo.status === 'complete' || convo.turns >= ANON_TURNS_BEFORE_SIGNIN),
		signedIn: Boolean(user)
	};
};

export const actions: Actions = {
	restart: async ({ locals, platform }) => {
		const user = locals.user;
		if (user?.kind !== 'candidate') redirect(303, '/chat');
		try {
			await startConversation(getEnv(platform), 'candidate_intake', user.id, user.id);
		} catch (err) {
			if (err instanceof IntakeLimitError) return fail(429, { message: err.message });
			throw err;
		}
		redirect(303, '/chat');
	}
};

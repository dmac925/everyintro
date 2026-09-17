import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/platform';
import { runIntakeTurn } from '$lib/server/intake/engine';
import { eventStream, ownedConversation } from '$lib/server/intake/access';
import { friendlyError } from '$lib/server/claude';
import { ANON_TURNS_BEFORE_SIGNIN, MAX_TURNS_PER_INTAKE } from '$lib/config';
import type { IntakeEvent } from '$lib/types';

// One intake chat turn, streamed back as NDJSON (see IntakeEvent).
export const POST: RequestHandler = async ({ params, request, locals, cookies, platform }) => {
	const env = getEnv(platform);
	const convo = await ownedConversation(env, params.id, locals.user, cookies);

	if (convo.turns >= MAX_TURNS_PER_INTAKE) {
		return json({ message: 'This chat has reached its limit. Edit your details directly, or start over.' }, { status: 429 });
	}
	// Anonymous chats stop at the sign-in gate; no model call until claimed.
	if (!convo.user_id && (convo.status === 'complete' || convo.turns >= ANON_TURNS_BEFORE_SIGNIN)) {
		return eventStream(async (emit) => emit({ type: 'gate' } satisfies IntakeEvent));
	}

	const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
	const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : '';
	if (!message) return json({ message: 'Message is empty.' }, { status: 400 });

	return eventStream(async (emit) => {
		try {
			await runIntakeTurn(env, convo, locals.user, message, emit, (p) => platform?.context?.waitUntil(p));
		} catch (err) {
			console.error('intake turn failed', err);
			emit({ type: 'error', message: friendlyError(err) } satisfies IntakeEvent);
		}
	});
};

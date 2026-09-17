import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import { userForClerkId } from '$lib/server/auth';

// Clerk verifies the session cookie and sets locals.auth(); we then attach our
// own user row (kind, email) as locals.user.
const app: Handle = async ({ event, resolve }) => {
	// The intake chat moved to /chat; keep old links working for everyone.
	if (event.url.pathname === '/me/intake') redirect(301, '/chat');

	const env = event.platform?.env;
	const { userId } = event.locals.auth();
	event.locals.user = env?.DB ? await userForClerkId(env, userId) : null;
	return resolve(event);
};

export const handle = sequence(withClerkHandler(), app);

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { revokeSession } from '$lib/server/auth';

// Server-side sign-out for plain forms. The header uses Clerk's client sign-out.
export const POST: RequestHandler = async ({ locals, cookies }) => {
	await revokeSession(locals.auth().sessionId, cookies);
	redirect(303, '/');
};

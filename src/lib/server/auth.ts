import type { Cookies } from '@sveltejs/kit';
import { clerkClient } from 'svelte-clerk/server';
import type { Env } from './env';
import type { User, UserKind } from '../types';
import { first, run } from './db';
import { claimConversation } from './intake/conversations';

// Clerk owns sessions; our `users` table owns the account kind (candidate,
// employer, admin) and is keyed on the Clerk user id. A Clerk session with no
// row yet is "signed in but not registered": /sign-in registers candidates,
// /post registers employers, and requireUser() sends anyone else to /sign-in.
// Admins: flip `kind` in D1 by hand (README).

/** Our user for the request's Clerk session, if they've registered. */
export async function userForClerkId(env: Env, clerkUserId: string | null | undefined): Promise<User | null> {
	if (!clerkUserId) return null;
	return first<User>(env.DB, 'SELECT id, email, name, kind FROM users WHERE id = ?', clerkUserId);
}

/** Create our row for a Clerk user. Existing rows win, whatever `kind` was asked for. */
export async function registerUser(env: Env, cookies: Cookies, clerkUserId: string, kind: UserKind): Promise<User> {
	const existing = await userForClerkId(env, clerkUserId);
	if (existing) return existing;

	const cu = await clerkClient.users.getUser(clerkUserId);
	const email = (cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress ?? '').toLowerCase();
	if (!email) throw new Error('Clerk user has no email address.');
	const name = [cu.firstName, cu.lastName].filter(Boolean).join(' ') || null;

	const user: User = { id: clerkUserId, email, name, kind };
	await run(env.DB, 'INSERT INTO users (id, email, name, kind) VALUES (?, ?, ?, ?)', user.id, user.email, user.name, user.kind);
	if (kind === 'candidate') {
		await run(env.DB, 'INSERT INTO candidates (user_id) VALUES (?)', user.id);
		await claimConversation(env, cookies, user); // an anonymous homepage chat comes with them
	}
	return user;
}

/** Revoke the current Clerk session server-side (used by server-rendered sign-out forms). */
export async function revokeSession(sessionId: string | null | undefined, cookies: Cookies) {
	if (sessionId) await clerkClient.sessions.revokeSession(sessionId).catch(() => undefined);
	cookies.delete('__session', { path: '/' });
}

/** Delete the Clerk user too, so a deleted account can't sign back in. */
export async function deleteClerkUser(clerkUserId: string) {
	await clerkClient.users.deleteUser(clerkUserId).catch((err) => console.error('clerk delete failed', err));
}

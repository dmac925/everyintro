import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { registerUser } from '$lib/server/auth';
import { ANON_COOKIE } from '$lib/server/intake/conversations';
import type { UserKind } from '$lib/types';

const home: Record<UserKind, string> = { candidate: '/me', employer: '/company', admin: '/admin' };

function safeNext(next: string | null): string | null {
	return next?.startsWith('/') && !next.startsWith('//') ? next : null;
}

// Clerk renders the sign-in UI. Once a session exists this page registers the
// user in our table (as a candidate by default, or `?as=employer`) and moves on.
export const load: PageServerLoad = async ({ locals, platform, url, cookies }) => {
	const next = safeNext(url.searchParams.get('next'));
	const as = (url.searchParams.get('as') === 'employer' ? 'employer' : 'candidate') as UserKind;

	if (locals.user) redirect(303, next ?? home[locals.user.kind]);
	const { userId } = locals.auth();
	if (userId) {
		const user = await registerUser(getEnv(platform), cookies, userId, as);
		redirect(303, next ?? home[user.kind]);
	}
	return {
		as,
		returnTo: url.pathname + url.search, // Clerk sends them back here after sign-in, then the load above registers them
		claiming: Boolean(cookies.get(ANON_COOKIE)) // an anonymous homepage chat will be attached on sign-in
	};
};

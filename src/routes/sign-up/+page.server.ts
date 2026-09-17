import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Sign-up shares /sign-in's registration step: Clerk returns there once the
// account exists, and that load creates our row and redirects onward.
export const load: PageServerLoad = ({ locals, url }) => {
	const returnTo = `/sign-in${url.search}`;
	if (locals.auth().userId) redirect(303, returnTo);
	return { returnTo, as: url.searchParams.get('as') === 'employer' ? 'employer' : 'candidate' };
};

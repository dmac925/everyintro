import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Employers and admins have no use for the candidate chat on the homepage.
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user?.kind === 'employer') redirect(303, '/company');
	if (locals.user?.kind === 'admin') redirect(303, '/admin');
	return {};
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireCompany, requireUser } from '$lib/server/guards';
import { all, first } from '$lib/server/db';
import { billingConfigured, createHireCheckout, type HireIntro } from '$lib/server/billing';
import type { IntroStatus } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'employer');
	const env = getEnv(platform);
	const company = await requireCompany(env, user);
	// Candidate name/email are selected ONLY for accepted intros.
	const intros = await all<{
		id: string;
		status: IntroStatus;
		role_id: string;
		role_title: string | null;
		requested_at: string;
		responded_at: string | null;
		decline_reason: string | null;
		hired_at: string | null;
		candidate_name: string | null;
		candidate_email: string | null;
	}>(
		env.DB,
		`SELECT i.id, i.status, i.role_id, r.title AS role_title, i.requested_at, i.responded_at, i.decline_reason, i.hired_at,
			CASE WHEN i.status = 'accepted' THEN u.name END AS candidate_name,
			CASE WHEN i.status = 'accepted' THEN u.email END AS candidate_email
		 FROM intros i JOIN roles r ON r.id = i.role_id JOIN users u ON u.id = i.candidate_id
		 WHERE i.company_id = ?
		 ORDER BY i.requested_at DESC`,
		company.id
	);
	return { intros, paid: url.searchParams.has('paid'), cancelled: url.searchParams.has('cancelled') };
};

export const actions: Actions = {
	// The employer tells us they hired someone they met through an intro, and
	// pays the flat fee. The webhook sets hired_at once Stripe confirms.
	hired: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'employer');
		const env = getEnv(platform);
		const company = await requireCompany(env, user);
		const id = String((await request.formData()).get('introId'));
		const intro = await first<HireIntro>(
			env.DB,
			`SELECT i.id, i.role_id, r.title AS role_title FROM intros i JOIN roles r ON r.id = i.role_id
			 WHERE i.id = ? AND i.company_id = ? AND i.status = 'accepted' AND i.hired_at IS NULL`,
			id,
			company.id
		);
		if (!intro) return fail(404, { message: 'Only accepted intros that aren’t already marked as hired can be recorded.' });
		if (!billingConfigured(env)) {
			return fail(402, { message: 'Billing isn’t configured (set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).' });
		}
		redirect(303, await createHireCheckout(env, company, intro, user.email));
	}
};

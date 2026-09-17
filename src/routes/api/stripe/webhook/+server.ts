import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/platform';
import { verifyStripeSignature } from '$lib/server/billing';
import { run } from '$lib/server/db';

// Stripe → checkout.session.completed records the paid hire on the intro.
// Configure in Stripe: endpoint {PUBLIC_BASE_URL}/api/stripe/webhook, event checkout.session.completed.
export const POST: RequestHandler = async ({ request, platform }) => {
	const env = getEnv(platform);
	if (!env.STRIPE_WEBHOOK_SECRET) error(503, 'Billing not configured.');

	const payload = await request.text();
	const ok = await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, payload, request.headers.get('stripe-signature'));
	if (!ok) error(400, 'Invalid signature.');

	const event = JSON.parse(payload) as {
		type: string;
		data: { object: { id: string; payment_status?: string; metadata?: Record<string, string> } };
	};
	if (event.type !== 'checkout.session.completed') return json({ ignored: event.type });

	const session = event.data.object;
	if (session.payment_status !== 'paid') return json({ pending: true });

	// Idempotent: only the first delivery flips pending → paid and marks the hire.
	const updated = await run(
		env.DB,
		`UPDATE billing_events SET status = 'paid' WHERE stripe_session_id = ? AND status = 'pending'`,
		session.id
	);
	if (!updated.meta.changes) return json({ duplicate: true });

	const introId = session.metadata?.intro_id;
	if (introId) {
		await run(env.DB, `UPDATE intros SET hired_at = datetime('now') WHERE id = ? AND hired_at IS NULL`, introId);
	}
	return json({ received: true });
};

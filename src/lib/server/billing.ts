import type { Env } from './env';
import type { CompanyRow } from '../types';
import { HIRE_PRICE_PENCE } from '../config';
import { newId, run } from './db';

// Roles and intros are free. When an accepted intro becomes a hire, the
// employer pays HIRE_PRICE_PENCE once via Stripe Checkout (no subscription).

export function billingConfigured(env: Env): boolean {
	return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

export interface HireIntro {
	id: string;
	role_id: string;
	role_title: string | null;
}

/** Create a Checkout Session for one hire; returns the URL to redirect to. */
export async function createHireCheckout(env: Env, company: CompanyRow, intro: HireIntro, email: string): Promise<string> {
	const base = env.PUBLIC_BASE_URL ?? 'http://localhost:5173';
	const billingId = newId();
	const body = new URLSearchParams({
		mode: 'payment',
		customer_email: email,
		success_url: `${base}/company/intros?paid=1`,
		cancel_url: `${base}/company/intros?cancelled=1`,
		'line_items[0][quantity]': '1',
		'line_items[0][price_data][currency]': 'gbp',
		'line_items[0][price_data][unit_amount]': String(HIRE_PRICE_PENCE),
		'line_items[0][price_data][product_data][name]': `EveryIntro hire: ${intro.role_title ?? 'Untitled role'}`,
		'metadata[intro_id]': intro.id,
		'metadata[role_id]': intro.role_id,
		'metadata[company_id]': company.id,
		'metadata[billing_id]': billingId
	});
	const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
		method: 'POST',
		headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) throw new Error(`Stripe checkout failed: ${res.status} ${await res.text()}`);
	const session = (await res.json()) as { id: string; url: string };
	await run(
		env.DB,
		'INSERT INTO billing_events (id, company_id, role_id, intro_id, amount_pence, stripe_session_id) VALUES (?, ?, ?, ?, ?, ?)',
		billingId,
		company.id,
		intro.role_id,
		intro.id,
		HIRE_PRICE_PENCE,
		session.id
	);
	return session.url;
}

/** Verify a Stripe-Signature header (t=…,v1=…) with HMAC-SHA256. */
export async function verifyStripeSignature(secret: string, payload: string, header: string | null, toleranceSec = 300) {
	if (!header) return false;
	const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
	const timestamp = Number(parts.t);
	if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
	const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
	const signatures = header
		.split(',')
		.filter((kv) => kv.startsWith('v1='))
		.map((kv) => kv.slice(3));
	return signatures.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

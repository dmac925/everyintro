import Anthropic from '@anthropic-ai/sdk';
import type { Env } from './env';
import { run } from './db';
import { MODEL, PRICE_USD_PER_MTOK, USD_TO_GBP } from '../config';

// Every request opts into server-side refusal fallbacks: if Opus 5 declines,
// the API re-runs the same request on Anthropic's recommended fallback model
// inside the same call. Not available on the Batches API.
export const FALLBACK = {
	betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[],
	fallbacks: 'default' as const
};

/** Model for this environment: production uses config MODEL; dev may override (e.g. claude-sonnet-5). */
export function modelFor(env: Env): string {
	return env.MODEL_OVERRIDE || MODEL;
}

/** Scripted, zero-cost intake and matching for UI development. See intake/mock.ts. */
export function mockMode(env: Env): boolean {
	return env.LLM_MODE === 'mock';
}

export function claude(env: Env): Anthropic {
	if (!env.ANTHROPIC_API_KEY) {
		throw new Error('ANTHROPIC_API_KEY is not set. Add it to .dev.vars or `wrangler secret put`.');
	}
	return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export type Purpose = 'candidate_intake' | 'role_intake' | 'rerank' | 'digest';

export class BudgetExceededError extends Error {}

/**
 * Hard daily stop on AI spend, from the llm_usage log at list prices. Set
 * LLM_DAILY_BUDGET_GBP in .dev.vars (or as a production var if you want a
 * ceiling there too). Unset = no cap. Call before any paid model call.
 */
export async function assertWithinBudget(env: Env) {
	const cap = Number(env.LLM_DAILY_BUDGET_GBP);
	if (!cap || !Number.isFinite(cap)) return;
	const spent = await spentTodayGbp(env);
	if (spent >= cap) {
		throw new BudgetExceededError(`Daily AI budget of £${cap} reached (spent £${spent.toFixed(2)}). Raise LLM_DAILY_BUDGET_GBP or switch LLM_MODE=mock.`);
	}
}

export async function spentTodayGbp(env: Env): Promise<number> {
	const { results } = await env.DB.prepare(
		`SELECT model, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
			SUM(cache_read_tokens) AS cr, SUM(cache_write_tokens) AS cw
		 FROM llm_usage WHERE created_at > datetime('now', 'start of day') GROUP BY model`
	).all<{ model: string; input: number; output: number; cr: number; cw: number }>();
	return results.reduce((sum, r) => sum + costGbp(r.model, r.input, r.output, r.cr, r.cw), 0);
}

/** List-price cost in GBP; cache reads ~0.1× input, cache writes ~1.25× input. */
export function costGbp(model: string, input: number, output: number, cacheRead = 0, cacheWrite = 0): number {
	const price = PRICE_USD_PER_MTOK[model] ?? PRICE_USD_PER_MTOK[MODEL];
	const usd = (input * price.input + cacheRead * price.input * 0.1 + cacheWrite * price.input * 1.25 + output * price.output) / 1e6;
	return usd * USD_TO_GBP;
}

/** Record token usage so /admin can report real spend. Never throws. */
export async function logUsage(
	env: Env,
	purpose: Purpose,
	subjectId: string | null,
	message: Pick<Anthropic.Beta.BetaMessage, 'model' | 'usage'>
) {
	const u = message.usage;
	try {
		await run(
			env.DB,
			`INSERT INTO llm_usage (purpose, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, subject_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			purpose,
			message.model,
			u.input_tokens,
			u.output_tokens,
			u.cache_read_input_tokens ?? 0,
			u.cache_creation_input_tokens ?? 0,
			subjectId
		);
	} catch (err) {
		console.error('logUsage failed', err);
	}
}

/** Map SDK errors to something safe to show a user. */
export function friendlyError(err: unknown): string {
	if (err instanceof BudgetExceededError) return err.message;
	if (err instanceof Anthropic.RateLimitError) return 'We are busy right now. Try again in a minute.';
	if (err instanceof Anthropic.AuthenticationError) return 'The AI service is not configured correctly.';
	if (err instanceof Anthropic.APIError) return 'The AI service had a problem. Please try again.';
	if (err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')) return err.message;
	return 'Something went wrong. Please try again.';
}

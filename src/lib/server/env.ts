// Bindings and secrets, shared by the SvelteKit app and workers/jobs.
// Everything under src/lib/server uses relative imports (no $lib) so the jobs
// worker can bundle it.

export type JobMessage =
	| { type: 'match_role'; roleId: string }
	| { type: 'embed_candidate'; candidateId: string }
	| { type: 'ingest_source'; source: string; board: string }
	| { type: 'digest_candidate'; candidateId: string };

export interface Env {
	DB: D1Database;
	AI?: Ai;
	VECTORIZE?: VectorizeIndex;
	JOBS_QUEUE?: Queue<JobMessage>;
	CV_BUCKET?: R2Bucket;

	ANTHROPIC_API_KEY?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_WEBHOOK_SECRET?: string;

	PUBLIC_BASE_URL?: string;
	CLERK_SECRET_KEY?: string; // read by svelte-clerk via $env/dynamic/private
	PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
	INLINE_JOBS?: string; // "true" runs queue jobs in-process (local dev)
	VECTOR_SEARCH?: string; // "false" skips Workers AI + Vectorize (local dev)
	LLM_MODE?: string; // "mock" = scripted intake/matching, no API calls (local dev)
	MODEL_OVERRIDE?: string; // e.g. claude-sonnet-5 to develop against a cheaper model
	LLM_DAILY_BUDGET_GBP?: string; // hard daily stop on AI spend, from llm_usage; unset = no cap
}

// Product rules and cost guardrails in one place. Safe to import from the
// browser (no secrets). Server modules import this relatively, not via $lib,
// because workers/jobs bundles them too.

// ── Pricing ────────────────────────────────────────────────────────────────
// Roles and intros are free. A flat fee is due when an accepted intro becomes
// a hire: the employer marks it on /company/intros and pays by card.
export const HIRE_PRICE_PENCE = 50_000; // £500
export const HIRE_REFUND_DAYS = 90; // full refund if the hire leaves within this
export const ROLE_LIVE_DAYS = 60;

// ── Intros ─────────────────────────────────────────────────────────────────
export const INTRO_EXPIRY_DAYS = 14;

// ── Matching ───────────────────────────────────────────────────────────────
export const SHORTLIST_SIZE = 50; // max candidates Claude reranks per run
export const CARDS_PER_ROLE = 5; // shown to the employer at once
export const MAX_CARDS_PER_ROLE = 20; // hard cap on "show more" per role
export const MIN_FIT_TO_SHOW = 4; // 1–5; show fewer cards rather than weak ones
// A candidate who raised a hand is shown one fit band lower than the cutoff.
export const INTEREST_LIFTS_FIT = 1;

// ── Follow-up questions (issues #13, #14) ──────────────────────────────────
// One small screening call per candidate per question (see server/questions.ts).
export const QUESTIONS_PER_ROLE = 30; // lifetime cap per role, batches count per candidate
export const QUESTIONS_PER_CANDIDATE_PER_WEEK = 5; // across all roles; refused ones don't count
export const QUESTION_BATCH_MAX = 10; // cards per ask
export const QUESTION_MAX_CHARS = 300;
export const REMATCH_MIN_DAYS = 7; // automatic re-runs per open role, at most weekly
export const MANUAL_REFRESH_MIN_HOURS = 24;

// ── Intake cost guards ─────────────────────────────────────────────────────
export const MAX_TURNS_PER_INTAKE = 30; // user messages per conversation
export const MAX_INTAKES_PER_30_DAYS = 3; // new conversations per candidate / role
export const MAX_TOOL_ROUNDS_PER_TURN = 6;
// Homepage chat runs before sign-up. These bound the unpaid, unauthenticated
// spend: turns per anonymous chat before we ask for an email, and chats per IP.
export const ANON_TURNS_BEFORE_SIGNIN = 4;
export const ANON_CHATS_PER_IP_PER_DAY = 5;
export const CV_MAX_BYTES = 4 * 1024 * 1024;

// ── Public jobs + digest ───────────────────────────────────────────────────
export const PUBLIC_JOB_STALE_DAYS = 3; // drop listings not seen for this long
export const DIGEST_ACTIVE_DAYS = 30; // only digest candidates active recently
export const DIGEST_JOBS_CONSIDERED = 20;
export const DIGEST_MAX_CANDIDATES_PER_RUN = 500; // skip-not-fail cap

// ── Models ─────────────────────────────────────────────────────────────────
// One model everywhere to start. Sonnet 5 (claude-sonnet-5) is the obvious
// cost lever for intake chats if measured quality holds, see /admin.
export const MODEL = 'claude-opus-5';
export const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5'; // 768 dims

// List prices (USD per million tokens) used only for the /admin estimate.
export const PRICE_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
	'claude-opus-5': { input: 5, output: 25 },
	'claude-sonnet-5': { input: 2, output: 10 },
	'claude-haiku-4-5': { input: 1, output: 5 }
};
export const USD_TO_GBP = 0.75;

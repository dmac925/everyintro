# EveryIntro

Open-source AI hiring marketplace. An AI chats with candidates, another with employers, and a matcher shortlists in between. Intros are double opt-in. Free for candidates. Employers post roles and request intros free, and pay a flat £500 per hire, refunded if the hire leaves within 90 days. No salary cut.

Source: https://github.com/dmac925/everyintro · Roadmap: [ROADMAP.md](ROADMAP.md) · Licence: AGPL-3.0-only (see [Licence](#licence)) · Security: [SECURITY.md](SECURITY.md)

**Status: pre-launch.** Every page, route, table and pipeline stage exists, type-checks and runs on Cloudflare with Clerk auth. Email is still a console stub, Stripe isn't connected to a live account, and there are no tests yet — see [What's left](#whats-left--todo).

## Positioning

A significantly cheaper Jack & Jill. Same product shape (AI agent on each side, consent-based warm intros), but a flat fee instead of 10% of first-year salary, mission-driven for both sides, and open source. Brand constants, the tagline and every comparative claim (with source URL and `checked` date) live in `src/lib/brand.ts`; the marketing pages (`/`, `/employers`, `/candidates`, `/pricing`, `/mission`) read from there. Re-verify the competitor's pricing page before each release — comparative claims must stay accurate.

## Design

The visual system comes from the Claude Design canvas exported to `EveryIntro mobile redesign/` (option 1c "Ink & amber", plus its desktop and chat screens). Tokens and shared component classes live in `src/routes/layout.css`; every page uses those classes rather than its own styles. Newsreader (serif, weight 400) for headings and the wordmark, Manrope for text, cream ground, ink header and primary actions, one amber accent. The chat renders assistant turns as plain text with an amber dot, user turns as ink bubbles, and **inline choice cards** for hard-to-type answers (the live agent calls `offer_choices`; mock mode emits the same cards). House rule: no em dashes in copy (`npm run check:copy`).

## Stack

SvelteKit 2 (Svelte 5 runes) + Tailwind v4 on Cloudflare Workers · D1 · Queues · Vectorize + Workers AI embeddings · R2 · Claude API (`claude-opus-5`) · Stripe Checkout.

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars      # add ANTHROPIC_API_KEY
npm run db:migrate:local
npm run db:seed:local               # example public job boards
npm run dev                         # http://localhost:5173
```

Auth is Clerk (`svelte-clerk`). `clerk env pull --file .env.clerk` then copy the two keys into `.env` as `PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (both gitignored; `vite dev` reads `.env`). Candidates sign in at `/sign-in`; employers start at `/post`, which verifies a work email with a Clerk email code and needs a non-free-mail domain (e.g. `jane@acme.co.uk`). Our `users` row is keyed on the Clerk user id and holds the account kind. To make yourself admin: `npx wrangler d1 execute everyintro --local --command "UPDATE users SET kind='admin' WHERE email='you@example.com'"`.

**Developing without burning credits.** `.dev.vars` ships with `LLM_MODE=mock` (scripted chat and matching, zero API calls — use it for all UI work), `MODEL_OVERRIDE=claude-sonnet-5` (when you set `LLM_MODE=live`, replies come from Sonnet 5 at ~60% less than Opus), and `LLM_DAILY_BUDGET_GBP=2` (a hard stop computed from the `llm_usage` log; `/admin` shows today's spend against it). Production ignores all three unless you set them as Worker vars.

In local dev (`.dev.vars`): queue jobs run in-process (`INLINE_JOBS=true`) and vector search is off (`VECTOR_SEARCH=false`) because Workers AI and Vectorize only run remotely and bill even from local dev. The matcher then shortlists by recency. Public-job digests need vectors, so they only run deployed.

Jobs worker locally (cron + queue consumer): `npm run jobs:dev`, then trigger crons at `http://localhost:8787/__scheduled?cron=0+5+*+*+*`.

## Layout

```
src/
  lib/
    config.ts            product rules + cost guardrails (hire fee, caps, model) — start here
    schemas.ts           zod: CandidateProfile, RoleSpec, rerank/digest outputs
    types.ts             D1 row types, UI types
    copy.ts              chat greetings (shared by UI and prompts)
    components/          ChatPanel, ProfileCard, RoleSpecCard, MatchCard, StatusPill, header/footer
    server/              ⚠ relative imports only — workers/jobs bundles this too
      env.ts             bindings + JobMessage
      claude.ts          client, refusal fallbacks, usage logging
      auth.ts            Clerk session → our users row (registerUser, revokeSession)
      guards.ts          requireUser / requireCompany (app-only)
      intake/            chat engine (streaming tool loop), prompts, tools, drafts
      matching/          filters (SQL) → shortlist (vectors) → rerank (Claude) → upsert
      jobs/              dispatch, queue handlers, cron (daily/weekly), ATS ingest, digest
      billing.ts         per-hire Stripe Checkout, webhook signature check
      roles.ts           open role, request intro
      email.ts           STUB — logs to console
  routes/
    /, /candidates, /employers, /pricing, /privacy, /sign-in
    /chat                the candidate intake chat (anonymous or signed in); profile builds alongside
    /me                  candidate: home, profile, intros, jobs (/me/intake redirects to /chat)
    /post                employer front door: verify work email by code, then the role chat on the same page
    /company             employer: roles, setup, roles/[id] (shortlist), roles/[id]/intake, intros, billing
    /admin               counts + measured AI spend (from llm_usage)
    /api/intake/start    POST → conversation id (anonymous from the homepage, or the candidate's own)
    /api/intake/[id]     POST one chat turn → NDJSON stream
    /api/intake/[id]/import  POST CV (PDF/text) or linkedin_url → same stream; agent fills the profile
    /api/stripe/webhook  checkout.session.completed → record the paid hire on the intro
workers/jobs/            cron triggers + queue consumer (separate Worker)
migrations/              D1 schema (+ seed/)
```

### Homepage → /chat

The homepage shows a chat *starter*: the first message (or CV / LinkedIn URL) is carried client-side to `/chat` (`src/lib/client/pending.ts`), where the conversation runs and the profile builds beside it — a sticky card on desktop, a progress strip that opens a bottom sheet on mobile (`ProfileProgress.svelte`). Nothing is created until that first message; then `/api/intake/start` opens an anonymous conversation keyed by an `ei_anon` cookie, with the profile draft in `conversations.draft_json`. After `ANON_TURNS_BEFORE_SIGNIN` turns (or a completed profile) the stream emits `gate` and the panel shows a sign-in link. Sign-in claims the conversation (`claimConversation`): draft → `candidates` row, transcript kept. Anonymous spend is bounded by that turn cap and `ANON_CHATS_PER_IP_PER_DAY`.

**CV / LinkedIn import** (`/api/intake/[id]/import`) sends the material into the same chat as one turn, so the agent reads it, fills the profile with `update_profile` and then asks only about what a CV can't answer (the rules are in `CANDIDATE_SYSTEM`). PDFs go to the model as a document block; Word `.docx` files are unzipped to text server-side (`server/intake/cv.ts`, via `fflate`); the original is stored in R2 when bound and replaced by a placeholder in the saved transcript. LinkedIn blocks unauthenticated profile reads, so the URL path usually fails; the response then carries `guidance`, which the chat shows as a reply and opens a paste box (`linkedin_text`), and the *Save to PDF* export works through the CV path. In `LLM_MODE=mock`, text imports are read by a crude script so the flow can be exercised for free.

### How a match happens

1. Employer finishes the role chat (from `/post` or `/company`) → `/company/roles/[id]` → **Open role** (free; the fee is per hire).
2. `openRole` dispatches `match_role` → `runMatchForRole`: SQL hard filters (salary, right to work, work mode, not already matched) → vector shortlist to 50 → one Claude call scores all 50 with reasons and gaps (structured output) → `matches`.
3. Employer sees up to 5 blind cards with fit ≥ 4 → **Request intro** → candidate sees it at `/me/intros` → **Accept** reveals name and email.
4. Daily cron re-runs open roles at most weekly, and only reranks candidates new to that role.

## Costs (read before changing cadence or caps)

All guardrails are in `src/lib/config.ts`. Every Claude call logs tokens to `llm_usage`; `/admin` shows real spend. Rough list-price estimates from the plan: candidate intake ~£0.30, role intake ~£0.30, match run ~£0.20–0.40, weekly digest ~£0.06 per active candidate. Candidate intake is the biggest unpaid cost, so it's capped (30 turns per chat, 3 chats per 30 days). Crons are daily and weekly by design.

## Deploy

```bash
npx wrangler d1 create everyintro                 # paste id into both wrangler.jsonc files
npx wrangler queues create everyintro-jobs
npx wrangler queues create everyintro-jobs-dlq
npx wrangler vectorize create everyintro --dimensions=768 --metric=cosine
npx wrangler vectorize create-metadata-index everyintro --property-name=kind --type=string
npx wrangler r2 bucket create everyintro-cvs
npx wrangler secret put ANTHROPIC_API_KEY        # and again with -c workers/jobs/wrangler.jsonc
npx wrangler secret put CLERK_SECRET_KEY         # app worker only
npm run db:migrate:remote
npm run deploy && npm run jobs:deploy
```

`wrangler.jsonc` vars are production-safe defaults: set `PUBLIC_BASE_URL`, `PUBLIC_CLERK_PUBLISHABLE_KEY` and `LLM_DAILY_BUDGET_GBP` for your deployment. Stripe: `wrangler secret put STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and point a Stripe webhook at `/api/stripe/webhook`.

## What's left / TODO

Search the code for `TODO(` to find each one in place.

- **auth**: Clerk is wired (sessions, email-code sign-in, `/post` flow). Still to do: Clerk Organisations for employer teams (today a colleague on the same domain auto-joins the company), and a production Clerk instance with its `pk_live_` key in `wrangler.jsonc` and `sk_live_` via `wrangler secret put CLERK_SECRET_KEY`.
- **email**: `server/email.ts` only logs. Wire Cloudflare Email Service, and give accepted intros a proper email thread.
- **verify**: Companies House API check for employers. Team invites instead of auto-joining by domain.
- **matching**: feed pass and decline reasons into the rerank prompt. Re-score candidates whose profile changed. Location distance.
- **cost**: move scheduled reranks and digests to the Message Batches API (50% cheaper).
- **ingest**: tighten the UK "remote" filter, parse Ashby compensation, replace the example boards in `migrations/seed`.
- **profile**: add a skills editor, and let candidates upload a CV to R2 that's released on accept.
- **billing**: VAT receipts. Hires are self-reported by the employer (`/company/intros` → Stripe); consider asking the candidate to confirm too.
- **legal**: real privacy notice and DPIA (`/privacy` is a structure only).
- **tests**: none yet.

## Contributing

Issues and pull requests are welcome. Run `npm run check` (app) and `npx tsc -p workers/jobs/tsconfig.json` (worker) before opening one; both must pass, and site copy can't contain em dashes. If you change a comparative claim about another service, update its `checked` date and source in `src/lib/brand.ts`.

## Licence

The code is licensed under the GNU Affero General Public License v3.0 only (see [LICENSE](LICENSE)). You can run it, change it and run a modified copy, but if you offer a modified version as a service you must publish your changes under the same licence.

The **EveryIntro name, wordmark and logo are not covered by this licence** and may not be used to name or promote a fork or a hosted copy. Call yours something else.

# Roadmap

What we're building next and why, in order. Each item is a GitHub issue with the design notes; pick from there. The product principles behind the order: candidates stay anonymous until they say yes, both sides see the same honest reasons, and speed of response is the product.

Where the flow stands today: an employer opens a role, the matcher scores the pool, the employer sees five blind cards, requests an intro, and the candidate accepts or declines. Everything is employer-initiated and the weekly rematch doesn't yet learn from passes or declines.

## 1. Launch blockers

Nothing below matters until real people can use the service safely.

- [#1](https://github.com/dmac925/everyintro/issues/1) Send real email. Every step in the connection flow depends on a notification.
- [#2](https://github.com/dmac925/everyintro/issues/2) Stripe live account and the per-hire checkout tested end to end.
- [#3](https://github.com/dmac925/everyintro/issues/3) CV and LinkedIn import into the candidate chat. *In progress.*
- [#4](https://github.com/dmac925/everyintro/issues/4) Custom domain and production Clerk instance.
- [#5](https://github.com/dmac925/everyintro/issues/5) Privacy notice and DPIA.
- [#6](https://github.com/dmac925/everyintro/issues/6) Tests that lock the blind-by-default rule, running in CI.

## 2. Connection: let candidates take part

- [#7](https://github.com/dmac925/everyintro/issues/7) Candidates can mark "interested" on roles that fit. Shows as a badge on the employer's card, still anonymous.
- [#8](https://github.com/dmac925/everyintro/issues/8) Candidates see the gaps as well as the reasons.
- [#9](https://github.com/dmac925/everyintro/issues/9) Shorter intro expiry with nudges, and a "paused" state so employers aren't left waiting.

## 3. Employer view: work a shortlist, not read a list

- [#10](https://github.com/dmac925/everyintro/issues/10) The role page becomes a pipeline: Shortlist, Asked, Talking, Hired.
- [#11](https://github.com/dmac925/everyintro/issues/11) Show five more cards at a time, with a hard cap. Fewer cards still beats padded ones.
- [#12](https://github.com/dmac925/everyintro/issues/12) Pass and decline reasons feed the next rerank.

## 4. Anonymous follow-up questions through the agent

The strongest differentiator on the list. The employer asks; the agent answers from the profile if it can, otherwise asks the candidate in their own chat. Nobody is revealed, and questions that fish for identity are rewritten or refused.

- [#13](https://github.com/dmac925/everyintro/issues/13) Single-card questions.
- [#14](https://github.com/dmac925/everyintro/issues/14) Batch questions to a set of cards.

## 5. Later

- [#15](https://github.com/dmac925/everyintro/issues/15) Employer teams via Clerk Organisations.
- [#16](https://github.com/dmac925/everyintro/issues/16) Verify employers against Companies House.
- [#17](https://github.com/dmac925/everyintro/issues/17) Export to the employer's ATS.
- [#18](https://github.com/dmac925/everyintro/issues/18) Go global: per-country currency, salary and right-to-work.

## How to use this

Take the top open issue in the earliest section, comment that you're on it, and add the `in-progress` label. Cost guardrails live in `src/lib/config.ts`; any item that adds a Claude call must log usage and estimate spend in the PR. Keep the blind rule in every new query.

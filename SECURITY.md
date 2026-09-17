# Security

EveryIntro handles candidates' personal data and employer accounts, so we want to hear about vulnerabilities before anyone else does.

## Reporting

Use GitHub's private vulnerability reporting on this repository: open the **Security** tab and choose **Report a vulnerability**. Please don't open a public issue for anything exploitable.

Include what you found, how to reproduce it, and what it exposes. We'll acknowledge within three working days and keep you updated until it's fixed.

## Scope

- This codebase and the hosted service at everyintro.
- Especially: anything that reveals a candidate's name, contact details or salary floor to an employer without an accepted intro; auth or session bypass; access to another company's roles, matches or intros; prompt injection that changes matching or leaks data.

## Out of scope

- Rate limits on the anonymous chat behaving as documented in `src/lib/config.ts`.
- Findings against third-party services we use (Cloudflare, Clerk, Stripe, Anthropic); report those to them.

Thank you for looking.

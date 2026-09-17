// User-facing strings shared between the UI and the intake prompts, so the
// model knows exactly what the person has already been shown.

export const CANDIDATE_GREETING =
	"Hi. I'm here to understand what you want from your next role, so I only put jobs in front of you that genuinely fit. No CV needed. What do you do at the moment, and what's making you look?";

export const ROLE_GREETING =
	"Let's pin down who you're looking for. Paste a job description if you have one, or just tell me about the role and the team, and I'll ask about anything that's missing.";

// Homepage chat opens with a broader first question than the signed-in intake,
// since the visitor may be a passive looker rather than actively searching.
export const HOME_GREETING =
	"Hi. What do you do, and what would you want from your next role? Or drop in your CV and I'll do the reading.";

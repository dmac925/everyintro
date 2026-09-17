import type { Env } from './env';

// TODO(email): send through Cloudflare Email Service (load the
// cloudflare-email-service skill for the binding + SPF/DKIM setup). Until then
// messages are logged so flows can be exercised locally.

export interface Email {
	to: string;
	subject: string;
	text: string;
}

export async function sendEmail(_env: Env, email: Email): Promise<void> {
	console.log(`[email stub] to=${email.to} subject="${email.subject}"\n${email.text}`);
}

const base = (env: Env) => env.PUBLIC_BASE_URL ?? 'http://localhost:5173';

export const templates = {
	introRequested: (env: Env, roleTitle: string, companyName: string): Omit<Email, 'to'> => ({
		subject: `${companyName} would like an intro: ${roleTitle}`,
		text: `A company would like to talk to you about "${roleTitle}". They can't see your name or contact details unless you accept.\n\nReview it: ${base(env)}/me/intros`
	}),
	introAccepted: (env: Env, roleTitle: string, candidateName: string, candidateEmail: string): Omit<Email, 'to'> => ({
		subject: `Intro accepted: ${roleTitle}`,
		text: `${candidateName} accepted your intro request for "${roleTitle}".\nEmail: ${candidateEmail}\n\n${base(env)}/company/intros`
	}),
	digest: (env: Env, lines: string[]): Omit<Email, 'to'> => ({
		subject: 'Roles that fit you this week',
		text: `${lines.join('\n\n')}\n\nSee them all: ${base(env)}/me/jobs`
	})
};

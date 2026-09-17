// Consumer mail domains. EveryIntro is for direct employers, so an employer
// account needs a work address. Shared by the server and the /post page.
export const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com']);

export function isFreeMail(email: string): boolean {
	const domain = email.split('@')[1]?.toLowerCase();
	return !domain || FREE_MAIL.has(domain);
}

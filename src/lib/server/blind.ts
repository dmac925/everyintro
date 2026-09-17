// Last line of defence for blind matching: even though the intake prompt asks
// for identity-free summaries, strip anything we know identifies the person.

export function scrubIdentity(text: string, identifiers: (string | null | undefined)[]): string {
	let out = text;
	for (const raw of identifiers) {
		if (!raw) continue;
		for (const part of raw.split(/[\s@.]+/).filter((p) => p.length > 2)) {
			out = out.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'), '[redacted]');
		}
	}
	// Emails, phone numbers and URLs never belong in a blind summary.
	return out
		.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[redacted]')
		.replace(/\+?\d[\d\s-]{8,}\d/g, '[redacted]')
		.replace(/https?:\/\/\S+/g, '[redacted]');
}

function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

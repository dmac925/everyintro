// Brand and positioning constants. Marketing pages and prompts read from here
// so the name, tagline and competitor facts live in one place.
//
// Comparative claims must stay factual and dated (UK CAP Code / BPR 2008).
// Re-check the sources before each release and update `checked`.

export const BRAND = 'EveryIntro';
export const DOMAIN = 'everyintro.co.uk';
export const TAGLINE = 'Hiring that works for both sides. No cut of anyone’s salary.';
export const REPO_URL = 'https://github.com/dmac925/everyintro';

// What a company would pay elsewhere for the same hire. Sources are public
// pricing pages; keep the quotes verbatim so the comparison is defensible.
// Pages show the generic `name`, never the firm the figure was sourced from.
export const COMPETITORS = {
	aiRecruiter: {
		name: 'Other AI recruiters',
		sourcedFrom: 'Jack & Jill',
		feePct: 10,
		basis: 'first-year salary',
		quote: '10%, only when Jill makes a hire … If a hire leaves or is dismissed in the first 3 months, you get a full refund.',
		source: 'https://www.jackandjill.ai/pricing',
		checked: '2026-09-16'
	},
	agency: {
		name: 'A typical UK agency',
		feePct: 20,
		basis: 'first-year salary',
		note: 'Contingency agencies commonly charge 15–30%; 20% is used as a mid-point illustration.'
	}
} as const;

// Example salaries for the fee calculator, in GBP.
export const EXAMPLE_SALARIES = [35_000, 50_000, 65_000, 85_000, 120_000] as const;

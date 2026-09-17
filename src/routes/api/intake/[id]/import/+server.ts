import { json } from '@sveltejs/kit';
import type Anthropic from '@anthropic-ai/sdk';
import type { RequestHandler } from './$types';
import { getEnv } from '$lib/server/platform';
import { runIntakeTurn, type UserTurn } from '$lib/server/intake/engine';
import { eventStream, ownedConversation } from '$lib/server/intake/access';
import { candidateHome, saveCvKey } from '$lib/server/intake/drafts';
import { friendlyError } from '$lib/server/claude';
import { ANON_TURNS_BEFORE_SIGNIN, CV_MAX_BYTES } from '$lib/config';
import type { IntakeEvent } from '$lib/types';

// Auto-build the profile from a CV upload or a LinkedIn URL. Either way the
// material becomes one chat turn: the intake agent reads it, calls
// update_profile as usual, then asks only about what's missing. Same stream
// format as a normal turn.
//
// LinkedIn blocks unauthenticated profile reads, so the URL path usually
// falls back to telling the candidate to use LinkedIn's own "Save to PDF".

const CV_INSTRUCTION =
	"Here's my CV. Fill in my profile from it (skills with evidence, titles, seniority, years, location), tell me briefly what you took from it, then ask me only about what's missing: what I want next, my salary floor, work mode, right to work and notice.";

export const POST: RequestHandler = async ({ params, request, locals, cookies, platform }) => {
	const env = getEnv(platform);
	const convo = await ownedConversation(env, params.id, locals.user, cookies);
	if (convo.kind !== 'candidate_intake') return json({ message: 'Import is for candidate profiles.' }, { status: 400 });
	if (!convo.user_id && convo.turns >= ANON_TURNS_BEFORE_SIGNIN) {
		return eventStream(async (emit) => emit({ type: 'gate' } satisfies IntakeEvent));
	}

	const form = await request.formData();
	const cv = form.get('cv');
	const linkedin = String(form.get('linkedin_url') ?? '').trim();

	let turn: UserTurn;
	let cvKey: string | null = null;

	if (cv instanceof File && cv.size > 0) {
		if (cv.size > CV_MAX_BYTES) return json({ message: `CV must be under ${CV_MAX_BYTES / 1024 / 1024} MB.` }, { status: 413 });
		const name = cv.name.replace(/[^\w.\- ]/g, '').slice(0, 80) || 'cv';
		const isPdf = cv.type === 'application/pdf' || /\.pdf$/i.test(cv.name);
		const isText = cv.type.startsWith('text/') || /\.(txt|md)$/i.test(cv.name);
		if (!isPdf && !isText) {
			return json({ message: 'Upload a PDF (or plain text). Word documents: export to PDF first.' }, { status: 415 });
		}
		const bytes = await cv.arrayBuffer();
		if (env.CV_BUCKET) {
			// Kept for release to an employer after an accepted intro. TODO(intros): actually release it.
			cvKey = `cv/${convo.user_id ?? `anon/${convo.id}`}/${name}`;
			await env.CV_BUCKET.put(cvKey, bytes, { httpMetadata: { contentType: isPdf ? 'application/pdf' : 'text/plain' } });
			await saveCvKey(env, candidateHome(convo), cvKey);
		}
		const doc: Anthropic.Beta.BetaContentBlockParam = isPdf
			? { type: 'document', title: name, source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) } }
			: { type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: new TextDecoder().decode(bytes).slice(0, 40_000) } };
		turn = [{ type: 'text', text: CV_INSTRUCTION }, doc];
	} else if (linkedin) {
		if (!/^https?:\/\/([\w-]+\.)?linkedin\.com\/in\/[\w\-%]+\/?/i.test(linkedin)) {
			return json({ message: 'That doesn’t look like a LinkedIn profile URL (linkedin.com/in/…).' }, { status: 400 });
		}
		const text = await fetchLinkedInPublic(linkedin);
		if (!text) {
			return json(
				{
					message:
						'LinkedIn doesn’t let us read profiles directly. Open your profile, choose More → Save to PDF, and upload that here, or paste your About and Experience sections into the chat.'
				},
				{ status: 422 }
			);
		}
		turn = `Here's what my public LinkedIn profile says. Fill in my profile from it, tell me briefly what you took, then ask me only about what's missing.\n\n${text}`;
	} else {
		return json({ message: 'Attach a CV or enter a LinkedIn URL.' }, { status: 400 });
	}

	return eventStream(async (emit) => {
		try {
			await runIntakeTurn(env, convo, locals.user, turn, emit, (p) => platform?.context?.waitUntil(p));
		} catch (err) {
			console.error('import turn failed', err);
			emit({ type: 'error', message: friendlyError(err) } satisfies IntakeEvent);
		}
	});
};

/**
 * Best effort: LinkedIn serves crawlers a thin public page with og:title /
 * og:description (headline + summary) for some profiles, and a login wall for
 * most. Returns null unless we got something that looks like a profile.
 */
async function fetchLinkedInPublic(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: { 'user-agent': 'Mozilla/5.0 (compatible; EveryIntro/1.0; +https://everyintro.co.uk)', accept: 'text/html' },
			redirect: 'follow',
			signal: AbortSignal.timeout(8_000)
		});
		if (!res.ok) return null;
		const html = await res.text();
		if (/authwall|login\.linkedin|sign in to view/i.test(html)) return null;
		const meta = (prop: string) =>
			html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ??
			html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1];
		const title = meta('og:title');
		const description = meta('og:description');
		if (!title || !description || description.length < 40) return null;
		return `${decodeEntities(title)}\n${decodeEntities(description)}`.slice(0, 6_000);
	} catch {
		return null;
	}
}

function decodeEntities(s: string): string {
	return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function toBase64(buf: ArrayBuffer): string {
	let s = '';
	const bytes = new Uint8Array(buf);
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(s);
}

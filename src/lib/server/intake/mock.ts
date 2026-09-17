import type Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env';
import type { ChoiceCard, ConversationRow, IntakeEvent } from '../../types';
import { ANON_TURNS_BEFORE_SIGNIN } from '../../config';
import { run } from '../db';
import { missingCandidateFields, missingRoleFields, type CandidateProfile, type RoleSpec } from '../../schemas';
import {
	candidateHome,
	loadCandidateProfile,
	loadRoleSpec,
	saveBlindSummary,
	saveCandidateProfile,
	saveRoleSpec
} from './drafts';
import type { RerankCandidate, RerankScore } from '../matching/rerank';

// ─────────────────────────────────────────────────────────────────────────────
// LLM_MODE=mock: scripted intake and matching that never call the API, so the
// UI (streaming, draft updates, completion, the sign-in gate) can be worked on
// for free. The script is deliberately dumb; it exists to move the profile
// forward one or two fields per turn, not to be convincing.
// ─────────────────────────────────────────────────────────────────────────────

type Emit = (event: IntakeEvent) => void;

export async function mockIntakeTurn(env: Env, convo: ConversationRow, userText: string, emit: Emit) {
	const isCandidate = convo.kind === 'candidate_intake';
	const messages = JSON.parse(convo.messages_json) as Anthropic.Beta.BetaMessageParam[];
	messages.push({ role: 'user', content: userText });

	let reply: string;
	let completed = convo.status === 'complete';

	if (isCandidate) {
		const home = candidateHome(convo);
		const p = await loadCandidateProfile(env, home);
		const next = advanceCandidate(p, userText, convo.turns);
		await saveCandidateProfile(env, home, next);
		emit({ type: 'draft', draft: next });
		const missing = missingCandidateFields(next);
		if (missing.length === 0 && !completed) {
			await saveBlindSummary(env, home, mockSummary(next));
			completed = true;
			reply = "That's everything I need. Your profile card is ready to review. Nobody sees your name until you accept an intro. (mock mode)";
		} else {
			reply = candidateQuestion(missing);
		}
	} else {
		const r = await loadRoleSpec(env, convo.subject_id!);
		const next = advanceRole(r, userText, convo.turns);
		await saveRoleSpec(env, convo.subject_id!, next);
		emit({ type: 'draft', draft: next });
		const missing = missingRoleFields(next);
		if (missing.length === 0 && !completed) {
			await run(env.DB, 'UPDATE roles SET summary = ? WHERE id = ?', `${next.title} in a small team; ${next.work_mode}, ${next.location ?? 'UK'}. (mock summary)`, convo.subject_id!);
			completed = true;
			reply = 'Role spec complete. Review it and open the role for matching. (mock mode)';
		} else {
			reply = `Got it. Next: ${missing[0]}? (mock mode)`;
		}
	}

	// Mimic streaming so the UI's incremental rendering is exercised.
	for (const word of reply.split(/(?<=\s)/)) {
		emit({ type: 'text', delta: word });
		await new Promise((r) => setTimeout(r, 12));
	}
	// Inline choice cards for the awkward-to-type answers, as the live agent would.
	if (isCandidate && !completed) {
		const missing = missingCandidateFields(await loadCandidateProfile(env, candidateHome(convo)));
		const card = mockCard(missing[0]);
		if (card) emit({ type: 'card', card });
	}
	messages.push({ role: 'assistant', content: reply });

	const turns = convo.turns + 1;
	await run(
		env.DB,
		`UPDATE conversations SET messages_json = ?, turns = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
		JSON.stringify(messages),
		turns,
		completed ? 'complete' : 'open',
		convo.id
	);
	if (completed) emit({ type: 'complete' });
	if (isCandidate && !convo.user_id && (completed || turns >= ANON_TURNS_BEFORE_SIGNIN)) emit({ type: 'gate' });
}

function advanceCandidate(p: CandidateProfile, text: string, turn: number): CandidateProfile {
	const next = { ...p };
	const money = text.replace(/,/g, '').match(/£?\s?(\d{2,3})\s?k\b|£?\s?(\d{4,6})\b/i);
	if (money && next.salary_floor_gbp == null && turn > 0) {
		next.salary_floor_gbp = money[1] ? Number(money[1]) * 1000 : Number(money[2]);
	}
	if (/remote/i.test(text)) next.work_mode = 'remote';
	else if (/hybrid/i.test(text)) next.work_mode = 'hybrid';
	else if (/on-?site|office/i.test(text)) next.work_mode = 'onsite';
	const city = text.match(/\b(London|Manchester|Leeds|Bristol|Birmingham|Edinburgh|Glasgow|Cardiff|Belfast|Cambridge|Oxford)\b/i);
	if (city) next.location = city[1];
	if (/\b(yes|right to work|citizen|settled)\b/i.test(text) && next.right_to_work_uk == null && turn > 0) next.right_to_work_uk = true;
	const notice = text.match(/(\d+)\s*(week|month)/i);
	if (notice) next.notice_weeks = Number(notice[1]) * (/month/i.test(notice[2]) ? 4 : 1);
	if (turn === 0 || next.target_titles.length === 0) {
		const title = text.match(/\b(?:I'?m an?|I am an?|as an?|I work as an?)\s+([A-Za-z /-]{3,40}?)(?=[.,;]|\s(?:at|in|for|with|and)\b|$)/i)?.[1];
		next.target_titles = [title?.trim() ?? text.split(/[.,\n]/)[0].trim().slice(0, 40) ?? 'Software Engineer'];
	}
	if (next.skills.length === 0 && turn >= 1) {
		next.skills = [{ skill: 'Something from the chat', evidence: text.slice(0, 80) }];
	}
	if (next.wants.length === 0 && turn >= 2) next.wants = ['A small team', 'Real ownership'];
	return next;
}

function mockCard(field: string | undefined): ChoiceCard | null {
	if (field === 'salary_floor_gbp') {
		return {
			field,
			title: 'Salary floor',
			note: "The lowest you'd say yes to. Employers never see this. It just filters out roles beneath it.",
			private: true,
			options: [45, 55, 65, 75, 85].map((k) => ({ label: `£${k}k${k === 85 ? '+' : ''}`, send: `My salary floor is £${k},000` })),
			confirm_template: 'Set {label} floor'
		};
	}
	if (field === 'work_mode') {
		return {
			field,
			title: 'How do you want to work?',
			note: null,
			private: false,
			options: [
				{ label: 'Onsite', send: 'Onsite is fine' },
				{ label: 'Hybrid', send: 'Hybrid, a couple of days in the office' },
				{ label: 'Remote', send: 'Remote only' },
				{ label: 'Any', send: "I'm open to any work mode" }
			],
			confirm_template: 'Set {label}'
		};
	}
	if (field === 'right_to_work_uk') {
		return {
			field,
			title: 'Right to work in the UK',
			note: null,
			private: false,
			options: [
				{ label: 'Yes', send: 'Yes, I have the right to work in the UK' },
				{ label: 'Need sponsorship', send: 'I would need visa sponsorship' }
			],
			confirm_template: 'Confirm: {label}',
			other: false
		};
	}
	return null;
}

function candidateQuestion(missing: string[]): string {
	const q: Record<string, string> = {
		target_titles: 'What kind of role are you after? A job title or two.',
		skills: "Tell me one thing you've built or led recently, so I have real evidence rather than keywords.",
		salary_floor_gbp: "What's the lowest salary you'd move for? It's private and only used for filtering.",
		work_mode: 'Onsite, hybrid or remote?',
		location: 'Where are you based?',
		right_to_work_uk: 'Do you have the right to work in the UK?'
	};
	return `${q[missing[0]] ?? `Tell me about ${missing[0]}.`} (mock mode, no AI is running)`;
}

function mockSummary(p: CandidateProfile): string {
	return `${p.seniority ?? 'Experienced'} ${p.target_titles[0] ?? 'professional'} based in ${p.location ?? 'the UK'}, looking for ${p.work_mode ?? 'flexible'} work. ${p.skills.map((s) => s.skill).join(', ')}. Wants: ${p.wants.join('; ') || 'a good team'}. (mock summary)`;
}

function advanceRole(r: RoleSpec, text: string, turn: number): RoleSpec {
	const next = { ...r };
	if (!next.title) next.title = text.split(/[.,\n]/)[0].trim().slice(0, 50) || 'Engineer';
	const band = text.replace(/,/g, '').match(/(\d{2,3})\s?k?\s?(?:-|–|to)\s?£?(\d{2,3})\s?k/i);
	if (band) {
		next.salary_min_gbp = Number(band[1]) * 1000;
		next.salary_max_gbp = Number(band[2]) * 1000;
	}
	if (/remote/i.test(text)) next.work_mode = 'remote';
	else if (/hybrid/i.test(text)) next.work_mode = 'hybrid';
	else if (/on-?site|office/i.test(text)) next.work_mode = 'onsite';
	const city = text.match(/\b(London|Manchester|Leeds|Bristol|Birmingham|Edinburgh|Glasgow|Cardiff|Belfast|Cambridge|Oxford)\b/i);
	if (city) next.location = city[1];
	if (/sponsor/i.test(text)) next.sponsorship = !/no sponsor|can'?t sponsor|don'?t sponsor/i.test(text);
	if (next.must_haves.length === 0 && turn >= 1) next.must_haves = ['Must-have from the chat: ' + text.slice(0, 60)];
	return next;
}

/** Keyword-overlap stand-in for the Claude rerank. */
export function mockRerank(roleText: string, candidates: RerankCandidate[]): RerankScore[] {
	const roleWords = new Set(roleText.toLowerCase().match(/[a-z]{4,}/g) ?? []);
	return candidates.map((c) => {
		const words = `${c.facts} ${c.blindSummary}`.toLowerCase().match(/[a-z]{4,}/g) ?? [];
		const overlap = new Set(words.filter((w) => roleWords.has(w)));
		const fit = Math.max(1, Math.min(5, 2 + Math.round(overlap.size / 3)));
		return { candidateId: c.id, fit, why: [`Shares ${overlap.size} terms with the role (mock)`], gaps: fit < 5 ? ['Mock scoring, not a real judgement'] : [] };
	});
}

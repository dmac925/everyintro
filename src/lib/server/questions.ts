import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Env } from './env';
import type { CompanyRow, QuestionRow, RoleRow } from '../types';
import { QUESTIONS_PER_CANDIDATE_PER_WEEK, QUESTIONS_PER_ROLE, QUESTION_BATCH_MAX, QUESTION_MAX_CHARS } from '../config';
import { QuestionScreen } from '../schemas';
import { all, first, newId, run } from './db';
import { assertWithinBudget, claude, FALLBACK, logUsage, mockMode, modelFor } from './claude';
import { candidateFacts, factsText } from './matching/facts';
import { scrubIdentity } from './blind';
import { sendEmail, templates } from './email';

// Follow-up questions (issues #13, #14). One screening call per candidate per
// question: answer from the blind profile if it can, otherwise rewrite the
// question for the candidate, or refuse it if it fishes for identity, pay or
// protected characteristics. Only blind-safe facts reach the model, so an
// answer can't leak what a card doesn't already show.

// Frozen so it prompt-caches. Never interpolate per-user data into it.
const SCREEN_SYSTEM = `You screen follow-up questions from an employer to an anonymous candidate on EveryIntro, a UK hiring service where candidates stay anonymous until they accept an intro.

Given the role, the candidate's blind profile and the employer's question, choose exactly one verdict:
- "answer": the profile already answers it. Write a short answer (one or two sentences) to the employer, using only what is in the profile. Set "rewritten" to null.
- "ask": the profile doesn't answer it and the question is fair. Rewrite it as one clear, neutral question addressed to the candidate, keeping the employer's intent. Set "answer" to null.
- "refuse": the question tries to identify the candidate (name, current or past employer names, contact details, links, exact address), asks about pay or salary expectations, or touches protected characteristics (age, health, family plans, nationality, religion, and so on). Give a one-line reason for the employer.

Never reveal anything that is not in the profile. Never include a name, an employer name or a contact detail in an answer. Do not use em dashes.`;

export class QuestionError extends Error {}

interface Screened {
	verdict: 'answer' | 'ask' | 'refuse';
	answer: string | null;
	rewritten: string | null;
	reason: string | null;
}

/** Scripted screening for LLM_MODE=mock: refuse the obvious, answer years, ask the rest. */
function mockScreen(question: string, facts: string): Screened {
	const q = question.toLowerCase();
	if (/\b(name|employer|company|work for|where do you work|salary|pay|paid|age|how old|nationality|children|health)\b/.test(q)) {
		return { verdict: 'refuse', answer: null, rewritten: null, reason: 'This would identify the candidate or asks about pay or a protected characteristic.' };
	}
	const years = facts.match(/Experience: (\d+) yrs/);
	if (/\b(years|experience|how long)\b/.test(q) && years) {
		return { verdict: 'answer', answer: `From their profile: ${years[1]} years of experience.`, rewritten: null, reason: null };
	}
	return { verdict: 'ask', answer: null, rewritten: question.trim().replace(/\s+/g, ' '), reason: null };
}

async function screen(env: Env, roleId: string, roleText: string, facts: string, question: string): Promise<Screened> {
	if (mockMode(env)) return mockScreen(question, facts);
	await assertWithinBudget(env);
	const response = await claude(env).beta.messages.parse({
		model: modelFor(env),
		max_tokens: 400,
		...FALLBACK,
		output_config: { effort: 'low', format: betaZodOutputFormat(QuestionScreen) },
		system: SCREEN_SYSTEM,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: `<role>\n${roleText}\n</role>`, cache_control: { type: 'ephemeral' } },
					{ type: 'text', text: `<candidate>\n${facts}\n</candidate>\n<question>\n${question}\n</question>` }
				]
			}
		]
	});
	await logUsage(env, 'question', roleId, response);
	if (response.stop_reason === 'refusal' || !response.parsed_output) {
		return { verdict: 'refuse', answer: null, rewritten: null, reason: 'The question could not be screened. Try rewording it.' };
	}
	return response.parsed_output;
}

export interface AskResult {
	created: number;
	answered: number;
	sent: number;
	refused: number;
	skipped: number; // candidates at their weekly cap
}

/** Ask one question of one or more shortlisted candidates on a role. */
export async function askQuestion(
	env: Env,
	company: CompanyRow,
	role: RoleRow,
	askedBy: string,
	matchIds: string[],
	rawText: string
): Promise<AskResult> {
	const text = rawText.trim().replace(/\s+/g, ' ');
	if (text.length < 5) throw new QuestionError('Write the question first.');
	if (text.length > QUESTION_MAX_CHARS) throw new QuestionError(`Keep questions under ${QUESTION_MAX_CHARS} characters.`);
	const ids = [...new Set(matchIds)].slice(0, QUESTION_BATCH_MAX);
	if (!ids.length) throw new QuestionError('Pick at least one candidate.');

	const used = await first<{ n: number }>(env.DB, 'SELECT COUNT(*) AS n FROM questions WHERE role_id = ?', role.id);
	if ((used?.n ?? 0) + ids.length > QUESTIONS_PER_ROLE) {
		throw new QuestionError(`This role has ${QUESTIONS_PER_ROLE - (used?.n ?? 0)} questions left. Ask fewer candidates, or request intros instead.`);
	}

	const placeholders = ids.map(() => '?').join(',');
	const matches = await all<{ id: string; candidate_id: string; profile_json: string | null; blind_summary: string | null; weekly: number }>(
		env.DB,
		`SELECT m.id, m.candidate_id, c.profile_json, c.blind_summary,
			(SELECT COUNT(*) FROM questions q WHERE q.candidate_id = m.candidate_id AND q.status <> 'refused' AND q.created_at > datetime('now', '-7 days')) AS weekly
		 FROM matches m JOIN candidates c ON c.user_id = m.candidate_id
		 WHERE m.role_id = ? AND m.status IN ('shown', 'requested') AND m.id IN (${placeholders})`,
		role.id,
		...ids
	);

	const roleText = [role.title, role.summary].filter(Boolean).join('\n');
	const batchId = ids.length > 1 ? newId() : null;
	const result: AskResult = { created: 0, answered: 0, sent: 0, refused: 0, skipped: 0 };
	const notify: { candidateId: string }[] = [];

	for (const m of matches) {
		if (m.weekly >= QUESTIONS_PER_CANDIDATE_PER_WEEK) {
			result.skipped++;
			continue;
		}
		const facts = [factsText(candidateFacts(m)), m.blind_summary ?? ''].join('\n');
		const s = await screen(env, role.id, roleText, facts, text);
		const id = newId();
		const status = s.verdict === 'answer' ? 'answered_by_agent' : s.verdict === 'ask' ? 'sent' : 'refused';
		await run(
			env.DB,
			`INSERT INTO questions (id, role_id, match_id, candidate_id, company_id, asked_by, batch_id, text, sent_text, status, answer, answer_source, refusal_reason, answered_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id,
			role.id,
			m.id,
			m.candidate_id,
			company.id,
			askedBy,
			batchId,
			text,
			s.verdict === 'ask' ? s.rewritten : null,
			status,
			s.verdict === 'answer' ? s.answer : null,
			s.verdict === 'answer' ? 'profile' : null,
			s.verdict === 'refuse' ? s.reason : null,
			s.verdict === 'answer' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
		);
		result.created++;
		if (status === 'answered_by_agent') result.answered++;
		else if (status === 'sent') {
			result.sent++;
			notify.push({ candidateId: m.candidate_id });
		} else result.refused++;
	}

	if (notify.length) {
		const users = await all<{ id: string; email: string }>(
			env.DB,
			`SELECT id, email FROM users WHERE id IN (${notify.map(() => '?').join(',')})`,
			...notify.map((n) => n.candidateId)
		);
		for (const u of users) {
			await sendEmail(env, { to: u.email, ...templates.questionAsked(env, role.title ?? 'a role', company.name) });
		}
	}
	return result;
}

/** Questions on a role, grouped by match, for the employer's cards. */
export async function questionsForRole(env: Env, roleId: string): Promise<Map<string, QuestionRow[]>> {
	const rows = await all<QuestionRow>(env.DB, 'SELECT * FROM questions WHERE role_id = ? ORDER BY created_at DESC', roleId);
	const byMatch = new Map<string, QuestionRow[]>();
	for (const q of rows) byMatch.set(q.match_id, [...(byMatch.get(q.match_id) ?? []), q]);
	return byMatch;
}

/** The candidate's answer, scrubbed of contact details before the employer sees it. */
export async function answerQuestion(env: Env, candidateId: string, questionId: string, rawAnswer: string): Promise<boolean> {
	const answer = scrubIdentity(rawAnswer.trim().replace(/\s+/g, ' '), []).slice(0, 1000);
	if (answer.length < 2) return false;
	const r = await run(
		env.DB,
		`UPDATE questions SET status = 'answered', answer = ?, answer_source = 'candidate', answered_at = datetime('now')
		 WHERE id = ? AND candidate_id = ? AND status = 'sent'`,
		answer,
		questionId,
		candidateId
	);
	return r.meta.changes > 0;
}

export async function declineQuestion(env: Env, candidateId: string, questionId: string): Promise<boolean> {
	const r = await run(
		env.DB,
		`UPDATE questions SET status = 'declined', answered_at = datetime('now') WHERE id = ? AND candidate_id = ? AND status = 'sent'`,
		questionId,
		candidateId
	);
	return r.meta.changes > 0;
}

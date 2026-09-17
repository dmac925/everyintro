import type Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env';
import type { ChatLine, ConversationRow, IntakeEvent, User } from '../../types';
import { ANON_TURNS_BEFORE_SIGNIN, MAX_TOOL_ROUNDS_PER_TURN } from '../../config';
import { assertWithinBudget, claude, FALLBACK, logUsage, mockMode, modelFor } from '../claude';
import { mockIntakeTurn } from './mock';
import { run } from '../db';
import { scrubIdentity } from '../blind';
import { dispatch } from '../jobs/dispatch';
import {
	CandidateProfilePatch,
	RoleSpecPatch,
	missingCandidateFields,
	missingRoleFields,
	type CandidateProfile,
	type RoleSpec
} from '../../schemas';
import { CANDIDATE_SYSTEM, ROLE_SYSTEM } from './prompts';
import { CANDIDATE_TOOLS, ROLE_TOOLS, CompleteCandidateInput, CompleteRoleInput, OfferChoicesInput } from './tools';
import {
	candidateHome,
	loadCandidateProfile,
	loadRoleSpec,
	saveBlindSummary,
	saveCandidateProfile,
	saveRoleSpec,
	type CandidateHome
} from './drafts';

type Emit = (event: IntakeEvent) => void;
type ToolOutcome = { content: string; isError?: boolean };

/** A user turn: plain text, or content blocks (e.g. text + an uploaded CV document). */
export type UserTurn = string | Anthropic.Beta.BetaContentBlockParam[];

/**
 * Run one user turn of an intake chat: stream Claude's reply, apply any
 * update/complete tool calls to the draft, loop until Claude ends its turn,
 * then persist the transcript. Emits text deltas and draft snapshots.
 *
 * `user` is null for anonymous homepage chats; the draft then lives on the
 * conversation and a `gate` event is emitted once the free turns are used.
 */
export async function runIntakeTurn(
	env: Env,
	convo: ConversationRow,
	user: User | null,
	userTurn: UserTurn,
	emit: Emit,
	waitUntil?: (p: Promise<unknown>) => void
) {
	if (mockMode(env)) {
		const text = typeof userTurn === 'string' ? userTurn : userTurn.map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join(' ');
		return mockIntakeTurn(env, convo, text, emit);
	}
	await assertWithinBudget(env);

	const isCandidate = convo.kind === 'candidate_intake';
	const messages = JSON.parse(convo.messages_json) as Anthropic.Beta.BetaMessageParam[];
	messages.push({ role: 'user', content: userTurn });

	const home: CandidateHome | null = isCandidate ? candidateHome(convo) : null;
	let profile: CandidateProfile | null = home ? await loadCandidateProfile(env, home) : null;
	let spec: RoleSpec | null = isCandidate ? null : await loadRoleSpec(env, convo.subject_id!);
	let completed = convo.status === 'complete';
	let emittedText = false;

	const client = claude(env);

	for (let round = 0; round < MAX_TOOL_ROUNDS_PER_TURN; round++) {
		const stream = client.beta.messages.stream({
			model: modelFor(env),
			max_tokens: 16_000,
			...FALLBACK,
			// Chat turns are conversational; medium effort keeps latency and cost down.
			output_config: { effort: 'medium' },
			system: [
				{ type: 'text', text: isCandidate ? CANDIDATE_SYSTEM : ROLE_SYSTEM, cache_control: { type: 'ephemeral' } }
			],
			tools: isCandidate ? CANDIDATE_TOOLS : ROLE_TOOLS,
			// Auto-cache the growing transcript so each turn re-reads history at ~0.1× price.
			cache_control: { type: 'ephemeral' },
			messages
		});
		let roundHasText = false;
		stream.on('text', (delta) => {
			// Separate text from successive tool rounds so the bubble reads cleanly.
			if (!roundHasText && emittedText) delta = '\n\n' + delta;
			roundHasText = emittedText = true;
			emit({ type: 'text', delta });
		});
		const message = await stream.finalMessage();
		await logUsage(env, isCandidate ? 'candidate_intake' : 'role_intake', convo.subject_id ?? convo.id, message);

		if (message.stop_reason === 'refusal') {
			emit({ type: 'error', message: "I can't help with that. Let's get back to the role." });
			break;
		}

		messages.push({ role: 'assistant', content: message.content });

		const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
		if (message.stop_reason !== 'tool_use' || toolUses.length === 0) break;

		const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
		for (const call of toolUses) {
			let outcome: ToolOutcome;
			if (home) {
				const r = await applyCandidateTool(env, home, user, call, profile!, emit);
				profile = r.profile;
				completed ||= r.completed;
				outcome = r.outcome;
				if (r.changed) emit({ type: 'draft', draft: profile });
			} else {
				const r = await applyRoleTool(env, convo, call, spec!);
				spec = r.spec;
				completed ||= r.completed;
				outcome = r.outcome;
				if (r.changed) emit({ type: 'draft', draft: spec });
			}
			results.push({ type: 'tool_result', tool_use_id: call.id, content: outcome.content, is_error: outcome.isError });
		}
		messages.push({ role: 'user', content: results });
	}

	const turns = convo.turns + 1;
	await run(
		env.DB,
		`UPDATE conversations SET messages_json = ?, turns = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
		JSON.stringify(messages.map(stripDocuments)),
		turns,
		completed ? 'complete' : 'open',
		convo.id
	);

	if (completed && isCandidate && convo.user_id) {
		const job = dispatch(env, { type: 'embed_candidate', candidateId: convo.user_id });
		waitUntil ? waitUntil(job) : await job;
	}
	if (completed) emit({ type: 'complete' });
	// Anonymous: once the free turns are spent (or the profile is done), ask for an email.
	if (isCandidate && !convo.user_id && (completed || turns >= ANON_TURNS_BEFORE_SIGNIN)) emit({ type: 'gate' });
}

async function applyCandidateTool(
	env: Env,
	home: CandidateHome,
	user: User | null,
	call: Anthropic.Beta.BetaToolUseBlock,
	profile: CandidateProfile,
	emit: Emit
) {
	if (call.name === 'offer_choices') {
		const parsed = OfferChoicesInput.safeParse(call.input);
		if (!parsed.success) return { profile, changed: false, completed: false, outcome: invalid(parsed.error.message) };
		emit({ type: 'card', card: { ...parsed.data, other: true } });
		return { profile, changed: false, completed: false, outcome: { content: 'Options shown to the user. End your turn and wait for their reply.' } };
	}
	if (call.name === 'update_profile') {
		const parsed = CandidateProfilePatch.safeParse(call.input);
		if (!parsed.success) {
			return { profile, changed: false, completed: false, outcome: invalid(parsed.error.message) };
		}
		const next = { ...profile, ...stripUndefined(parsed.data) };
		await saveCandidateProfile(env, home, next);
		return { profile: next, changed: true, completed: false, outcome: { content: 'Saved.' } };
	}
	if (call.name === 'complete_intake') {
		const parsed = CompleteCandidateInput.safeParse(call.input);
		if (!parsed.success) return { profile, changed: false, completed: false, outcome: invalid(parsed.error.message) };
		const missing = missingCandidateFields(profile);
		if (missing.length > 0) {
			return { profile, changed: false, completed: false, outcome: { content: `Still missing: ${missing.join(', ')}. Ask about these.`, isError: true } };
		}
		const summary = scrubIdentity(parsed.data.blind_summary, [user?.name, user?.email]);
		await saveBlindSummary(env, home, summary);
		return { profile, changed: false, completed: true, outcome: { content: 'Intake complete. Profile card is ready.' } };
	}
	return { profile, changed: false, completed: false, outcome: invalid(`Unknown tool ${call.name}`) };
}

async function applyRoleTool(env: Env, convo: ConversationRow, call: Anthropic.Beta.BetaToolUseBlock, spec: RoleSpec) {
	const roleId = convo.subject_id!;
	if (call.name === 'update_role') {
		const parsed = RoleSpecPatch.safeParse(call.input);
		if (!parsed.success) return { spec, changed: false, completed: false, outcome: invalid(parsed.error.message) };
		const next = { ...spec, ...stripUndefined(parsed.data) };
		await saveRoleSpec(env, roleId, next);
		return { spec: next, changed: true, completed: false, outcome: { content: 'Saved.' } };
	}
	if (call.name === 'complete_role_intake') {
		const parsed = CompleteRoleInput.safeParse(call.input);
		if (!parsed.success) return { spec, changed: false, completed: false, outcome: invalid(parsed.error.message) };
		const missing = missingRoleFields(spec);
		if (missing.length > 0) {
			return { spec, changed: false, completed: false, outcome: { content: `Still missing: ${missing.join(', ')}. Ask about these.`, isError: true } };
		}
		await run(env.DB, 'UPDATE roles SET summary = ? WHERE id = ?', parsed.data.summary, roleId);
		return { spec, changed: false, completed: true, outcome: { content: 'Role spec complete.' } };
	}
	return { spec, changed: false, completed: false, outcome: invalid(`Unknown tool ${call.name}`) };
}

const invalid = (message: string): ToolOutcome => ({ content: `Invalid input: ${message}`, isError: true });

function stripUndefined<T extends object>(obj: T): Partial<T> {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Uploaded CVs are sent to the model once as document blocks, but not kept in
 * the stored transcript (a base64 PDF would bloat every later turn and the D1
 * row). The profile the model extracted is the durable record.
 */
function stripDocuments(m: Anthropic.Beta.BetaMessageParam): Anthropic.Beta.BetaMessageParam {
	if (typeof m.content === 'string') return m;
	return {
		...m,
		content: m.content.map((b) =>
			b.type === 'document' ? ({ type: 'text', text: `[${b.title ?? 'CV'} was attached here and read into the profile]` } as const) : b
		)
	};
}

/** Transcript → what the chat UI shows (user text + assistant text only). */
export function toChatLines(messagesJson: string): ChatLine[] {
	const messages = JSON.parse(messagesJson) as Anthropic.Beta.BetaMessageParam[];
	const lines: ChatLine[] = [];
	for (const m of messages) {
		const text =
			typeof m.content === 'string'
				? m.content
				: m.content
						.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === 'text')
						.map((b) => b.text)
						.join('');
		if (!text.trim()) continue;
		const last = lines.at(-1);
		// Tool rounds split one assistant reply across messages — merge them.
		if (last && last.role === m.role) last.text += '\n\n' + text;
		else lines.push({ role: m.role as ChatLine['role'], text });
	}
	return lines;
}

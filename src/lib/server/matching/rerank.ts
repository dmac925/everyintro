import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Env } from '../env';
import { assertWithinBudget, claude, FALLBACK, logUsage, mockMode, modelFor } from '../claude';
import { mockRerank } from '../intake/mock';
import { RerankOutput } from '../../schemas';

// Step 3: one Claude call scores every shortlisted candidate against the role
// and explains why. Candidates are referenced by short refs (c1, c2…) so no ids
// or identities reach the model — only blind summaries and facts.
// TODO(cost): move scheduled re-runs to the Message Batches API (50% cheaper;
// note server-side fallbacks aren't available there).

const RERANK_SYSTEM = `You are the matcher for EveryIntro, a UK hiring service. Score how well each anonymous candidate fits the role.

Scoring (fit):
5 = meets every must-have with clear evidence and wants this kind of role
4 = meets the must-haves; minor gaps or unknowns
3 = plausible but missing a must-have or unclear evidence
2 = weak fit
1 = not a fit

Rules:
- Judge only on evidence in the summary and facts. Never infer or consider age, gender, ethnicity, nationality, disability or other protected characteristics.
- "why": 1–3 short points, each tied to a specific must-have or stated want, written to the employer.
- "gaps": 0–2 short, honest points. Say "none obvious" rather than inventing gaps.
- Return one result per candidate, using their ref.`;

export interface RerankCandidate {
	id: string;
	blindSummary: string;
	facts: string;
}

export interface RerankScore {
	candidateId: string;
	fit: number;
	why: string[];
	gaps: string[];
}

export async function rerank(env: Env, roleId: string, roleText: string, candidates: RerankCandidate[]): Promise<RerankScore[]> {
	if (candidates.length === 0) return [];
	if (mockMode(env)) return mockRerank(roleText, candidates);
	await assertWithinBudget(env);
	const refs = new Map(candidates.map((c, i) => [`c${i + 1}`, c.id]));
	const candidateBlock = candidates
		.map((c, i) => `<candidate ref="c${i + 1}">\n${c.facts}\n${c.blindSummary}\n</candidate>`)
		.join('\n');

	const response = await claude(env).beta.messages.parse({
		model: modelFor(env),
		max_tokens: 16_000,
		...FALLBACK,
		output_config: { effort: 'high', format: betaZodOutputFormat(RerankOutput) },
		system: RERANK_SYSTEM,
		messages: [
			{
				role: 'user',
				content: [
					// Role first and cached: incremental re-runs for the same role reuse it.
					{ type: 'text', text: `<role>\n${roleText}\n</role>`, cache_control: { type: 'ephemeral' } },
					{ type: 'text', text: `<candidates>\n${candidateBlock}\n</candidates>` }
				]
			}
		]
	});
	await logUsage(env, 'rerank', roleId, response);

	if (response.stop_reason === 'refusal' || !response.parsed_output) {
		throw new Error(`rerank returned no parsed output (stop_reason=${response.stop_reason})`);
	}
	return response.parsed_output.results.flatMap((r) => {
		const candidateId = refs.get(r.ref);
		if (!candidateId) return [];
		return [{ candidateId, fit: Math.min(5, Math.max(1, r.fit)), why: r.why.slice(0, 3), gaps: r.gaps.slice(0, 2) }];
	});
}

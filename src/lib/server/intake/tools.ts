import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { CandidateProfilePatch, RoleSpecPatch } from '../../schemas';

// Tool definitions are generated from the zod schemas so the model, the
// validator and the DB shape can't drift. Order is fixed so the prompt caches.

function inputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
	const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
	return rest as Anthropic.Beta.BetaTool.InputSchema;
}

export const CompleteCandidateInput = z.object({
	blind_summary: z
		.string()
		.describe(
			'80–150 words, third person, for employers. Experience, strengths with evidence, and what they want next. No name, employer names, school names, ages, dates, or anything identifying.'
		)
});

export const CompleteRoleInput = z.object({
	summary: z
		.string()
		.describe('60–120 words, second person, for candidates: the role, team, work pattern, and why join.')
});

// Inline choice card: for answers that are awkward to type (salary floor,
// work mode, notice, seniority) the agent offers tappable options. The UI
// sends the chosen option's `send` phrasing back as the user's next message.
export const OfferChoicesInput = z.object({
	field: z.enum(['salary_floor_gbp', 'work_mode', 'notice_weeks', 'seniority', 'right_to_work_uk']),
	title: z.string().describe('Short card title, e.g. "Salary floor"'),
	note: z.string().nullable().describe('One sentence of context, e.g. why it is asked or that it is private'),
	private: z.boolean().describe('True for the salary floor: never shown to employers'),
	options: z
		.array(
			z.object({
				label: z.string().describe('Chip text, e.g. "£65k"'),
				send: z.string().describe('What the user is taken to have said if they pick it, e.g. "My salary floor is £65,000"')
			})
		)
		.min(2)
		.max(6),
	confirm_template: z.string().nullable().describe('Confirm button text with {label}, e.g. "Set {label} floor"')
});

export const CANDIDATE_TOOLS: Anthropic.Beta.BetaTool[] = [
	{
		name: 'update_profile',
		description: "Save newly learned or corrected details about the candidate. Include only the fields you're setting.",
		input_schema: inputSchema(CandidateProfilePatch)
	},
	{
		name: 'offer_choices',
		description:
			'Show the candidate tappable options for one hard-to-type question (salary floor, work mode, notice, seniority, right to work). Ask the question in your text first, then call this, then end your turn and wait for their reply.',
		input_schema: inputSchema(OfferChoicesInput)
	},
	{
		name: 'complete_intake',
		description: 'Mark the intake complete once required details are known. Returns missing fields if any.',
		input_schema: inputSchema(CompleteCandidateInput)
	}
];

export const ROLE_TOOLS: Anthropic.Beta.BetaTool[] = [
	{
		name: 'update_role',
		description: "Save newly learned or corrected details about the role. Include only the fields you're setting.",
		input_schema: inputSchema(RoleSpecPatch)
	},
	{
		name: 'complete_role_intake',
		description: 'Mark the role spec complete once required details are known. Returns missing fields if any.',
		input_schema: inputSchema(CompleteRoleInput)
	}
];

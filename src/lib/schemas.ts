import { z } from 'zod';

// Shapes stored in D1 JSON columns and filled in by the intake agents.
// Every field is nullable/array so a half-finished intake is still valid.

export const WorkMode = z.enum(['onsite', 'hybrid', 'remote', 'any']);
export type WorkMode = z.infer<typeof WorkMode>;

export const Seniority = z.enum(['entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive']);
export type Seniority = z.infer<typeof Seniority>;

export const CandidateProfile = z.object({
	target_titles: z.array(z.string()).describe('Job titles they would genuinely apply for'),
	seniority: Seniority.nullable(),
	years_experience: z.number().int().nullable(),
	skills: z
		.array(z.object({ skill: z.string(), evidence: z.string() }))
		.describe('Each skill paired with one concrete piece of evidence from their experience'),
	wants: z.array(z.string()).describe('What they want more of in their next role'),
	dealbreakers: z.array(z.string()).describe('Things that would make them say no'),
	salary_floor_gbp: z
		.number()
		.int()
		.nullable()
		.describe('Lowest annual salary they would move for. Private: used for filtering only'),
	location: z.string().nullable().describe('Where they are based, e.g. "London" or "Manchester"'),
	work_mode: WorkMode.nullable(),
	right_to_work_uk: z.boolean().nullable(),
	notice_weeks: z.number().int().nullable(),
	avoid_industries: z.array(z.string())
});
export type CandidateProfile = z.infer<typeof CandidateProfile>;
export const CandidateProfilePatch = CandidateProfile.partial();

export function emptyCandidateProfile(): CandidateProfile {
	return {
		target_titles: [],
		seniority: null,
		years_experience: null,
		skills: [],
		wants: [],
		dealbreakers: [],
		salary_floor_gbp: null,
		location: null,
		work_mode: null,
		right_to_work_uk: null,
		notice_weeks: null,
		avoid_industries: []
	};
}

export const RoleSpec = z.object({
	title: z.string().nullable(),
	seniority: Seniority.nullable(),
	must_haves: z.array(z.string()).max(5).describe('At most five genuine must-haves'),
	nice_to_haves: z.array(z.string()),
	salary_min_gbp: z.number().int().nullable(),
	salary_max_gbp: z.number().int().nullable(),
	location: z.string().nullable(),
	work_mode: WorkMode.nullable(),
	office_days_per_week: z.number().int().nullable(),
	sponsorship: z.boolean().nullable().describe('Will they sponsor a UK visa?'),
	interview_stages: z.array(z.string()),
	team: z.string().nullable().describe('Team size and what it works on'),
	why_join: z.string().nullable().describe('The honest reason a good person would take this job')
});
export type RoleSpec = z.infer<typeof RoleSpec>;
export const RoleSpecPatch = RoleSpec.partial();

export function emptyRoleSpec(): RoleSpec {
	return {
		title: null,
		seniority: null,
		must_haves: [],
		nice_to_haves: [],
		salary_min_gbp: null,
		salary_max_gbp: null,
		location: null,
		work_mode: null,
		office_days_per_week: null,
		sponsorship: null,
		interview_stages: [],
		team: null,
		why_join: null
	};
}

// Required before an intake can be marked complete. Returns missing field names.
export function missingCandidateFields(p: CandidateProfile): string[] {
	const missing: string[] = [];
	if (p.target_titles.length === 0) missing.push('target_titles');
	if (p.salary_floor_gbp == null) missing.push('salary_floor_gbp');
	if (p.work_mode == null) missing.push('work_mode');
	if (p.work_mode !== 'remote' && !p.location) missing.push('location');
	if (p.right_to_work_uk == null) missing.push('right_to_work_uk');
	if (p.skills.length === 0) missing.push('skills');
	return missing;
}

export function missingRoleFields(r: RoleSpec): string[] {
	const missing: string[] = [];
	if (!r.title) missing.push('title');
	if (r.must_haves.length === 0) missing.push('must_haves');
	if (r.salary_min_gbp == null || r.salary_max_gbp == null) missing.push('salary band');
	if (r.work_mode == null) missing.push('work_mode');
	if (r.work_mode !== 'remote' && !r.location) missing.push('location');
	if (r.sponsorship == null) missing.push('sponsorship');
	return missing;
}

// Structured outputs for the matcher. No numeric bounds here, structured
// outputs ignore them; values are clamped in code instead.
export const RerankOutput = z.object({
	results: z.array(
		z.object({
			ref: z.string(),
			fit: z.number().int(),
			why: z.array(z.string()),
			gaps: z.array(z.string())
		})
	)
});
export type RerankOutput = z.infer<typeof RerankOutput>;

export const DigestOutput = z.object({
	results: z.array(z.object({ ref: z.string(), fit: z.number().int(), why: z.string() }))
});
export type DigestOutput = z.infer<typeof DigestOutput>;

// Rows of the "Your profile" list beside the chat, in the order the intake
// tends to learn them. `value` is the human-readable cell; `private` rows are
// only ever used to filter and are never shown to employers.
export interface ProfileProgressItem {
	key: string;
	label: string;
	done: boolean;
	value: string | null;
	private?: boolean;
}
export function profileProgress(p: CandidateProfile): { items: ProfileProgressItem[]; done: number; total: number } {
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	const items: ProfileProgressItem[] = [
		{ key: 'titles', label: 'Roles you want', done: p.target_titles.length > 0, value: p.target_titles.join(' · ') || null },
		{ key: 'wants', label: 'What you want next', done: p.wants.length > 0, value: p.wants.join(', ') || null },
		{ key: 'work_mode', label: 'Onsite, hybrid or remote', done: p.work_mode != null, value: p.work_mode ? cap(p.work_mode) : null },
		{
			key: 'location',
			label: 'Location',
			done: Boolean(p.location) || p.work_mode === 'remote',
			value: p.location ?? (p.work_mode === 'remote' ? 'Anywhere (remote)' : null)
		},
		{
			key: 'salary',
			label: 'Salary floor',
			private: true,
			done: p.salary_floor_gbp != null,
			value: p.salary_floor_gbp != null ? `£${p.salary_floor_gbp.toLocaleString('en-GB')}` : null
		},
		{
			key: 'seniority',
			label: 'Seniority',
			done: p.seniority != null,
			value: p.seniority
				? `${cap(p.seniority)}${p.years_experience != null ? ` (${p.years_experience} yrs)` : ''}`
				: p.years_experience != null
					? `${p.years_experience} yrs, to confirm`
					: null
		},
		{ key: 'skills', label: 'Skills with evidence', done: p.skills.length > 0, value: p.skills.length ? p.skills.map((s) => s.skill).join(', ') : null },
		{
			key: 'rtw',
			label: 'Right to work in the UK',
			done: p.right_to_work_uk != null,
			value: p.right_to_work_uk == null ? null : p.right_to_work_uk ? 'Yes' : 'Needs sponsorship'
		},
		{ key: 'notice', label: 'Notice period', done: p.notice_weeks != null, value: p.notice_weeks != null ? `${p.notice_weeks} weeks` : null }
	];
	return { items, done: items.filter((i) => i.done).length, total: items.length };
}

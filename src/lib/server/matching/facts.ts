import type { CandidateRow, RoleRow } from '../../types';
import { CandidateProfile, RoleSpec, emptyCandidateProfile, emptyRoleSpec } from '../../schemas';
import { parseJson } from '../db';

// Blind-safe facts about a candidate: shown on employer cards and fed to the
// matcher. Deliberately excludes salary floor, name and anything identifying.

export interface CandidateFacts {
	titles: string[];
	seniority: string | null;
	years: number | null;
	location: string | null;
	workMode: string | null;
	noticeWeeks: number | null;
	rightToWorkUk: boolean | null;
	wants: string[];
}

export function candidateFacts(row: Pick<CandidateRow, 'profile_json'>): CandidateFacts {
	const parsed = CandidateProfile.safeParse(parseJson(row.profile_json, null));
	const p = parsed.success ? parsed.data : emptyCandidateProfile();
	return {
		titles: p.target_titles,
		seniority: p.seniority,
		years: p.years_experience,
		location: p.location,
		workMode: p.work_mode,
		noticeWeeks: p.notice_weeks,
		rightToWorkUk: p.right_to_work_uk,
		wants: p.wants
	};
}

export function factsText(f: CandidateFacts): string {
	return [
		f.titles.length && `Targets: ${f.titles.join(', ')}`,
		f.seniority && `Seniority: ${f.seniority}`,
		f.years != null && `Experience: ${f.years} yrs`,
		(f.location || f.workMode) && `Location: ${[f.location, f.workMode].filter(Boolean).join(', ')}`,
		f.noticeWeeks != null && `Notice: ${f.noticeWeeks} weeks`,
		f.wants.length && `Wants: ${f.wants.join('; ')}`
	]
		.filter(Boolean)
		.join('\n');
}

export function roleSpecOf(row: RoleRow): RoleSpec {
	const parsed = RoleSpec.safeParse(parseJson(row.spec_json, null));
	return parsed.success ? parsed.data : emptyRoleSpec();
}

export function roleText(row: RoleRow): string {
	const r = roleSpecOf(row);
	return [
		`Title: ${r.title ?? 'untitled'}${r.seniority ? ` (${r.seniority})` : ''}`,
		`Must-haves:\n${r.must_haves.map((m) => `- ${m}`).join('\n') || '- none given'}`,
		r.nice_to_haves.length && `Nice-to-haves:\n${r.nice_to_haves.map((m) => `- ${m}`).join('\n')}`,
		`Salary: £${r.salary_min_gbp ?? '?'}–£${r.salary_max_gbp ?? '?'}`,
		`Work: ${[r.work_mode, r.location, r.office_days_per_week != null && `${r.office_days_per_week} office days`].filter(Boolean).join(', ')}`,
		r.team && `Team: ${r.team}`,
		row.summary && `Summary: ${row.summary}`
	]
		.filter(Boolean)
		.join('\n');
}

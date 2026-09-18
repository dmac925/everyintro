// Row shapes as they come out of D1. JSON columns stay as strings here;
// parse them with the zod schemas in ./schemas.ts.

export type UserKind = 'candidate' | 'employer' | 'admin';

export interface User {
	id: string;
	email: string;
	name: string | null;
	kind: UserKind;
}

export type CandidateStatus = 'onboarding' | 'active' | 'paused';

export interface CandidateRow {
	user_id: string;
	status: CandidateStatus;
	profile_json: string | null;
	blind_summary: string | null;
	salary_floor: number | null;
	location: string | null;
	work_mode: string | null;
	right_to_work_uk: number | null;
	notice_weeks: number | null;
	profile_version: number;
	embedded_version: number;
	last_active_at: string;
	created_at: string;
}

export interface CompanyRow {
	id: string;
	name: string;
	domain: string;
	companies_house_no: string | null;
	verified_at: string | null;
	roles_opened: number;
	created_at: string;
}

export type RoleStatus = 'draft' | 'awaiting_payment' | 'open' | 'closed' | 'expired';

export interface RoleRow {
	id: string;
	company_id: string;
	created_by: string | null;
	status: RoleStatus;
	title: string | null;
	spec_json: string | null;
	summary: string | null;
	salary_min: number | null;
	salary_max: number | null;
	location: string | null;
	work_mode: string | null;
	sponsorship: number | null;
	spec_version: number;
	embedded_version: number;
	free_slot: number | null;
	opened_at: string | null;
	expires_at: string | null;
	last_matched_at: string | null;
	created_at: string;
}

export type ConversationKind = 'candidate_intake' | 'role_intake';

export interface ConversationRow {
	id: string;
	kind: ConversationKind;
	user_id: string | null; // NULL while anonymous
	subject_id: string | null;
	anon_token: string | null;
	ip_hash: string | null;
	draft_json: string | null;
	messages_json: string;
	status: 'open' | 'complete';
	turns: number;
	created_at: string;
	updated_at: string;
}

export type MatchStatus = 'shown' | 'passed' | 'requested';

export interface MatchRow {
	id: string;
	role_id: string;
	candidate_id: string;
	fit: number;
	why_json: string;
	gaps_json: string;
	status: MatchStatus;
	pass_reason: string | null;
	run_id: string | null;
	model: string | null;
	interested_at: string | null; // candidate raised a hand (issue #7)
	created_at: string;
	updated_at: string;
}

export type IntroStatus = 'requested' | 'accepted' | 'declined' | 'expired';

export interface IntroRow {
	id: string;
	match_id: string;
	role_id: string;
	candidate_id: string;
	company_id: string;
	status: IntroStatus;
	decline_reason: string | null;
	requested_at: string;
	responded_at: string | null;
	expires_at: string;
	hired_at: string | null;
}

export interface PublicJobRow {
	id: string;
	source: string;
	board: string;
	company_name: string;
	title: string;
	location: string | null;
	work_mode: string | null;
	url: string;
	description_text: string | null;
	salary_min: number | null;
	salary_max: number | null;
	embedded: number;
	first_seen_at: string;
	last_seen_at: string;
}

// Blind candidate card for employers. No name, contact or salary floor.
export interface MatchCardData {
	matchId: string;
	ref: string; // short, non-identifying label, e.g. "A7F2"
	fit: number;
	why: string[];
	gaps: string[];
	status: MatchStatus;
	interested: boolean; // the candidate raised a hand on this role
	weak: boolean; // below MIN_FIT_TO_SHOW; only revealed via "show more"
	facts: {
		titles: string[];
		seniority: string | null;
		years: number | null;
		location: string | null;
		workMode: string | null;
		noticeWeeks: number | null;
		rightToWorkUk: boolean | null;
	};
	summary: string;
}

// Inline choice card in the chat: tappable options for a hard-to-type answer.
// Picking one sends `send` as the user's next message.
export interface ChoiceCard {
	field: string;
	title: string;
	note: string | null;
	private: boolean;
	options: { label: string; send: string }[];
	confirm_template: string | null; // "Set {label} floor"
	other?: boolean; // show an "Other" chip that focuses the composer (default true)
}

// What the chat UI renders, tool calls and thinking are stripped server-side.
export interface ChatLine {
	role: 'user' | 'assistant';
	text: string;
	card?: ChoiceCard;
	cardDone?: boolean;
}

// Events streamed (NDJSON) from /api/intake/[id] to the chat panel.
export type IntakeEvent =
	| { type: 'text'; delta: string }
	| { type: 'card'; card: ChoiceCard }
	| { type: 'draft'; draft: unknown }
	| { type: 'complete' }
	// Anonymous chat has used its free turns (or finished): ask for an email.
	| { type: 'gate' }
	| { type: 'error'; message: string };

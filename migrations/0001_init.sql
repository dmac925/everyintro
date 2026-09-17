-- EveryIntro initial schema. Apply with: npm run db:migrate:local
-- JSON columns hold zod-validated shapes from src/lib/schemas.ts.

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	kind TEXT NOT NULL CHECK (kind IN ('candidate', 'employer', 'admin')),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per candidate user. Contact details live on users and are only
-- released to an employer through an accepted intro.
CREATE TABLE candidates (
	user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'paused')),
	profile_json TEXT,                -- CandidateProfile (full, private)
	blind_summary TEXT,               -- what the matcher and employers see
	-- Denormalised from profile_json for the hard-filter SQL:
	salary_floor INTEGER,             -- GBP/yr, never shown to employers
	location TEXT,
	work_mode TEXT,                   -- onsite | hybrid | remote | any
	right_to_work_uk INTEGER,         -- 0 / 1
	notice_weeks INTEGER,
	cv_key TEXT,                      -- R2 key of an uploaded CV, released only on accepted intro
	profile_version INTEGER NOT NULL DEFAULT 0,
	embedded_version INTEGER NOT NULL DEFAULT 0,
	last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX candidates_status ON candidates(status, last_active_at);

CREATE TABLE companies (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	domain TEXT NOT NULL UNIQUE,
	companies_house_no TEXT,
	verified_at TEXT,
	roles_opened INTEGER NOT NULL DEFAULT 0,   -- drives the free-10 rule
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE company_members (
	company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	PRIMARY KEY (company_id, user_id)
);
CREATE UNIQUE INDEX company_members_user ON company_members(user_id);

CREATE TABLE roles (
	id TEXT PRIMARY KEY,
	company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	created_by TEXT REFERENCES users(id),
	status TEXT NOT NULL DEFAULT 'draft'
		CHECK (status IN ('draft', 'awaiting_payment', 'open', 'closed', 'expired')),
	title TEXT,
	spec_json TEXT,                   -- RoleSpec
	summary TEXT,                     -- blind-safe summary shown to candidates on intro
	salary_min INTEGER,
	salary_max INTEGER,
	location TEXT,
	work_mode TEXT,
	sponsorship INTEGER,              -- 0 / 1
	spec_version INTEGER NOT NULL DEFAULT 0,
	embedded_version INTEGER NOT NULL DEFAULT 0,
	free_slot INTEGER,                -- 1 if it used one of the 10 free roles
	opened_at TEXT,
	expires_at TEXT,
	last_matched_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX roles_company ON roles(company_id, status);

-- Intake chat transcripts. messages_json is the raw Anthropic message array
-- (including tool_use / tool_result / thinking blocks) so turns can be replayed.
-- Candidate intakes can start anonymously from the homepage: user_id is NULL,
-- the caller holds anon_token in a cookie, and the profile draft lives in
-- draft_json until sign-in claims the conversation (see claimConversation).
CREATE TABLE conversations (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('candidate_intake', 'role_intake')),
	user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
	subject_id TEXT,                  -- candidate user_id or role id; NULL while anonymous
	anon_token TEXT UNIQUE,
	ip_hash TEXT,
	draft_json TEXT,                  -- { profile, blind_summary, cv_key } while anonymous
	messages_json TEXT NOT NULL DEFAULT '[]',
	status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
	turns INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX conversations_subject ON conversations(subject_id, created_at);
CREATE INDEX conversations_ip ON conversations(ip_hash, created_at);

CREATE TABLE matches (
	id TEXT PRIMARY KEY,
	role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	candidate_id TEXT NOT NULL REFERENCES candidates(user_id) ON DELETE CASCADE,
	fit INTEGER NOT NULL,             -- 1..5
	why_json TEXT NOT NULL,           -- string[]
	gaps_json TEXT NOT NULL,          -- string[]
	status TEXT NOT NULL DEFAULT 'shown' CHECK (status IN ('shown', 'passed', 'requested')),
	pass_reason TEXT,
	run_id TEXT,
	model TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (role_id, candidate_id)
);

CREATE TABLE intros (
	id TEXT PRIMARY KEY,
	match_id TEXT NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
	role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	candidate_id TEXT NOT NULL REFERENCES candidates(user_id) ON DELETE CASCADE,
	company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'requested'
		CHECK (status IN ('requested', 'accepted', 'declined', 'expired')),
	decline_reason TEXT,
	requested_at TEXT NOT NULL DEFAULT (datetime('now')),
	responded_at TEXT,
	expires_at TEXT NOT NULL
);
CREATE INDEX intros_candidate ON intros(candidate_id, status);
CREATE INDEX intros_company ON intros(company_id, status);

-- Public ATS boards to ingest (Greenhouse / Lever / Ashby).
CREATE TABLE job_sources (
	source TEXT NOT NULL CHECK (source IN ('greenhouse', 'lever', 'ashby')),
	board TEXT NOT NULL,
	company_name TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 1,
	last_fetched_at TEXT,
	last_error TEXT,
	PRIMARY KEY (source, board)
);

CREATE TABLE public_jobs (
	id TEXT PRIMARY KEY,              -- source:board:external_id
	source TEXT NOT NULL,
	board TEXT NOT NULL,
	company_name TEXT NOT NULL,
	title TEXT NOT NULL,
	location TEXT,
	work_mode TEXT,
	url TEXT NOT NULL,
	description_text TEXT,
	salary_min INTEGER,
	salary_max INTEGER,
	embedded INTEGER NOT NULL DEFAULT 0,
	first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
	last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX public_jobs_seen ON public_jobs(last_seen_at);

-- Weekly digest picks, per candidate.
CREATE TABLE digest_items (
	candidate_id TEXT NOT NULL REFERENCES candidates(user_id) ON DELETE CASCADE,
	job_id TEXT NOT NULL REFERENCES public_jobs(id) ON DELETE CASCADE,
	fit INTEGER NOT NULL,
	why TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (candidate_id, job_id)
);

CREATE TABLE billing_events (
	id TEXT PRIMARY KEY,
	company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	amount_pence INTEGER NOT NULL,
	stripe_session_id TEXT UNIQUE,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every Claude call logs its token usage here so real costs can be measured
-- (see /admin). Cheap to keep; prune after 90 days if it grows.
CREATE TABLE llm_usage (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	purpose TEXT NOT NULL,            -- candidate_intake | role_intake | rerank | digest
	model TEXT NOT NULL,
	input_tokens INTEGER NOT NULL,
	output_tokens INTEGER NOT NULL,
	cache_read_tokens INTEGER NOT NULL DEFAULT 0,
	cache_write_tokens INTEGER NOT NULL DEFAULT 0,
	subject_id TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX llm_usage_created ON llm_usage(created_at);

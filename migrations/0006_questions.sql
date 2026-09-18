-- Anonymous follow-up questions from an employer to a shortlisted candidate
-- (issues #13, #14). The agent answers from the profile when it can, otherwise
-- the candidate answers on /me/questions. Nobody is revealed.
CREATE TABLE questions (
	id TEXT PRIMARY KEY,
	role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
	candidate_id TEXT NOT NULL REFERENCES candidates(user_id) ON DELETE CASCADE,
	company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
	asked_by TEXT REFERENCES users(id),
	batch_id TEXT,                    -- shared by one question sent to several cards
	text TEXT NOT NULL,               -- what the employer typed
	sent_text TEXT,                   -- what the candidate sees, after the screening rewrite
	status TEXT NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'answered_by_agent', 'sent', 'answered', 'declined', 'refused')),
	answer TEXT,
	answer_source TEXT CHECK (answer_source IN ('profile', 'candidate')),
	refusal_reason TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	answered_at TEXT
);
CREATE INDEX questions_match ON questions(match_id, created_at);
CREATE INDEX questions_candidate ON questions(candidate_id, status);
CREATE INDEX questions_role ON questions(role_id, created_at);

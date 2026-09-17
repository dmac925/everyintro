-- One-time codes for verifying an employer's work email on /post.
CREATE TABLE email_codes (
	email TEXT PRIMARY KEY,
	code_hash TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

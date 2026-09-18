-- Candidates can raise a hand on a role that matched them (issue #7). Shown to
-- the employer as an "Interested" badge on the still-anonymous card.
ALTER TABLE matches ADD COLUMN interested_at TEXT;

-- Example public boards to ingest. Replace with the ~300 UK companies for your
-- launch niche. The four below are unverified examples. Board slugs come from the company's careers URL, e.g.
--   boards.greenhouse.io/<board>   jobs.lever.co/<board>   jobs.ashbyhq.com/<board>
INSERT OR IGNORE INTO job_sources (source, board, company_name) VALUES
	('greenhouse', 'monzo', 'Monzo'),
	('greenhouse', 'deliveroo', 'Deliveroo'),
	('lever', 'palantir', 'Palantir'),
	('ashby', 'cleo', 'Cleo');

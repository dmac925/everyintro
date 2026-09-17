-- Pricing moves from per role to per hire. Roles and intros are free; a flat
-- fee is due when an accepted intro becomes a hire (marked on /company/intros).
ALTER TABLE intros ADD COLUMN hired_at TEXT;
ALTER TABLE billing_events ADD COLUMN intro_id TEXT REFERENCES intros(id) ON DELETE SET NULL;
CREATE INDEX billing_events_intro ON billing_events(intro_id);

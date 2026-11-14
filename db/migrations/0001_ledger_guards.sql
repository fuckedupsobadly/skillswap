-- Ledger guards: the hour ledger is append-only. Nothing is edited; corrections are new entries.
CREATE OR REPLACE FUNCTION ledger_entries_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only (% rejected)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_update_delete
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_append_only();
--> statement-breakpoint
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_amount_positive CHECK (amount_min > 0);
--> statement-breakpoint
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_distinct_accounts CHECK (debit_account <> credit_account);
--> statement-breakpoint
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_hash_format CHECK (hash ~ '^[0-9a-f]{64}$' AND prev_hash ~ '^[0-9a-f]{64}$');
--> statement-breakpoint
ALTER TABLE holds ADD CONSTRAINT holds_amount_positive CHECK (amount_min > 0);
--> statement-breakpoint
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE member_skills ADD CONSTRAINT member_skills_level_range CHECK (level BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE availability ADD CONSTRAINT availability_range CHECK (weekday BETWEEN 0 AND 6 AND start_min >= 0 AND end_min <= 1440 AND start_min < end_min);
--> statement-breakpoint
-- Search: trigram + full-text on the skill taxonomy (no extra search service).
CREATE INDEX skills_name_trgm ON skills USING gin ((name || ' ' || keywords) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX skills_fts ON skills USING gin (to_tsvector('english', name || ' ' || keywords));
--> statement-breakpoint
CREATE INDEX members_display_trgm ON members USING gin (display_name gin_trgm_ops);

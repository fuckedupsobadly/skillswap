-- XP is an append-only log, like the hour ledger: corrections are reversing rows, never edits.
CREATE OR REPLACE FUNCTION xp_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'xp_events is append-only (% rejected)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER xp_events_no_update_delete
  BEFORE UPDATE OR DELETE ON xp_events
  FOR EACH ROW EXECUTE FUNCTION xp_events_append_only();
--> statement-breakpoint
ALTER TABLE member_progress ADD CONSTRAINT member_progress_level_range CHECK (level BETWEEN 1 AND 50);
--> statement-breakpoint
ALTER TABLE member_progress ADD CONSTRAINT member_progress_treats_nonneg CHECK (treats >= 0);
--> statement-breakpoint
ALTER TABLE kitties ADD CONSTRAINT kitties_name_length CHECK (char_length(name) BETWEEN 1 AND 16);
--> statement-breakpoint
ALTER TABLE kitty_needs ADD CONSTRAINT kitty_needs_range CHECK (hunger BETWEEN 0 AND 1 AND energy BETWEEN 0 AND 1 AND play BETWEEN 0 AND 1 AND affection BETWEEN 0 AND 1);

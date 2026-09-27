begin;

-- This migration only restores canonical static prerequisites that may be
-- missing from a Supabase Preview Branch. Removing shared plans, settings,
-- buckets, or owner policies could orphan existing profiles and sale files,
-- so rollback intentionally preserves the repaired baseline.

commit;

begin;

-- Supabase ProductionのALTER DEFAULT PRIVILEGESで新規tableへ自動付与される
-- UPDATE/TRUNCATE/REFERENCES/TRIGGERを除去し、機能契約の最小権限へ固定する。
revoke all on public.marketplace_favorites
from public, anon, authenticated, service_role;

grant select, insert, delete on public.marketplace_favorites to authenticated;
grant select, insert, update, delete on public.marketplace_favorites to service_role;

commit;

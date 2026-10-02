begin;

-- Rollbackでも危険な既定権限を再付与しない。前migrationが意図した
-- 最小権限を再確立し、続く202610020001 rollbackがtableを削除する。
revoke all on public.marketplace_favorites
from public, anon, authenticated, service_role;

grant select, insert, delete on public.marketplace_favorites to authenticated;
grant select, insert, update, delete on public.marketplace_favorites to service_role;

commit;

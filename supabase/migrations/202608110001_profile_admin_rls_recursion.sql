begin;

-- profilesのRLS policyから呼ばれるため、invoker権限でprofilesを再参照すると
-- is_admin() -> profiles RLS -> is_admin() の再帰になる。
-- auth.uid()に対応するadmin行の有無だけを返し、固定search_pathで実行する。
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

commit;

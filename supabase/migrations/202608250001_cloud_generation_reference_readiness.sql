begin;

create table public.cloud_project_generation_readiness_policies (
  project_id uuid primary key references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  major_character_reference_policy text not null default 'block'
    check(major_character_reference_policy in('warn','block')),
  updated_at timestamptz not null default now(),
  unique(project_id,owner_profile_id)
);
alter table public.cloud_project_generation_readiness_policies enable row level security;
grant select on public.cloud_project_generation_readiness_policies to authenticated;
grant select,insert,update,delete on public.cloud_project_generation_readiness_policies to service_role;
create policy "cloud_project_generation_readiness_policies_owner_read"
  on public.cloud_project_generation_readiness_policies for select
  using(owner_profile_id=public.current_profile_id());

create or replace function public.save_cloud_project_generation_readiness_policy(
  p_project_id uuid,p_major_character_reference_policy text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();
begin
  if v_owner is null or p_major_character_reference_policy not in('warn','block')
    or not exists(select 1 from public.cloud_projects p where p.id=p_project_id and p.owner_profile_id=v_owner)
  then raise exception 'cloud_generation_readiness_policy_invalid';end if;
  insert into public.cloud_project_generation_readiness_policies(project_id,owner_profile_id,major_character_reference_policy)
  values(p_project_id,v_owner,p_major_character_reference_policy)
  on conflict(project_id) do update set major_character_reference_policy=excluded.major_character_reference_policy,updated_at=now()
  where cloud_project_generation_readiness_policies.owner_profile_id=v_owner;
end$$;
revoke all on function public.save_cloud_project_generation_readiness_policy(uuid,text) from public,anon;
grant execute on function public.save_cloud_project_generation_readiness_policy(uuid,text) to authenticated,service_role;
comment on table public.cloud_project_generation_readiness_policies is 'Project policy for missing approved major-character identity references. Runtime use is feature-gated.';
notify pgrst, 'reload schema';
commit;

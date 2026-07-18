begin;

create table public.cloud_ai_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(char_length(action) between 1 and 100),
  target_type text not null check(char_length(target_type) between 1 and 100),
  target_id text not null check(char_length(target_id) between 1 and 255),
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index cloud_ai_admin_audit_created_idx
  on public.cloud_ai_admin_audit_logs(created_at desc);
alter table public.cloud_ai_admin_audit_logs enable row level security;
grant select,insert on public.cloud_ai_admin_audit_logs to service_role;

commit;

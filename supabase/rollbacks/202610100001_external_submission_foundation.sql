begin;

do $$
begin
  if exists(select 1 from public.external_seller_profiles)
     or exists(select 1 from public.external_seller_profile_events)
     or exists(select 1 from public.external_work_submissions)
     or exists(select 1 from public.external_work_rights_declarations)
     or exists(select 1 from public.external_work_submission_events) then
    raise exception 'external_submission_foundation_rollback_requires_empty_tables';
  end if;
end;
$$;

drop function if exists public.transition_external_work_submission(uuid,text,text);
drop function if exists public.record_external_work_rights_declaration(
  uuid,text,boolean,boolean,boolean,boolean
);
drop function if exists public.create_external_work_submission(text,text,text,text);
drop function if exists public.set_external_seller_status(uuid,text,text);
drop function if exists public.accept_external_seller_terms(text);

drop table if exists public.external_work_submission_events;
drop table if exists public.external_work_rights_declarations;
drop table if exists public.external_work_submissions;
drop table if exists public.external_seller_profile_events;
drop table if exists public.external_seller_profiles;
drop function if exists public.prevent_external_submission_audit_mutation();

commit;

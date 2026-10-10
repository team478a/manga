begin;
do $$ begin
  if exists(select 1 from public.external_work_submissions where product_id is not null)
     or exists(select 1 from public.external_submission_notifications) then
    raise exception 'external_submission_review_publish_rollback_requires_empty_data';
  end if;
end$$;
drop function if exists public.stop_external_marketplace_listing(uuid,text);
drop function if exists public.withdraw_external_marketplace_listing(uuid);
drop function if exists public.publish_external_marketplace_listing(uuid);
drop function if exists public.review_external_work_submission(uuid,text,text);
drop function if exists public.submit_external_work_for_review(uuid,integer,text,boolean,boolean,boolean,boolean);
drop trigger if exists digital_products_external_listing_guard on public.digital_products;
drop function if exists public.enforce_external_listing_product_guard();
drop trigger if exists works_external_listing_guard on public.works;
drop function if exists public.enforce_external_listing_work_guard();
alter table public.external_work_submission_events drop constraint if exists external_work_submission_events_event_type_check;
alter table public.external_work_submission_events add constraint external_work_submission_events_event_type_check check(event_type in(
  'created','rights_declared','status_changed','upload_registered','validation_queued',
  'validation_completed','validation_failed','pages_reordered','samples_updated','publication_created'
));
drop table if exists public.external_submission_notifications;
drop index if exists public.digital_products_external_submission_idx;
alter table public.digital_products drop column if exists external_submission_id;
drop index if exists public.external_work_submissions_product_idx;
alter table public.external_work_submissions drop column if exists product_id,drop column if exists asking_price;
create or replace function public.transition_external_work_submission(
  p_submission_id uuid,
  p_status text,
  p_reason_code text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=public.current_profile_id();
  v_role text:=auth.role();
  v_submission public.external_work_submissions%rowtype;
  v_is_admin boolean:=public.is_admin();
  v_allowed boolean:=false;
begin
  if p_status not in (
    'draft','uploading','validating','ready','submitted',
    'in_review','approved','rejected','published','paused'
  ) then raise exception 'external_submission_status_invalid'; end if;
  if p_reason_code is not null
     and p_reason_code !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception 'external_submission_reason_invalid';
  end if;
  if p_status in ('rejected','paused') and p_reason_code is null then
    raise exception 'external_submission_reason_required';
  end if;

  select * into v_submission from public.external_work_submissions
  where id=p_submission_id for update;
  if not found then raise exception 'external_submission_not_found'; end if;
  if v_submission.status=p_status then return p_submission_id; end if;

  if v_actor=v_submission.owner_profile_id then
    v_allowed:=(v_submission.status='draft' and p_status='uploading')
      or (v_submission.status in ('ready','rejected') and p_status='submitted');
  elsif v_is_admin then
    v_allowed:=(v_submission.status='submitted' and p_status='in_review')
      or (v_submission.status='in_review' and p_status in ('approved','rejected'))
      or (v_submission.status in ('approved','published') and p_status='paused');
  elsif v_role='service_role' then
    v_allowed:=(v_submission.status='uploading' and p_status='validating')
      or (v_submission.status='validating' and p_status in ('ready','rejected'));
  end if;
  if not v_allowed then raise exception 'external_submission_transition_forbidden'; end if;

  if p_status='submitted' then
    if not exists(
      select 1 from public.external_seller_profiles seller
      where seller.profile_id=v_submission.owner_profile_id and seller.status='eligible'
    ) then raise exception 'external_seller_not_eligible'; end if;
    if not exists(
      select 1
      from (
        select declaration.*
        from public.external_work_rights_declarations declaration
        where declaration.submission_id=p_submission_id
        order by declaration.created_at desc,declaration.id desc
        limit 1
      ) latest
      where latest.rights_holder_confirmed
        and latest.third_party_permissions_confirmed
        and latest.ai_use_disclosed
        and latest.adult_content_absent
    ) then raise exception 'external_rights_declaration_required'; end if;
  end if;

  update public.external_work_submissions set
    status=p_status,
    submitted_at=case when p_status='submitted' then now() else submitted_at end,
    reviewed_by_profile_id=case
      when p_status in ('approved','rejected') then v_actor
      else reviewed_by_profile_id
    end,
    reviewed_at=case
      when p_status in ('approved','rejected') then now()
      else reviewed_at
    end,
    review_reason_code=case
      when p_status in ('rejected','paused') then p_reason_code
      when p_status='approved' then null
      else review_reason_code
    end,
    version=version+1
  where id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status,reason_code
  ) values(
    p_submission_id,v_actor,'status_changed',v_submission.status,p_status,p_reason_code
  );
  return p_submission_id;
end;
$$;
commit;

begin;

alter table public.external_work_submissions
  add column if not exists asking_price integer check(asking_price>=0),
  add column if not exists product_id uuid references public.digital_products(id) on delete restrict;
create unique index if not exists external_work_submissions_product_idx
on public.external_work_submissions(product_id) where product_id is not null;

alter table public.digital_products
  add column if not exists external_submission_id uuid
    references public.external_work_submissions(id) on delete restrict;
create unique index if not exists digital_products_external_submission_idx
on public.digital_products(external_submission_id) where external_submission_id is not null;

create table if not exists public.external_submission_notifications(
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  submission_id uuid not null references public.external_work_submissions(id) on delete restrict,
  notification_type text not null check(notification_type in(
    'submitted','in_review','approved','rejected','published','withdrawn','admin_stopped'
  )),
  reason_code text check(reason_code is null or reason_code~'^[a-z0-9][a-z0-9._-]{0,63}$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists external_submission_notifications_profile_created_idx
on public.external_submission_notifications(profile_id,created_at desc);
alter table public.external_submission_notifications enable row level security;
drop policy if exists external_submission_notifications_select on public.external_submission_notifications;
create policy external_submission_notifications_select on public.external_submission_notifications
for select to authenticated using(profile_id=public.current_profile_id() or public.is_admin());
revoke all on public.external_submission_notifications from public,anon,authenticated;
grant select on public.external_submission_notifications to authenticated;

alter table public.external_work_submission_events
drop constraint if exists external_work_submission_events_event_type_check;
alter table public.external_work_submission_events add constraint
external_work_submission_events_event_type_check check(event_type in(
  'created','rights_declared','status_changed','upload_registered',
  'validation_queued','validation_completed','validation_failed','pages_reordered',
  'samples_updated','publication_created','product_created','listing_published',
  'listing_withdrawn','admin_stopped'
));

create or replace function public.enforce_external_listing_work_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_action text:=current_setting('mangai.external_listing_action',true);
begin
  if old.external_submission_id is null and new.external_submission_id is null then return new;end if;
  if new.external_submission_id is distinct from old.external_submission_id
     or new.creator_id is distinct from old.creator_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.image_url is distinct from old.image_url
     or new.sample_image_urls is distinct from old.sample_image_urls
     or new.content_class is distinct from old.content_class
     or new.tags is distinct from old.tags
     or new.source_project_id is distinct from old.source_project_id then
    raise exception 'external_listing_work_immutable';
  end if;
  if (new.status is distinct from old.status or new.is_public is distinct from old.is_public)
     and v_action not in('publish','withdraw','admin_stop') then
    raise exception 'external_listing_work_managed';
  end if;
  if (new.current_publication_id is distinct from old.current_publication_id
      or new.published_version is distinct from old.published_version)
     and not(old.current_publication_id is null and not old.is_public and old.status='draft'
             and v_action='review_setup') then
    raise exception 'external_listing_publication_immutable';
  end if;
  return new;
end$$;
drop trigger if exists works_external_listing_guard on public.works;
create trigger works_external_listing_guard before update on public.works
for each row execute function public.enforce_external_listing_work_guard();

create or replace function public.enforce_external_listing_product_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_action text:=current_setting('mangai.external_listing_action',true);v_submission_id uuid;
begin
  select work.external_submission_id into v_submission_id from public.works work where work.id=new.work_id;
  if coalesce(new.external_submission_id,v_submission_id) is null then return new;end if;
  if new.external_submission_id is distinct from v_submission_id then
    raise exception 'external_listing_product_link_invalid';end if;
  if tg_op='INSERT' then
    if v_action<>'review_setup' or new.status<>'paused'
       or nullif(to_jsonb(new)->>'file_url','') is not null then
      raise exception 'external_listing_product_managed';end if;
  elsif new.work_id is distinct from old.work_id
     or new.creator_id is distinct from old.creator_id
     or new.external_submission_id is distinct from old.external_submission_id
     or (to_jsonb(new)->'title') is distinct from (to_jsonb(old)->'title')
     or (to_jsonb(new)->'description') is distinct from (to_jsonb(old)->'description')
     or (to_jsonb(new)->'file_url') is distinct from (to_jsonb(old)->'file_url')
     or new.price is distinct from old.price then
    raise exception 'external_listing_product_immutable';
  elsif new.status is distinct from old.status and (
    (new.status='active' and v_action<>'publish') or
    (new.status='paused' and v_action not in('withdraw','admin_stop')) or
    new.status='archived'
  ) then raise exception 'external_listing_product_managed';end if;
  return new;
end$$;
drop trigger if exists digital_products_external_listing_guard on public.digital_products;
create trigger digital_products_external_listing_guard before insert or update on public.digital_products
for each row execute function public.enforce_external_listing_product_guard();

create or replace function public.submit_external_work_for_review(
  p_submission_id uuid,p_price integer,p_declaration_version text,
  p_rights_holder_confirmed boolean,p_third_party_permissions_confirmed boolean,
  p_ai_use_disclosed boolean,p_adult_content_absent boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;
begin
  if p_price is null or p_price<0 or p_declaration_version is null
     or p_declaration_version!~'^[a-z0-9][a-z0-9._-]{0,63}$'
     or not coalesce(p_rights_holder_confirmed,false)
     or not coalesce(p_third_party_permissions_confirmed,false)
     or not coalesce(p_ai_use_disclosed,false)
     or not coalesce(p_adult_content_absent,false) then
    raise exception 'external_submission_review_input_invalid';end if;
  select * into v_submission from public.external_work_submissions
  where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status not in('ready','rejected')
     or v_submission.content_class<>'general' then
    raise exception 'external_submission_not_submittable';end if;
  if not exists(select 1 from public.external_seller_profiles
    where profile_id=v_owner and status='eligible')
     or not exists(select 1 from public.external_work_submission_pages
       where submission_id=p_submission_id and validation_status='validated' and is_sample) then
    raise exception 'external_submission_not_submittable';end if;
  if not exists(select 1 from public.external_work_rights_declarations d
    where d.submission_id=p_submission_id and d.declaration_version=p_declaration_version
      and d.rights_holder_confirmed and d.third_party_permissions_confirmed
      and d.ai_use_disclosed and d.adult_content_absent) then
    insert into public.external_work_rights_declarations(
      submission_id,declaration_version,declared_by_profile_id,rights_holder_confirmed,
      third_party_permissions_confirmed,ai_use_disclosed,adult_content_absent
    ) values(p_submission_id,p_declaration_version,v_owner,true,true,true,true);
    insert into public.external_work_submission_events(
      submission_id,actor_profile_id,event_type,from_status,to_status
    ) values(p_submission_id,v_owner,'rights_declared',v_submission.status,v_submission.status);
  end if;
  update public.external_work_submissions set status='submitted',asking_price=p_price,
    submitted_at=now(),reviewed_by_profile_id=null,reviewed_at=null,review_reason_code=null,
    version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status
  ) values(p_submission_id,v_owner,'status_changed',v_submission.status,'submitted');
  insert into public.external_submission_notifications(profile_id,submission_id,notification_type)
  values(v_owner,p_submission_id,'submitted');
  return p_submission_id;
end$$;

create or replace function public.transition_external_work_submission(
  p_submission_id uuid,p_status text,p_reason_code text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.current_profile_id();v_role text:=auth.role();
  v_submission public.external_work_submissions%rowtype;v_allowed boolean:=false;
begin
  if p_status not in('draft','uploading','validating','ready','submitted','in_review','approved','rejected','published','paused')
     or (p_reason_code is not null and p_reason_code!~'^[a-z0-9][a-z0-9._-]{0,63}$')
     or (p_status='rejected' and p_reason_code is null) then
    raise exception 'external_submission_transition_invalid';end if;
  select * into v_submission from public.external_work_submissions where id=p_submission_id for update;
  if not found then raise exception 'external_submission_not_found';end if;
  if v_submission.status=p_status then return p_submission_id;end if;
  if v_actor=v_submission.owner_profile_id then
    v_allowed:=v_submission.status='draft' and p_status='uploading';
  elsif v_role='service_role' then
    v_allowed:=(v_submission.status='uploading' and p_status='validating')
      or (v_submission.status='validating' and p_status in('ready','rejected'));
  end if;
  if not v_allowed then raise exception 'external_submission_transition_forbidden';end if;
  update public.external_work_submissions set status=p_status,
    review_reason_code=case when p_status='rejected' then p_reason_code else review_reason_code end,
    version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status,reason_code
  ) values(p_submission_id,v_actor,'status_changed',v_submission.status,p_status,p_reason_code);
  return p_submission_id;
end$$;

create or replace function public.review_external_work_submission(
  p_submission_id uuid,p_decision text,p_reason_code text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;
  v_work_id uuid;v_publication_id uuid;v_product_id uuid:=gen_random_uuid();
begin
  if v_actor is null or not public.is_admin() then raise exception 'external_review_admin_required';end if;
  if p_decision not in('in_review','approved','rejected')
     or (p_reason_code is not null and p_reason_code!~'^[a-z0-9][a-z0-9._-]{0,63}$')
     or (p_decision='rejected' and p_reason_code is null) then
    raise exception 'external_review_input_invalid';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,0));
  select * into v_submission from public.external_work_submissions where id=p_submission_id for update;
  if not found or not((v_submission.status='submitted' and p_decision in('in_review','approved','rejected'))
    or (v_submission.status='in_review' and p_decision in('approved','rejected'))) then
    raise exception 'external_review_transition_forbidden';end if;
  if p_decision='approved' and (v_submission.asking_price is null
     or not exists(select 1 from public.external_seller_profiles where profile_id=v_submission.owner_profile_id and status='eligible')) then
    raise exception 'external_review_qualification_invalid';end if;
  update public.external_work_submissions set status=p_decision,
    reviewed_by_profile_id=case when p_decision in('approved','rejected') then v_actor else reviewed_by_profile_id end,
    reviewed_at=case when p_decision in('approved','rejected') then now() else reviewed_at end,
    review_reason_code=case when p_decision='rejected' then p_reason_code else null end,
    version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status,reason_code
  ) values(p_submission_id,v_actor,'status_changed',v_submission.status,p_decision,p_reason_code);
  if p_decision='approved' then
    perform set_config('mangai.external_listing_action','review_setup',true);
    select created.work_id,created.publication_id into v_work_id,v_publication_id
      from public.create_external_work_publication(p_submission_id) created;
    if exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='digital_products' and column_name='title') then
      execute 'insert into public.digital_products(
        id,work_id,creator_id,title,description,file_url,price,status,external_submission_id
      ) values($1,$2,$3,$4,$5,$6,$7,$8,$9)'
      using v_product_id,v_work_id,v_submission.owner_profile_id,
        v_submission.title||' デジタル版',v_submission.description,null,
        v_submission.asking_price,'paused',p_submission_id;
    else
      insert into public.digital_products(id,work_id,creator_id,price,status,external_submission_id)
      values(v_product_id,v_work_id,v_submission.owner_profile_id,
        v_submission.asking_price,'paused',p_submission_id);
    end if;
    update public.external_work_submissions set product_id=v_product_id,version=version+1
      where id=p_submission_id;
    insert into public.external_work_submission_events(
      submission_id,actor_profile_id,event_type,from_status,to_status
    ) values(p_submission_id,v_actor,'product_created','approved','approved');
  end if;
  insert into public.external_submission_notifications(
    profile_id,submission_id,notification_type,reason_code
  ) values(v_submission.owner_profile_id,p_submission_id,p_decision,p_reason_code);
  return p_submission_id;
end$$;

create or replace function public.publish_external_marketplace_listing(p_submission_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,0));
  select * into v_submission from public.external_work_submissions
    where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status<>'approved' or v_submission.work_id is null
     or v_submission.product_id is null or v_submission.publication_id is null
     or not exists(select 1 from public.external_seller_profiles where profile_id=v_owner and status='eligible') then
    raise exception 'external_listing_publish_forbidden';end if;
  select count(*) into v_count from public.cloud_work_publication_pages page
    join public.cloud_work_publications publication on publication.id=page.publication_id
    where publication.id=v_submission.publication_id and publication.work_id=v_submission.work_id
      and publication.external_submission_id=p_submission_id and publication.source_kind='external';
  if v_count<1 or not exists(select 1 from public.digital_products product
    where product.id=v_submission.product_id and product.work_id=v_submission.work_id
      and product.creator_id=v_owner and product.external_submission_id=p_submission_id
      and product.status='paused' and product.price=v_submission.asking_price
      and nullif(to_jsonb(product)->>'file_url','') is null) then
    raise exception 'external_listing_publish_invalid';end if;
  perform set_config('mangai.external_listing_action','publish',true);
  update public.works set is_public=true,status='published',updated_at=now()
    where id=v_submission.work_id and current_publication_id=v_submission.publication_id;
  update public.digital_products set status='active' where id=v_submission.product_id;
  update public.external_work_submissions set status='published',review_reason_code=null,version=version+1
    where id=p_submission_id;
  insert into public.external_work_submission_events(submission_id,actor_profile_id,event_type,from_status,to_status)
    values(p_submission_id,v_owner,'listing_published','approved','published');
  insert into public.external_submission_notifications(profile_id,submission_id,notification_type)
    values(v_owner,p_submission_id,'published');
  return p_submission_id;
end$$;

create or replace function public.withdraw_external_marketplace_listing(p_submission_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;
begin
  select * into v_submission from public.external_work_submissions
    where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status<>'published' then raise exception 'external_listing_withdraw_forbidden';end if;
  perform set_config('mangai.external_listing_action','withdraw',true);
  update public.digital_products set status='paused' where id=v_submission.product_id;
  update public.works set is_public=false,status='draft',published_at=null,updated_at=now() where id=v_submission.work_id;
  update public.external_work_submissions set status='paused',review_reason_code='owner_withdrawn',version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(submission_id,actor_profile_id,event_type,from_status,to_status,reason_code)
    values(p_submission_id,v_owner,'listing_withdrawn','published','paused','owner_withdrawn');
  insert into public.external_submission_notifications(profile_id,submission_id,notification_type,reason_code)
    values(v_owner,p_submission_id,'withdrawn','owner_withdrawn');
  return p_submission_id;
end$$;

create or replace function public.stop_external_marketplace_listing(p_submission_id uuid,p_reason_code text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;
begin
  if v_actor is null or not public.is_admin() or p_reason_code is null
     or p_reason_code!~'^[a-z0-9][a-z0-9._-]{0,63}$' then raise exception 'external_listing_stop_forbidden';end if;
  select * into v_submission from public.external_work_submissions where id=p_submission_id for update;
  if not found or v_submission.status not in('approved','published') then raise exception 'external_listing_stop_forbidden';end if;
  perform set_config('mangai.external_listing_action','admin_stop',true);
  update public.digital_products set status='paused' where id=v_submission.product_id;
  update public.works set is_public=false,status='draft',published_at=null,updated_at=now() where id=v_submission.work_id;
  update public.external_work_submissions set status='paused',reviewed_by_profile_id=v_actor,
    reviewed_at=now(),review_reason_code=p_reason_code,version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(submission_id,actor_profile_id,event_type,from_status,to_status,reason_code)
    values(p_submission_id,v_actor,'admin_stopped',v_submission.status,'paused',p_reason_code);
  insert into public.external_submission_notifications(profile_id,submission_id,notification_type,reason_code)
    values(v_submission.owner_profile_id,p_submission_id,'admin_stopped',p_reason_code);
  return p_submission_id;
end$$;

revoke all on function public.submit_external_work_for_review(uuid,integer,text,boolean,boolean,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function public.review_external_work_submission(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.publish_external_marketplace_listing(uuid) from public,anon,authenticated,service_role;
revoke all on function public.withdraw_external_marketplace_listing(uuid) from public,anon,authenticated,service_role;
revoke all on function public.stop_external_marketplace_listing(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_external_work_for_review(uuid,integer,text,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.review_external_work_submission(uuid,text,text) to authenticated;
grant execute on function public.publish_external_marketplace_listing(uuid) to authenticated;
grant execute on function public.withdraw_external_marketplace_listing(uuid) to authenticated;
grant execute on function public.stop_external_marketplace_listing(uuid,text) to authenticated;

commit;

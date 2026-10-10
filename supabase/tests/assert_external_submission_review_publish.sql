begin;
do $$
declare
  v_creator_user uuid:='6a000000-0000-4000-8000-000000000001';
  v_creator_profile uuid:='6a000000-0000-4000-8000-000000000002';
  v_admin_user uuid:='6a000000-0000-4000-8000-000000000003';
  v_admin_profile uuid:='6a000000-0000-4000-8000-000000000004';
  v_buyer_user uuid:='6a000000-0000-4000-8000-000000000005';
  v_buyer_profile uuid:='6a000000-0000-4000-8000-000000000006';
  v_file uuid:='6a000000-0000-4000-8000-000000000007';
  v_submission uuid;
  v_product uuid;
  v_work uuid;
  v_publication uuid;
  v_blocked boolean:=false;
begin
  insert into auth.users(id,email) values
    (v_creator_user,'external-review@example.invalid'),
    (v_admin_user,'external-review-admin@example.invalid'),
    (v_buyer_user,'external-review-buyer@example.invalid') on conflict(id) do nothing;
  insert into public.profiles(id,user_id,role) values
    (v_creator_profile,v_creator_user,'creator'),
    (v_admin_profile,v_admin_user,'admin'),
    (v_buyer_profile,v_buyer_user,'buyer') on conflict(id) do nothing;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_creator_user::text,true);
  perform public.accept_external_seller_terms('external-marketplace-v1');
  perform set_config('request.jwt.claim.sub',v_admin_user::text,true);
  perform public.set_external_seller_status(v_creator_profile,'eligible',null);
  perform set_config('request.jwt.claim.sub',v_creator_user::text,true);
  v_submission:=public.create_external_work_submission('Review publish test','safe description','全年齢','images');
  insert into public.external_work_submission_files(
    id,submission_id,owner_profile_id,storage_path,original_name,declared_mime_type,
    byte_size,sha256,validation_status,malware_status,scanned_at
  ) values(v_file,v_submission,v_creator_profile,
    v_creator_profile::text||'/'||v_submission::text||'/source.png','source.png','image/png',
    200,repeat('a',64),'validated','clean',now());
  insert into public.external_work_submission_pages(
    submission_id,source_file_id,owner_profile_id,position,source_name,storage_path,
    mime_type,byte_size,width,height,sha256,is_sample
  ) values
    (v_submission,v_file,v_creator_profile,1,'page-1.png',v_creator_profile::text||'/'||v_submission::text||'/page-1.png','image/png',100,320,480,repeat('b',64),true),
    (v_submission,v_file,v_creator_profile,2,'page-2.png',v_creator_profile::text||'/'||v_submission::text||'/page-2.png','image/png',100,320,480,repeat('c',64),false);
  update public.external_work_submissions set status='ready' where id=v_submission;
  perform public.submit_external_work_for_review(v_submission,480,'external-marketplace-v1',true,true,true,true);
  perform set_config('request.jwt.claim.sub',v_admin_user::text,true);
  perform public.review_external_work_submission(v_submission,'in_review',null);
  perform public.review_external_work_submission(v_submission,'approved',null);
  select product_id,work_id,publication_id into v_product,v_work,v_publication
    from public.external_work_submissions where id=v_submission;
  if not exists(select 1 from public.digital_products where id=v_product and status='paused'
       and price=480 and nullif(to_jsonb(digital_products)->>'file_url','') is null
       and external_submission_id=v_submission)
     or not exists(select 1 from public.works where id=v_work and status='draft' and not is_public)
     or not exists(select 1 from public.external_submission_notifications
       where submission_id=v_submission and notification_type='approved') then
    raise exception 'External review approval did not create a paused fixed listing';end if;
  perform set_config('request.jwt.claim.sub',v_creator_user::text,true);
  perform public.publish_external_marketplace_listing(v_submission);
  if not exists(select 1 from public.digital_products where id=v_product and status='active')
     or not exists(select 1 from public.works where id=v_work and status='published' and is_public)
     or not exists(select 1 from public.external_work_submissions where id=v_submission and status='published') then
    raise exception 'External listing publish failed';end if;
  begin
    update public.digital_products set price=481 where id=v_product;
  exception when others then
    if sqlerrm='external_listing_product_immutable' then v_blocked:=true; else raise; end if;
  end;
  if not v_blocked then raise exception 'External approved product price was mutable';end if;
  insert into public.orders(
    buyer_profile_id,product_id,creator_id,amount,platform_fee,
    creator_revenue,payment_mode,status,publication_id
  ) values(v_buyer_profile,v_product,
    v_creator_profile,480,96,384,'test','paid',v_publication);
  perform set_config('request.jwt.claim.sub',v_admin_user::text,true);
  perform public.stop_external_marketplace_listing(v_submission,'policy_violation');
  if not exists(select 1 from public.digital_products where id=v_product and status='paused')
     or not exists(select 1 from public.works where id=v_work and status='draft' and not is_public)
     or not exists(select 1 from public.orders where product_id=v_product and status='paid' and publication_id=v_publication)
     or not exists(select 1 from public.external_work_submission_events
       where submission_id=v_submission and event_type='admin_stopped' and reason_code='policy_violation') then
    raise exception 'External admin stop failed or changed purchased entitlement';end if;
end$$;
rollback;

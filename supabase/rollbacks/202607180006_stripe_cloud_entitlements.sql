begin;

drop function if exists public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text);
drop table if exists public.stripe_webhook_events;
alter table public.cloud_ai_entitlements drop column stripe_event_created_at;

commit;

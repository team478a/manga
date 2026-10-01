with artifact_oids as (
  select
    to_regprocedure('public.publish_cloud_marketplace_listing(uuid)') as publish_oid,
    to_regprocedure('public.withdraw_cloud_marketplace_listing(uuid)') as withdrawal_oid,
    to_regprocedure('public.enforce_cloud_product_publication_gate()') as product_guard_oid,
    to_regprocedure('public.list_public_work_creator_attributions(uuid[])') as attribution_oid
),
function_contracts as (
  select
    artifact_oids.*,
    coalesce((select routine.prosecdef from pg_proc routine where routine.oid=publish_oid),false) as publish_security_definer,
    coalesce((select routine.prosecdef from pg_proc routine where routine.oid=withdrawal_oid),false) as withdrawal_security_definer,
    coalesce((select routine.prosecdef from pg_proc routine where routine.oid=attribution_oid),false) as attribution_security_definer,
    coalesce((select routine.provolatile='s' from pg_proc routine where routine.oid=attribution_oid),false) as attribution_stable
  from artifact_oids
),
trigger_contract as (
  select exists(
    select 1
    from pg_trigger trigger_record
    join pg_class target_relation on target_relation.oid=trigger_record.tgrelid
    join pg_namespace target_schema on target_schema.oid=target_relation.relnamespace
    cross join function_contracts
    where target_schema.nspname='public'
      and target_relation.relname='digital_products'
      and trigger_record.tgname='digital_products_cloud_publication_gate'
      and trigger_record.tgfoid=function_contracts.product_guard_oid
      and not trigger_record.tgisinternal
      and trigger_record.tgenabled<>'D'
      and (trigger_record.tgtype & 1)=1
      and (trigger_record.tgtype & 2)=2
      and (trigger_record.tgtype & 4)=4
      and (trigger_record.tgtype & 16)=16
  ) as ready
),
checks as (
  select
    1 as sequence,
    '202609290001_cloud_marketplace_listing_publish'::text as migration_id,
    publish_oid is not null as primary_artifact_ready,
    publish_security_definer
      and coalesce(has_function_privilege('authenticated',publish_oid,'EXECUTE'),false)
      and coalesce(has_function_privilege('service_role',publish_oid,'EXECUTE'),false)
      and not coalesce(has_function_privilege('anon',publish_oid,'EXECUTE'),false) as access_contract_ready,
    true as auxiliary_artifact_ready
  from function_contracts
  union all
  select
    2,
    '202609290002_cloud_marketplace_listing_withdrawal',
    withdrawal_oid is not null,
    withdrawal_security_definer
      and coalesce(has_function_privilege('authenticated',withdrawal_oid,'EXECUTE'),false)
      and coalesce(has_function_privilege('service_role',withdrawal_oid,'EXECUTE'),false)
      and not coalesce(has_function_privilege('anon',withdrawal_oid,'EXECUTE'),false),
    true
  from function_contracts
  union all
  select
    3,
    '202609300001_cloud_marketplace_product_edit_guard',
    product_guard_oid is not null,
    true,
    trigger_contract.ready
  from function_contracts cross join trigger_contract
  union all
  select
    4,
    '202609300002_public_marketplace_creator_attribution',
    attribution_oid is not null,
    attribution_security_definer
      and attribution_stable
      and coalesce(has_function_privilege('authenticated',attribution_oid,'EXECUTE'),false)
      and coalesce(has_function_privilege('anon',attribution_oid,'EXECUTE'),false),
    true
  from function_contracts
)
select
  migration_id,
  case
    when primary_artifact_ready and access_contract_ready and auxiliary_artifact_ready
      then 'APPLIED_CONTRACT_READY'
    else 'NOT_APPLIED_OR_INCOMPLETE'
  end as readiness,
  primary_artifact_ready,
  access_contract_ready,
  auxiliary_artifact_ready
from checks
order by sequence;

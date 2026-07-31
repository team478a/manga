begin;

create table public.cloud_story_storyboard_projects (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  storyboard_version_id uuid not null unique references public.cloud_story_storyboard_versions(id) on delete restrict,
  project_id uuid not null unique references public.cloud_projects(id) on delete cascade,
  first_page_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(first_page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade
);
create index cloud_story_storyboard_projects_owner_idx
  on public.cloud_story_storyboard_projects(owner_profile_id,created_at desc);
alter table public.cloud_story_storyboard_projects enable row level security;
grant select on public.cloud_story_storyboard_projects to authenticated;
grant select,insert,delete on public.cloud_story_storyboard_projects to service_role;
create policy "cloud_story_storyboard_projects_owner_read"
  on public.cloud_story_storyboard_projects for select
  using(owner_profile_id=public.current_profile_id());

create or replace function public.build_cloud_storyboard_canvas(
  p_page_id uuid,
  p_width integer,
  p_height integer,
  p_storyboard_page jsonb
)
returns jsonb
language sql
volatile
set search_path=public,pg_temp
as $$
with raw_panels as (
  select panel,ordinality::integer as panel_index,
    jsonb_array_length(p_storyboard_page->'panels')::integer as panel_count
  from jsonb_array_elements(p_storyboard_page->'panels') with ordinality as value(panel,ordinality)
), grid as (
  select raw_panels.*,gen_random_uuid() as panel_id,
    case when panel_count=1 then 1 else 2 end as column_count,
    case when panel_count=1 then 1 else (panel_count+1)/2 end as row_count
  from raw_panels
), geometry as (
  select grid.*,
    (p_width-96-24*(column_count-1))::numeric/column_count as panel_width,
    (p_height-144-24*(row_count-1))::numeric/row_count as panel_height,
    48+(
      column_count-1-((panel_index-1)%column_count)
    )*((p_width-96-24*(column_count-1))::numeric/column_count+24) as panel_x,
    72+floor((panel_index-1)::numeric/column_count)
      *((p_height-144-24*(row_count-1))::numeric/row_count+24) as panel_y
  from grid
), dialogues as (
  select geometry.*,dialogue,dialogue_index::integer,gen_random_uuid() as balloon_id
  from geometry
  cross join lateral jsonb_array_elements(coalesce(panel->'dialogue','[]'::jsonb))
    with ordinality as line(dialogue,dialogue_index)
), panel_output as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',panel_id,'pageId',p_page_id,'name','コマ'||panel_index,
    'x',panel_x,'y',panel_y,'width',panel_width,'height',panel_height,
    'rotation',0,'zIndex',panel_index-1,'visible',true,'locked',false,
    'borderColor','#111111','borderWidth',4,'fillColor','#fafafa',
    'shape','rectangle','slant',0,'imageAssetId',null,'imageFit','cover',
    'imageOffsetX',0,'imageOffsetY',0,'imageScale',1,'imageRotation',0,
    'imageOpacity',1,'createdAt','','updatedAt',''
  ) order by panel_index),'[]'::jsonb) as value from geometry
), balloon_output as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',balloon_id,'pageId',p_page_id,
    'name',coalesce(dialogue->>'speaker','セリフ')||' '||dialogue_index,
    'type',case dialogue->>'type' when 'narration' then 'narration_box'
      when 'thought' then 'speech_rounded' else 'speech_ellipse' end,
    'x',panel_x+greatest(16,panel_width*0.08),
    'y',panel_y+12+(dialogue_index-1)*(panel_height-24)/4,
    'width',greatest(120,panel_width*0.58),
    'height',greatest(72,least(180,(panel_height-24)/4-8)),
    'rotation',0,'zIndex',100+(panel_index-1)*10+(dialogue_index-1)*2,
    'visible',true,'locked',false,'fillColor','#ffffff','strokeColor','#111111',
    'strokeWidth',3,'opacity',0.94,
    'tailDirection',case when dialogue->>'type'='narration' then 'none' else 'bottom_right' end,
    'tailOffset',0.5,'createdAt','','updatedAt',''
  ) order by panel_index,dialogue_index),'[]'::jsonb) as value from dialogues
), text_output as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',gen_random_uuid(),'pageId',p_page_id,'parentBalloonId',balloon_id,
    'name',coalesce(dialogue->>'speaker','セリフ')||' テキスト',
    'text',dialogue->>'text',
    'x',panel_x+greatest(16,panel_width*0.08)+18,
    'y',panel_y+30+(dialogue_index-1)*(panel_height-24)/4,
    'width',greatest(80,panel_width*0.58-36),
    'height',greatest(40,least(144,(panel_height-24)/4-44)),
    'rotation',0,'zIndex',101+(panel_index-1)*10+(dialogue_index-1)*2,
    'visible',true,'locked',false,'writingMode','vertical',
    'fontFamily','sans-serif','fontSize',42,'fontWeight',500,'color','#111111',
    'textAlign','start','verticalAlign','top','lineHeight',1.45,
    'letterSpacing',0,'padding',8,'opacity',1,'createdAt','','updatedAt',''
  ) order by panel_index,dialogue_index),'[]'::jsonb) as value from dialogues
)
select jsonb_build_object(
  'schemaVersion',1,'pageId',p_page_id,'width',p_width,'height',p_height,
  'backgroundColor','#ffffff','panels',panel_output.value,
  'panelLayers','[]'::jsonb,'balloons',balloon_output.value,
  'textObjects',text_output.value
)
from panel_output,balloon_output,text_output;
$$;
revoke execute on function public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb)
  from public,anon,authenticated;

create or replace function public.materialize_cloud_storyboard_project(
  p_storyboard_version_id uuid
)
returns table(project_id uuid,first_page_id uuid,was_created boolean)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_existing public.cloud_story_storyboard_projects%rowtype;
  v_storyboard_id uuid;
  v_storyboard_scenario_id uuid;
  v_storyboard_result jsonb;
  v_episode_id uuid;
  v_project_id uuid;
  v_page_id uuid;
  v_first_page_id uuid;
  v_page jsonb;
  v_page_index integer:=0;
  v_content_class text;
  v_revision bigint;
begin
  if v_profile_id is null then raise exception 'profile_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_storyboard_version_id::text,0));
  select * into v_existing from public.cloud_story_storyboard_projects
    where storyboard_version_id=p_storyboard_version_id
      and owner_profile_id=v_profile_id;
  if found then
    project_id:=v_existing.project_id;
    first_page_id:=v_existing.first_page_id;
    was_created:=false;
    return next;
    return;
  end if;

  select storyboard.id,storyboard.scenario_version_id,storyboard.result,
    report.input->>'contentClass'
    into v_storyboard_id,v_storyboard_scenario_id,v_storyboard_result,
      v_content_class
  from public.cloud_story_storyboard_versions storyboard
  join public.cloud_story_scenario_versions scenario
    on scenario.id=storyboard.scenario_version_id
  join public.cloud_market_research_reports report
    on report.id=scenario.research_report_id
  where storyboard.id=p_storyboard_version_id
    and storyboard.owner_profile_id=v_profile_id;
  if not found or v_content_class is distinct from 'general' then
    raise exception 'general_adopted_storyboard_required';
  end if;
  if not exists(
    select 1 from public.cloud_story_storyboard_adoptions adoption
    where adoption.storyboard_version_id=v_storyboard_id
      and adoption.owner_profile_id=v_profile_id
      and not exists(
        select 1 from public.cloud_story_storyboard_adoptions newer
        where newer.scenario_version_id=adoption.scenario_version_id
          and (newer.adopted_at,newer.id)>(adoption.adopted_at,adoption.id)
      )
  ) then raise exception 'latest_adopted_storyboard_required'; end if;

  select created.project_id,created.episode_id,created.page_id
    into v_project_id,v_episode_id,v_page_id
  from public.create_cloud_project_with_first_page(
    v_storyboard_result->>'title',
    '採用AIネームから作成した編集用Canvas下書きです。画像は未生成です。',
    '全年齢','rtl',1600,2400,300
  ) created;
  v_first_page_id:=v_page_id;

  for v_page in
    select value from jsonb_array_elements(v_storyboard_result->'pages') value
    order by (value->>'pageNumber')::integer
  loop
    v_page_index:=v_page_index+1;
    if v_page_index>1 then
      select public.add_cloud_page(v_episode_id) into v_page_id;
    end if;
    update public.cloud_canvas_snapshots
      set canvas=public.build_cloud_storyboard_canvas(v_page_id,1600,2400,v_page)
      where page_id=v_page_id and revision=0;
  end loop;
  if v_page_index<>jsonb_array_length(v_storyboard_result->'pages')
     or v_page_index<>(v_storyboard_result->>'pageCount')::integer then
    raise exception 'storyboard_page_count_mismatch';
  end if;

  update public.cloud_projects project
    set cover_page_id=v_first_page_id,revision=revision+1,updated_at=now()
    where project.id=v_project_id returning project.revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id)
  values(v_project_id,v_revision,jsonb_build_object(
    'event','storyboard_materialized',
    'storyboardVersionId',v_storyboard_id,
    'pageCount',v_page_index
  ),v_profile_id);
  insert into public.cloud_story_storyboard_projects(
    owner_profile_id,storyboard_version_id,project_id,first_page_id
  ) values(v_profile_id,v_storyboard_id,v_project_id,v_first_page_id);

  project_id:=v_project_id;
  first_page_id:=v_first_page_id;
  was_created:=true;
  return next;
end;
$$;
revoke execute on function public.materialize_cloud_storyboard_project(uuid)
  from public,anon;
grant execute on function public.materialize_cloud_storyboard_project(uuid)
  to authenticated,service_role;

commit;

begin;

create table public.cloud_manga_generations (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  scenario_confirmation_id uuid not null unique references public.cloud_scenario_confirmations(id) on delete restrict,
  scenario_run_id uuid not null references public.cloud_scenario_runs(id) on delete restrict,
  project_id uuid not null unique references public.cloud_projects(id) on delete restrict,
  status text not null check (status = 'completed'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result->>'engineVersion' = 'manga-layout-rules-v1'
    and result->>'classification' = 'ai_inference'
    and (result->>'totalPages')::integer between 1 and 200
    and jsonb_typeof(result->'pages') = 'array'
    and jsonb_array_length(result->'pages') = (result->>'totalPages')::integer
    and pg_column_size(result) <= 2097152
  ),
  engine_version text not null check (engine_version = 'manga-layout-rules-v1'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index cloud_manga_generations_owner_idx
on public.cloud_manga_generations(owner_profile_id, created_at desc);

alter table public.cloud_manga_generations enable row level security;
grant select on public.cloud_manga_generations to authenticated;
grant select, insert, delete on public.cloud_manga_generations to service_role;

create policy "cloud_manga_generations_owner_read"
on public.cloud_manga_generations for select
using (owner_profile_id = public.current_profile_id());

create or replace function public.build_cloud_manga_panels(
  p_page_id uuid,
  p_layout_id text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_rects jsonb;
  v_panels jsonb := '[]'::jsonb;
  v_rect jsonb;
  v_index integer := 0;
begin
  case p_layout_id
    when 'single' then
      v_rects := '[{"x":48,"y":72,"width":1504,"height":2256}]'::jsonb;
    when 'top_one_bottom_two' then
      v_rects := '[{"x":48,"y":72,"width":1504,"height":1110},{"x":48,"y":1206,"width":740,"height":1122},{"x":812,"y":1206,"width":740,"height":1122}]'::jsonb;
    when 'four_equal' then
      v_rects := '[{"x":48,"y":72,"width":740,"height":1116},{"x":812,"y":72,"width":740,"height":1116},{"x":48,"y":1212,"width":740,"height":1116},{"x":812,"y":1212,"width":740,"height":1116}]'::jsonb;
    when 'six_equal' then
      v_rects := '[{"x":48,"y":72,"width":740,"height":744},{"x":812,"y":72,"width":740,"height":744},{"x":48,"y":840,"width":740,"height":744},{"x":812,"y":840,"width":740,"height":744},{"x":48,"y":1608,"width":740,"height":720},{"x":812,"y":1608,"width":740,"height":720}]'::jsonb;
    else
      raise exception 'cloud_manga_layout_invalid';
  end case;
  for v_rect in select value from jsonb_array_elements(v_rects)
  loop
    v_panels := v_panels || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'pageId', p_page_id,
      'name', 'コマ' || (v_index + 1),
      'x', (v_rect->>'x')::integer,
      'y', (v_rect->>'y')::integer,
      'width', (v_rect->>'width')::integer,
      'height', (v_rect->>'height')::integer,
      'rotation', 0,
      'zIndex', v_index,
      'visible', true,
      'locked', false,
      'borderColor', '#111111',
      'borderWidth', 4,
      'fillColor', '#ffffff',
      'shape', 'rectangle',
      'slant', 0,
      'imageAssetId', null,
      'imageFit', 'cover',
      'imageOffsetX', 0,
      'imageOffsetY', 0,
      'imageScale', 1,
      'imageRotation', 0,
      'imageOpacity', 1,
      'createdAt', p_created_at::text,
      'updatedAt', p_created_at::text
    ));
    v_index := v_index + 1;
  end loop;
  return v_panels;
end
$$;

revoke all on function public.build_cloud_manga_panels(uuid,text,timestamptz)
from public, anon, authenticated;

create or replace function public.create_cloud_manga_generation(
  p_scenario_confirmation_id uuid,
  p_result jsonb,
  p_completed_at timestamptz
)
returns table(generation_id uuid, project_id uuid, first_page_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_confirmation public.cloud_scenario_confirmations%rowtype;
  v_existing public.cloud_manga_generations%rowtype;
  v_generation_id uuid := gen_random_uuid();
  v_project_id uuid := gen_random_uuid();
  v_episode_id uuid := gen_random_uuid();
  v_page_id uuid;
  v_page jsonb;
  v_page_number integer;
  v_layout_id text;
begin
  if v_profile_id is null then
    raise exception 'cloud_manga_auth_required';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_scenario_confirmation_id::text, 0)
  );
  select * into v_existing
  from public.cloud_manga_generations
  where scenario_confirmation_id = p_scenario_confirmation_id
    and owner_profile_id = v_profile_id;
  if found then
    generation_id := v_existing.id;
    project_id := v_existing.project_id;
    select id into first_page_id
    from public.cloud_pages
    where cloud_pages.project_id = v_existing.project_id
      and deleted_at is null
    order by page_number
    limit 1;
    return next;
    return;
  end if;
  select * into v_confirmation
  from public.cloud_scenario_confirmations
  where id = p_scenario_confirmation_id
    and owner_profile_id = v_profile_id;
  if not found then
    raise exception 'cloud_manga_confirmation_not_found';
  end if;
  if p_result->'scenarioTrace'->>'confirmationId' is distinct from p_scenario_confirmation_id::text
    or p_result->'scenarioTrace'->>'scenarioRunId' is distinct from v_confirmation.scenario_run_id::text
    or p_result->'scenarioTrace'->>'proposalSelectionId' is distinct from v_confirmation.proposal_selection_id::text
    or (p_result->>'totalPages')::integer is distinct from (v_confirmation.scenario_snapshot->>'totalPages')::integer
    or p_result->>'title' is distinct from v_confirmation.scenario_snapshot->>'title'
    or (p_result->>'generatedAt')::timestamptz is distinct from p_completed_at
    or p_result->'projectSettings' is distinct from
      '{"ageRating":"全年齢","readingDirection":"rtl","width":1600,"height":2400,"dpi":300}'::jsonb
  then
    raise exception 'cloud_manga_trace_invalid';
  end if;
  if (p_result->>'totalPages')::integer not between 1 and 200
    or jsonb_typeof(p_result->'pages') is distinct from 'array'
    or jsonb_array_length(p_result->'pages') <> (p_result->>'totalPages')::integer
  then
    raise exception 'cloud_manga_page_count_invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_result->'pages') with ordinality page(value, position)
    where (value->>'pageNumber')::integer <> position
      or value->>'layoutId' not in ('single', 'top_one_bottom_two', 'four_equal', 'six_equal')
      or value->>'pageRole' not in ('opening', 'development', 'turning_point', 'climax', 'resolution')
      or (value->>'panelCount')::integer is distinct from case value->>'layoutId'
        when 'single' then 1
        when 'top_one_bottom_two' then 3
        when 'four_equal' then 4
        when 'six_equal' then 6
      end
      or not exists (
        select 1
        from jsonb_array_elements(v_confirmation.scenario_snapshot->'scenes') scene
        where scene->>'id' = value->>'sceneId'
          and scene->>'heading' = value->>'sceneHeading'
          and scene->>'summary' = value->>'sceneSummary'
          and position between
            (scene->>'pageStart')::integer and (scene->>'pageEnd')::integer
      )
  ) then
    raise exception 'cloud_manga_page_plan_invalid';
  end if;

  insert into public.cloud_projects(
    id, owner_profile_id, source_surface, content_class, title, description,
    age_rating, reading_direction, width, height, dpi
  ) values (
    v_project_id, v_profile_id, 'cloud', 'general', p_result->>'title',
    '確定シナリオから作成したマンガ下書き',
    '全年齢', 'rtl', 1600, 2400, 300
  );
  insert into public.cloud_episodes(id, project_id, title, order_index)
  values (v_episode_id, v_project_id, '第1話', 0);

  for v_page in
    select value
    from jsonb_array_elements(p_result->'pages')
    order by (value->>'pageNumber')::integer
  loop
    v_page_id := gen_random_uuid();
    v_page_number := (v_page->>'pageNumber')::integer;
    v_layout_id := v_page->>'layoutId';
    if v_page_number = 1 then first_page_id := v_page_id; end if;
    insert into public.cloud_pages(
      id, project_id, episode_id, page_number, order_index, width, height
    ) values (
      v_page_id, v_project_id, v_episode_id, v_page_number,
      v_page_number - 1, 1600, 2400
    );
    insert into public.cloud_canvas_snapshots(
      project_id, page_id, revision, canvas, created_by_profile_id
    ) values (
      v_project_id, v_page_id, 0,
      jsonb_build_object(
        'schemaVersion', 1,
        'pageId', v_page_id,
        'width', 1600,
        'height', 2400,
        'backgroundColor', '#ffffff',
        'panels', public.build_cloud_manga_panels(
          v_page_id, v_layout_id, p_completed_at
        ),
        'panelLayers', jsonb_build_array(),
        'balloons', jsonb_build_array(),
        'textObjects', jsonb_build_array()
      ),
      v_profile_id
    );
  end loop;

  insert into public.cloud_manga_generations(
    id, owner_profile_id, scenario_confirmation_id, scenario_run_id,
    project_id, status, result, engine_version, completed_at
  ) values (
    v_generation_id, v_profile_id, p_scenario_confirmation_id,
    v_confirmation.scenario_run_id, v_project_id, 'completed', p_result,
    'manga-layout-rules-v1', p_completed_at
  );
  insert into public.cloud_project_versions(
    project_id, revision, manifest, created_by_profile_id
  ) values (
    v_project_id, 0,
    jsonb_build_object(
      'event', 'manga_draft_generated',
      'generationId', v_generation_id,
      'scenarioConfirmationId', p_scenario_confirmation_id,
      'pageCount', p_result->>'totalPages'
    ),
    v_profile_id
  );
  generation_id := v_generation_id;
  project_id := v_project_id;
  return next;
end
$$;

revoke all on function public.create_cloud_manga_generation(uuid,jsonb,timestamptz)
from public, anon;
grant execute on function public.create_cloud_manga_generation(uuid,jsonb,timestamptz)
to authenticated, service_role;

commit;

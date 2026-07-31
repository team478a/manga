begin;

do $$
begin
  if exists(
    select 1 from public.cloud_story_storyboard_projects
    where content_class='adult'
  ) then raise exception 'adult_canvas_data_exists';end if;
end;
$$;

drop policy "cloud_story_storyboard_projects_owner_read"
  on public.cloud_story_storyboard_projects;
alter table public.cloud_story_storyboard_projects drop column content_class;
create policy "cloud_story_storyboard_projects_owner_read"
on public.cloud_story_storyboard_projects for select
using(owner_profile_id=public.current_profile_id());

alter table public.cloud_projects
  drop constraint cloud_projects_content_class_check,
  add constraint cloud_projects_content_class_check check(content_class='general'),
  drop constraint cloud_projects_age_rating_check,
  add constraint cloud_projects_age_rating_check
    check(age_rating in('全年齢','12歳以上','15歳以上'));

create or replace function public.cloud_project_can_read(p_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
select exists(
  select 1 from public.cloud_projects project
  where project.id=p_project_id and project.content_class='general'
    and(
      public.is_admin()
      or project.owner_profile_id=public.current_profile_id()
      or(
        project.deleted_at is null
        and(
          project.visibility in('public','unlisted')
          or exists(
            select 1 from public.cloud_project_collaborators collaborator
            where collaborator.project_id=project.id
              and collaborator.invitee_profile_id=public.current_profile_id()
              and collaborator.status='accepted'
          )
        )
      )
    )
);
$$;
create or replace function public.cloud_project_can_edit(p_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
select exists(
  select 1 from public.cloud_projects project
  where project.id=p_project_id and project.content_class='general'
    and project.deleted_at is null
    and(
      public.is_admin()
      or project.owner_profile_id=public.current_profile_id()
      or exists(
        select 1 from public.cloud_project_collaborators collaborator
        where collaborator.project_id=project.id
          and collaborator.invitee_profile_id=public.current_profile_id()
          and collaborator.status='accepted'
          and collaborator.role='editor'
      )
    )
);
$$;

drop policy "cloud_projects_insert" on public.cloud_projects;
drop policy "cloud_projects_update" on public.cloud_projects;
create policy "cloud_projects_insert" on public.cloud_projects for insert
with check(owner_profile_id=public.current_profile_id() and content_class='general');
create policy "cloud_projects_update" on public.cloud_projects for update
using(
  public.cloud_project_can_edit(id)
  or owner_profile_id=public.current_profile_id()
  or public.is_admin()
)
with check(
  content_class='general'
  and(
    public.cloud_project_can_edit(id)
    or owner_profile_id=public.current_profile_id()
    or public.is_admin()
  )
);

create or replace function public.materialize_cloud_storyboard_project(
  p_storyboard_version_id uuid
)
returns table(project_id uuid,first_page_id uuid,was_created boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_existing public.cloud_story_storyboard_projects%rowtype;
  v_storyboard_id uuid;v_storyboard_result jsonb;v_episode_id uuid;
  v_project_id uuid;v_page_id uuid;v_first_page_id uuid;v_page jsonb;
  v_page_index integer:=0;v_content_class text;v_revision bigint;
begin
  if v_profile_id is null then raise exception 'profile_required';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_storyboard_version_id::text,0));
  select * into v_existing from public.cloud_story_storyboard_projects
  where storyboard_version_id=p_storyboard_version_id
    and owner_profile_id=v_profile_id;
  if found then
    project_id:=v_existing.project_id;first_page_id:=v_existing.first_page_id;
    was_created:=false;return next;return;
  end if;
  select storyboard.id,storyboard.result,report.input->>'contentClass'
  into v_storyboard_id,v_storyboard_result,v_content_class
  from public.cloud_story_storyboard_versions storyboard
  join public.cloud_story_scenario_versions scenario
    on scenario.id=storyboard.scenario_version_id
  join public.cloud_market_research_reports report
    on report.id=scenario.research_report_id
  where storyboard.id=p_storyboard_version_id
    and storyboard.owner_profile_id=v_profile_id;
  if not found or v_content_class is distinct from 'general'
  then raise exception 'general_adopted_storyboard_required';end if;
  if not exists(
    select 1 from public.cloud_story_storyboard_adoptions adoption
    where adoption.storyboard_version_id=v_storyboard_id
      and adoption.owner_profile_id=v_profile_id
      and not exists(
        select 1 from public.cloud_story_storyboard_adoptions newer
        where newer.scenario_version_id=adoption.scenario_version_id
          and(newer.adopted_at,newer.id)>(adoption.adopted_at,adoption.id)
      )
  ) then raise exception 'latest_adopted_storyboard_required';end if;
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
    order by(value->>'pageNumber')::integer
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
    or v_page_index<>(v_storyboard_result->>'pageCount')::integer
  then raise exception 'storyboard_page_count_mismatch';end if;
  update public.cloud_projects project
  set cover_page_id=v_first_page_id,revision=revision+1,updated_at=now()
  where project.id=v_project_id returning project.revision into v_revision;
  insert into public.cloud_project_versions(
    project_id,revision,manifest,created_by_profile_id
  ) values(
    v_project_id,v_revision,
    jsonb_build_object(
      'event','storyboard_materialized',
      'storyboardVersionId',v_storyboard_id,'pageCount',v_page_index
    ),v_profile_id
  );
  insert into public.cloud_story_storyboard_projects(
    owner_profile_id,storyboard_version_id,project_id,first_page_id
  ) values(v_profile_id,v_storyboard_id,v_project_id,v_first_page_id);
  project_id:=v_project_id;first_page_id:=v_first_page_id;
  was_created:=true;return next;
end;
$$;

commit;

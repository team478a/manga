begin;

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

drop function if exists public.build_cloud_storyboard_canvas_unfitted_v1(uuid,integer,integer,jsonb);

commit;

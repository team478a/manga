begin;

create or replace function public.build_cloud_storyboard_canvas_unfitted_v1(
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
revoke execute on function public.build_cloud_storyboard_canvas_unfitted_v1(uuid,integer,integer,jsonb)
  from public,anon,authenticated;

create or replace function public.build_cloud_storyboard_canvas(
  p_page_id uuid, p_width integer, p_height integer, p_storyboard_page jsonb
) returns jsonb language plpgsql volatile set search_path=public,pg_temp as $$
declare
  v_canvas jsonb;
  v_balloon jsonb;
  v_text jsonb;
  v_texts jsonb := '[]'::jsonb;
  v_width double precision;
  v_height double precision;
  v_inner_width double precision;
  v_inner_height double precision;
  v_inset double precision;
  v_font integer;
  v_candidate integer;
  v_padding integer;
  v_rows integer;
  v_length integer;
  v_plain text;
  v_ruby boolean;
  v_short boolean;
  v_mode text;
begin
  -- Preserve the existing panel/balloon, UUID and source-dialogue contract.
  -- Only newly constructed text objects are fitted; no table writes occur here.
  v_canvas := public.build_cloud_storyboard_canvas_unfitted_v1(p_page_id,p_width,p_height,p_storyboard_page);
  for v_text in select value from jsonb_array_elements(v_canvas->'textObjects') loop
    select value into strict v_balloon from jsonb_array_elements(v_canvas->'balloons')
      where value->>'id'=v_text->>'parentBalloonId';
    v_width := (v_balloon->>'width')::double precision;
    v_height := (v_balloon->>'height')::double precision;
    -- Matches dialogueInnerRegion: inset stroke / tails are not text space.
    v_inset := greatest(10,(v_balloon->>'strokeWidth')::double precision/2+4);
    if v_balloon->>'type'='speech_ellipse' then
      v_inner_width := (v_width-2*v_inset)/sqrt(2::double precision);
      v_inner_height := (v_height-2*v_inset)/sqrt(2::double precision);
    else
      if v_balloon->>'type'='speech_rounded' then
        v_inset := v_inset+least(30,v_width/2,v_height/2)*(1-1/sqrt(2::double precision));
      end if;
      v_inner_width := v_width-2*v_inset;
      v_inner_height := v_height-2*v_inset;
    end if;
    -- Initial layout is only a conservative estimate, never an approval.
    -- C3a's shared Japanese glyph/ruby checker is the completion authority.
    v_ruby := (v_text->>'text') ~ '｜[^｜《》\r\n]{1,50}《[^｜《》\r\n]{1,100}》';
    v_plain := regexp_replace(v_text->>'text','｜([^｜《》\r\n]{1,50})《[^｜《》\r\n]{1,100}》','\1','g');
    v_length := char_length(v_plain);
    v_short := v_length<=6 and position(chr(10) in v_plain)=0 and position(chr(13) in v_plain)=0;
    v_font := 18;
    v_mode := 'vertical';
    for v_candidate in select generate_series(32,18,-2) loop
      v_padding := case when v_ruby then v_candidate else 0 end;
      v_rows := floor((v_inner_height-2*v_padding)/(v_candidate*1.2));
      if v_rows>=1 and v_inner_width-2*v_padding>=v_candidate*1.2
        and (case when v_short then v_length<=v_rows
          else ceil(greatest(1,v_length)::numeric/greatest(1,v_rows))*v_candidate*1.2<=v_inner_width-2*v_padding end) then
        v_font := v_candidate;
        exit;
      end if;
    end loop;
    -- Short plain lines in wide balloons use the existing horizontal policy.
    if v_short and not v_ruby and v_inner_width>=v_inner_height*1.5 then
      for v_candidate in select generate_series(32,24,-2) loop
        if v_length*v_candidate<=v_inner_width and v_candidate*1.2<=v_inner_height then
          v_font := v_candidate;
          v_mode := 'horizontal';
          exit;
        end if;
      end loop;
    end if;
    v_padding := case when v_ruby then v_font else 0 end;
    v_text := v_text || jsonb_build_object(
      'x',(v_balloon->>'x')::double precision+(v_width-v_inner_width)/2,
      'y',(v_balloon->>'y')::double precision+(v_height-v_inner_height)/2,
      'width',v_inner_width,'height',v_inner_height,'rotation',0,
      'fontSize',v_font,'padding',v_padding,'lineHeight',1.2,'letterSpacing',0,
      'writingMode',v_mode,
      'textAlign',case when v_mode='horizontal' then 'center' else 'start' end,
      'verticalAlign',case when v_mode='horizontal' then 'middle' else 'top' end
    );
    -- Retain full text even when 18px cannot fit: completion must fail closed.
    v_texts := v_texts || jsonb_build_array(v_text);
  end loop;
  return jsonb_set(v_canvas,'{textObjects}',v_texts);
end;
$$;
revoke execute on function public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb) from public,anon,authenticated;
revoke execute on function public.build_cloud_storyboard_canvas_unfitted_v1(uuid,integer,integer,jsonb) from public,anon,authenticated,service_role;

commit;

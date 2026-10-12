\set ON_ERROR_STOP on

begin;
do $$
declare
  v_canvas jsonb;
  v_balloon jsonb;
  v_text jsonb;
  v_inset double precision;
  v_width double precision;
  v_height double precision;
  v_count integer;
  v_long text := repeat('鍵。',1000);
begin
  foreach v_count in array array[1,2,4,6] loop
    select public.build_cloud_storyboard_canvas(
      '00000000-0000-4000-8000-000000000001',1600,2400,
      jsonb_build_object('panels',(select jsonb_agg(jsonb_build_object('dialogue',jsonb_build_array(
        jsonb_build_object('type','speech','speaker','A','text','鍵だ。'),
        jsonb_build_object('type','thought','speaker','B','text','証拠を'),
        jsonb_build_object('type','narration','speaker','語り','text','夜が明ける。')
      ))) from generate_series(1,v_count)))
    ) into v_canvas;
    if jsonb_array_length(v_canvas->'panels')<>v_count or jsonb_array_length(v_canvas->'textObjects')<>v_count*3 then
      raise exception 'C3b changed panel/dialogue counts';
    end if;
    for v_text in select value from jsonb_array_elements(v_canvas->'textObjects') loop
      select value into strict v_balloon from jsonb_array_elements(v_canvas->'balloons') where value->>'id'=v_text->>'parentBalloonId';
      v_inset := 10;
      v_width := (v_balloon->>'width')::double precision;
      v_height := (v_balloon->>'height')::double precision;
      if v_balloon->>'type'='speech_ellipse' then
        v_width := (v_width-20)/sqrt(2::double precision);
        v_height := (v_height-20)/sqrt(2::double precision);
      else
        if v_balloon->>'type'='speech_rounded' then
          v_inset := 10+least(30,v_width/2,v_height/2)*(1-1/sqrt(2::double precision));
        end if;
        v_width := v_width-2*v_inset;
        v_height := v_height-2*v_inset;
      end if;
      if abs((v_text->>'width')::double precision-v_width)>0.001
        or abs((v_text->>'height')::double precision-v_height)>0.001
        or abs((v_text->>'x')::double precision-((v_balloon->>'x')::double precision+((v_balloon->>'width')::double precision-v_width)/2))>0.001
        or abs((v_text->>'y')::double precision-((v_balloon->>'y')::double precision+((v_balloon->>'height')::double precision-v_height)/2))>0.001
        or (v_text->>'fontSize')::integer not between 18 and 32 then
        raise exception 'C3b shape inner region or readable font mismatch';
      end if;
    end loop;
  end loop;
  select public.build_cloud_storyboard_canvas('00000000-0000-4000-8000-000000000001',1600,2400,
    jsonb_build_object('panels',jsonb_build_array(jsonb_build_object('dialogue',jsonb_build_array(jsonb_build_object('type','speech','speaker','A','text',v_long)))))) into v_canvas;
  if v_canvas->'textObjects'->0->>'text'<>v_long then
    raise exception 'C3b truncated dialogue';
  end if;
  if has_function_privilege('authenticated','public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.build_cloud_storyboard_canvas_unfitted_v1(uuid,integer,integer,jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.build_cloud_storyboard_canvas_unfitted_v1(uuid,integer,integer,jsonb)','EXECUTE') then
    raise exception 'C3b builder ACL widened';
  end if;
end $$;
rollback;

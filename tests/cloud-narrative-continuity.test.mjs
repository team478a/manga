import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateNarrativeContinuity } from "../src/lib/cloud-narrative-continuity.ts";

const fact = (overrides={}) => ({id:crypto.randomUUID(),project_id:crypto.randomUUID(),fact_kind:"appearance",subject:"主人公",attribute:"上着",fact_value:"青いコート",start_page:1,end_page:10,source_page:1,notes:"",updated_at:new Date().toISOString(),...overrides});
const thread = (overrides={}) => ({id:crypto.randomUUID(),project_id:crypto.randomUUID(),title:"壊れた時計",setup_page:2,target_payoff_page:8,payoff_page:null,status:"planted",notes:"",updated_at:new Date().toISOString(),...overrides});

test("重複しないページ範囲は矛盾にしない",()=>{
  const result=evaluateNarrativeContinuity([fact({end_page:4}),fact({fact_value:"赤いコート",start_page:5,end_page:10})],[],10);
  assert.equal(result.warningCount,0);
});

test("同じ範囲の異なる事実を矛盾として検出する",()=>{
  const result=evaluateNarrativeContinuity([fact(),fact({fact_value:"赤いコート",start_page:5})],[],10);
  assert.equal(result.issues[0].code,"overlapping_fact_conflict");
  assert.match(result.issues[0].message,/5〜10ページ/);
});

test("回収予定を過ぎた伏線と回収ページ漏れを検出する",()=>{
  const result=evaluateNarrativeContinuity([], [thread(),thread({status:"resolved",target_payoff_page:null})], 12);
  assert.deepEqual(result.issues.map((issue)=>issue.code),["payoff_overdue","resolved_without_payoff"]);
});

test("migrationは所有者分離と安全なRPCを備える",async()=>{
  const sql=await readFile("supabase/migrations/202608010008_cloud_narrative_continuity.sql","utf8");
  assert.match(sql,/create table public\.cloud_continuity_facts/);
  assert.match(sql,/create table public\.cloud_plot_threads/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql,/security definer set search_path=public,pg_temp/);
  assert.match(sql,/revoke all on function public\.save_cloud_continuity_fact/);
});

test("一貫性画面で事実と伏線を登録できる",async()=>{
  const page=await readFile("src/app/creator/[projectId]/continuity/page.tsx","utf8");
  assert.match(page,/事実を登録/);assert.match(page,/伏線を登録/);assert.match(page,/回収漏れを警告/);
});

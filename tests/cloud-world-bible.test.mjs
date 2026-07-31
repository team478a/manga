import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudStyleBibleInputSchema,
  cloudWorldProfileInputSchema,
  resolveWorldProfilesForPanel,
} from "../src/lib/cloud-world-bible.ts";

const baseProfile = {
  project_id: "50000000-0000-4000-8000-000000000001",
  current_version: 1,
  description: "",
  visual_traits: [],
  color_palette: "",
  continuity_rules: [],
  prompt: "",
  negative_prompt: "",
  updated_at: "2026-07-31T00:00:00.000Z",
};

test("場所・小物はネーム文脈に名前がある設定だけを選ぶ", () => {
  const resolved = resolveWorldProfilesForPanel(
    [
      { ...baseProfile, id: "1", kind: "location", name: "駅前" },
      { ...baseProfile, id: "2", kind: "prop", name: "赤い傘" },
    ],
    { background: "朝の駅前", action: "歩き出す", composition: "人物を右へ" },
  );
  assert.deepEqual(resolved.map((profile) => profile.id), ["1"]);
});

test("画風・世界観入力は上限と種類を検証する", () => {
  assert.equal(cloudStyleBibleInputSchema.parse({
    projectId: baseProfile.project_id,
    artStyle: "青年漫画",
    linework: "細線",
    shading: "網点",
    backgroundDetail: "詳細",
    compositionRules: "右から左",
    negativePrompt: "厚塗り",
  }).artStyle, "青年漫画");
  assert.throws(() => cloudWorldProfileInputSchema.parse({
    projectId: baseProfile.project_id,
    profileId: null,
    kind: "unknown",
    name: "駅前",
    description: "",
    visualTraits: [],
    colorPalette: "",
    continuityRules: [],
    prompt: "",
    negativePrompt: "",
  }));
});

test("M2-2 migrationは版履歴・所有者RLS・RPCだけの書込を持つ", async () => {
  const migration = await readFile("supabase/migrations/202607310006_cloud_world_bible.sql", "utf8");
  const rollback = await readFile("supabase/rollbacks/202607310006_cloud_world_bible.sql", "utf8");
  assert.match(migration, /cloud_style_bible_versions/);
  assert.match(migration, /cloud_world_profile_versions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /owner_profile_id = public\.current_profile_id\(\)/);
  assert.match(migration, /save_cloud_style_bible/);
  assert.match(migration, /save_cloud_world_profile/);
  assert.doesNotMatch(migration, /grant select, insert[^;]*authenticated/i);
  assert.match(rollback, /drop table if exists public\.cloud_style_bibles/);
});

test("画風・世界観画面は日本語の空状態と処理中表示を持つ", async () => {
  const page = await readFile("src/app/creator/[projectId]/bible/page.tsx", "utf8");
  assert.match(page, /画風・世界観設定/);
  assert.match(page, /保存中…/);
  assert.match(page, /設定済みの場所・小物はまだありません/);
  assert.match(page, /技術的なAI設定は必要ありません/);
});

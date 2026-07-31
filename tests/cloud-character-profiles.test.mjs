import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cloudCharacterProfileInputSchema } from "../src/lib/cloud-character-profile.ts";

const migrationPath =
  "supabase/migrations/202607310005_cloud_character_profiles.sql";

test("M2キャラクター設定は入力上限とUUIDを検証する", () => {
  const parsed = cloudCharacterProfileInputSchema.parse({
    projectId: "50000000-0000-4000-8000-000000000001",
    profileId: null,
    name: "明日香",
    role: "protagonist",
    appearanceAge: "20代前半",
    bodyBuild: "小柄",
    hair: "黒髪のショートボブ",
    costume: "紺のジャケット",
    colorPalette: "黒、白、紺",
    immutableTraits: ["左目の下のほくろ"],
    prompt: "切れ長の目",
    negativePrompt: "長髪",
  });
  assert.equal(parsed.name, "明日香");
  assert.throws(() =>
    cloudCharacterProfileInputSchema.parse({
      ...parsed,
      immutableTraits: Array.from({ length: 13 }, (_, index) => `特徴${index}`),
    }),
  );
});

test("M2 migrationは履歴を不変スナップショットとして所有者だけに公開する", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const rollback = await readFile(
    "supabase/rollbacks/202607310005_cloud_character_profiles.sql",
    "utf8",
  );
  assert.match(migration, /cloud_character_profiles/);
  assert.match(migration, /cloud_character_profile_versions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(migration, /save_cloud_character_profile/);
  assert.doesNotMatch(migration, /grant insert[^;]*authenticated/i);
  assert.match(rollback, /drop table if exists public\.cloud_character_profile_versions/);
});

test("設定画面は保存中表示と日本語の空状態を備える", async () => {
  const page = await readFile(
    "src/app/creator/[projectId]/characters/page.tsx",
    "utf8",
  );
  assert.match(page, /キャラクター設定/);
  assert.match(page, /保存中…/);
  assert.match(page, /設定済みキャラクターはまだありません/);
  assert.match(page, /新しい版として保存/);
});

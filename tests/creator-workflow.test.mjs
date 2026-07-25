import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CREATOR_INPUT_LIMITS,
  normalizeCreatorTags,
  profileInputSchema,
  workInputSchema,
} from "../src/lib/creator-input.ts";

test("プロフィール入力の必須・最大文字数を検証する", () => {
  assert.equal(
    profileInputSchema.safeParse({ displayName: "作者", bio: "紹介" }).success,
    true,
  );
  assert.equal(
    profileInputSchema.safeParse({ displayName: "", bio: "" }).success,
    false,
  );
  assert.equal(
    profileInputSchema.safeParse({
      displayName: "a".repeat(CREATOR_INPUT_LIMITS.displayName + 1),
      bio: "",
    }).success,
    false,
  );
});

test("作品入力はタグを正規化し件数・長さを制限する", () => {
  assert.deepEqual(
    normalizeCreatorTags(" 花, 癒し,花, , ファンタジー"),
    ["花", "癒し", "ファンタジー"],
  );
  assert.equal(
    workInputSchema.safeParse({
      title: "作品",
      description: "",
      tags: Array.from(
        { length: CREATOR_INPUT_LIMITS.tagCount + 1 },
        (_, index) => `tag-${index}`,
      ),
      visibility: "private",
    }).success,
    false,
  );
});

test("作品画像のDB保存失敗時はStorageを補償削除する", async () => {
  const source = await readFile(
    new URL("../src/app/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /await removeWorkImage\(uploadedImage\.path\)/);
  assert.match(source, /const previousPath = ownedWorkImagePath/);
  assert.match(source, /await removeWorkImage\(previousPath\)/);
  assert.match(source, /sharp\(await file\.arrayBuffer\(\)\)\.metadata\(\)/);
});


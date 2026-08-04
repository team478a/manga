import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCloudContinuitySuggestions } from "../src/lib/cloud-continuity-suggestions.ts";

const projectId = crypto.randomUUID();
const pages = [1, 2, 3].map((pageNumber) => ({
  id: crypto.randomUUID(), project_id: projectId, episode_id: crypto.randomUUID(),
  page_number: pageNumber, order_index: pageNumber - 1, width: 1600, height: 2400,
  background_color: "#fff", revision: 0,
}));
const longform = {
  available: true,
  chapters: [], episodes: [],
  scenes: [{ id: crypto.randomUUID(), project_id: projectId, chapter_id: crypto.randomUUID(), episode_id: pages[0].episode_id, title: "再会", summary: "駅で主人公と師匠が再会する", order_index: 0, revision: 2 }],
  episodeChapterIds: {},
  pageSceneIds: { [pages[1].id]: "unused" },
};
longform.pageSceneIds[pages[1].id] = longform.scenes[0].id;
longform.pageSceneIds[pages[2].id] = longform.scenes[0].id;

const character = {
  id: crypto.randomUUID(), project_id: projectId, name: "主人公", role: "protagonist", current_version: 3,
  appearance_age: "20代", body_build: "細身", hair: "黒い短髪", costume: "青いコート",
  color_palette: "青と白", immutable_traits: ["左目の泣きぼくろ"],
  prompt: "internal prompt must not become a fact", negative_prompt: "secret negative prompt", updated_at: new Date().toISOString(),
};
const world = {
  id: crypto.randomUUID(), project_id: projectId, kind: "prop", name: "懐中時計", current_version: 1,
  description: "蓋に月の紋章がある", visual_traits: ["銀色"], color_palette: "銀と紺",
  continuity_rules: ["右ポケットに入れる"], prompt: "provider prompt", negative_prompt: "provider negative", updated_at: new Date().toISOString(),
};

function build(existingFacts = []) {
  return buildCloudContinuitySuggestions({ projectId, pages, longform, characters: [character], worlds: [world], existingFacts });
}

test("確定済みキャラクター設定だけを候補へ変換しPromptを露出しない", () => {
  const result = build();
  assert.ok(result.some((item) => item.subject === "主人公" && item.attribute === "衣装" && item.factValue === "青いコート"));
  assert.ok(result.some((item) => item.attribute === "固定特徴1" && item.factValue === "左目の泣きぼくろ"));
  assert.ok(result.every((item) => !item.factValue.includes("prompt")));
});

test("場所・小物設定とページ割当済みシーンを正しい範囲で候補化する", () => {
  const result = build();
  assert.ok(result.some((item) => item.factKind === "prop" && item.subject === "懐中時計" && item.attribute === "連続性ルール1"));
  const scene = result.find((item) => item.factKind === "timeline" && item.subject === "再会");
  assert.deepEqual({ start: scene?.startPage, end: scene?.endPage, source: scene?.sourcePage }, { start: 2, end: 3, source: 2 });
});

test("同じ内容とページ範囲を登録済みなら候補から除外する", () => {
  const target = build().find((item) => item.attribute === "衣装");
  assert.ok(target);
  const result = build([{
    id: crypto.randomUUID(), project_id: projectId, fact_kind: target.factKind, subject: target.subject,
    attribute: target.attribute, fact_value: target.factValue, start_page: target.startPage, end_page: target.endPage,
    source_page: null, notes: "", updated_at: new Date().toISOString(),
  }]);
  assert.equal(result.some((item) => item.id === target.id), false);
});

test("候補は確認操作を経て既存の事実保存Actionへ渡される", async () => {
  const page = await readFile("src/app/creator/[projectId]/continuity/page.tsx", "utf8");
  assert.match(page, /確定済み設定から見つかった候補/);
  assert.match(page, /確認して台帳へ登録/);
  assert.match(page, /saveContinuityFactAction/);
});

test("一貫性台帳の更新操作は処理中表示と二重送信防止を備える", async () => {
  const page = await readFile("src/app/creator/[projectId]/continuity/page.tsx", "utf8");
  assert.match(page, /PendingSubmitButton/);
  for (const label of ["登録中…", "保存中…", "更新中…", "削除中…"])
    assert.match(page, new RegExp(label));
  assert.doesNotMatch(page, /<button className="button-primary sm:col-span-2" type="submit">/);
});

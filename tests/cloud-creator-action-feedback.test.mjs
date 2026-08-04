import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const targets = [
  "src/app/creator/[projectId]/page.tsx",
  "src/app/creator/[projectId]/LongformPageManager.tsx",
  "src/app/creator/new/page.tsx",
  "src/app/creator/trash/page.tsx",
];

test("クラウド制作の主要な送信操作は処理中表示と二重送信防止を備える", async () => {
  const sources = await Promise.all(targets.map((path) => readFile(path, "utf8")));

  for (const source of sources) {
    assert.match(source, /PendingSubmitButton/);
    assert.doesNotMatch(source, /<button[^>]*type="submit"/);
  }

  const combined = sources.join("\n");
  for (const label of [
    "作品を作成中…",
    "更新中…",
    "保存中…",
    "追加中…",
    "移動中…",
    "設定中…",
    "削除中…",
    "作成中…",
    "復元中…",
  ]) {
    assert.match(combined, new RegExp(label));
  }
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const targets = [
  "src/app/dashboard/works/new/page.tsx",
  "src/app/dashboard/works/[id]/edit/page.tsx",
  "src/app/dashboard/products/new/page.tsx",
  "src/app/dashboard/products/[id]/edit/page.tsx",
  "src/app/dashboard/goods-requests/new/page.tsx",
  "src/app/dashboard/devices/page.tsx",
  "src/app/dashboard/devices/authorize/page.tsx",
  "src/app/dashboard/notifications/page.tsx",
];

test("一般利用者の主要な保存・申請・認証操作は処理中表示を備える", async () => {
  const sources = await Promise.all(targets.map((path) => readFile(path, "utf8")));
  for (const source of sources) {
    assert.match(source, /PendingSubmitButton/);
    assert.doesNotMatch(source, /<button[^>]*type="submit"/);
  }

  const combined = sources.join("\n");
  for (const label of ["保存中…", "更新中…", "申請を送信中…", "解除中…", "承認中…"])
    assert.match(combined, new RegExp(label));
});

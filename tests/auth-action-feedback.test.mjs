import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = [
  ["src/app/login/page.tsx", "ログイン中…"],
  ["src/app/signup/page.tsx", "登録中…"],
  ["src/app/forgot-password/page.tsx", "送信中…"],
  ["src/app/update-password/page.tsx", "更新中…"],
];

test("認証操作は処理中表示と二重送信防止を提供する", async () => {
  for (const [path, pendingLabel] of pages) {
    const source = await readFile(path, "utf8");
    assert.match(source, /PendingSubmitButton/);
    assert.match(source, new RegExp(`pendingLabel="${pendingLabel}"`));
  }
});

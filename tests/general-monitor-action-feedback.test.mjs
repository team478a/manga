import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cases = [
  ["src/components/Header.tsx", "ログアウト中…"],
  ["src/app/dashboard/notifications/page.tsx", "既読にしています…"],
  ["src/app/dashboard/works/new/page.tsx", "作品を保存中…"],
  ["src/app/dashboard/works/[id]/edit/page.tsx", "作品を更新中…"],
  ["src/app/dashboard/products/new/page.tsx", "商品を保存中…"],
  ["src/app/dashboard/products/[id]/edit/page.tsx", "商品を更新中…"],
  ["src/app/dashboard/goods-requests/new/page.tsx", "申請を送信中…"],
  ["src/app/dashboard/devices/page.tsx", "解除中…"],
  ["src/app/dashboard/devices/authorize/page.tsx", "端末を承認中…"],
];

test("general monitor actions expose pending feedback", async () => {
  for (const [path, pendingLabel] of cases) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /PendingSubmitButton/);
    assert.match(source, new RegExp(`pendingLabel="${pendingLabel}"`));
  }
});

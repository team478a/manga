import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("すべての管理画面に管理画面TOPへの共通導線を表示する", async () => {
  const layout = await readFile(
    new URL("../src/app/admin/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /aria-label="管理画面ナビゲーション"/);
  assert.match(layout, /href="\/admin"/);
  assert.match(layout, /管理画面TOPへ/);
  assert.match(layout, /LayoutDashboard/);
  assert.match(layout, /max-w-6xl/);
});

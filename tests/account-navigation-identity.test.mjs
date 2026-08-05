import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Cloud workflow layouts pass the signed-in display name to the side menu", async () => {
  for (const path of [
    "../src/app/dashboard/layout.tsx",
    "../src/app/creator/layout.tsx",
  ]) {
    const source = await readSource(path);
    assert.match(source, /await getCurrentProfile\(\)/);
    assert.match(
      source,
      /accountDisplayName=\{profile\?\.display_name \?\? "表示名未設定"\}/,
    );
  }
});

test("Cloud workflow side menu identifies the account and links to My Page", async () => {
  const source = await readSource("../src/components/CloudWorkflowShell.tsx");
  assert.match(source, /ログイン中/);
  assert.match(source, /\{accountDisplayName\}/);
  assert.match(source, /href="\/dashboard"/);
  assert.match(source, /マイページ/);
});

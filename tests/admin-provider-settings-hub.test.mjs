import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("管理者の外部APIキー入力を一つの画面へ集約する", async () => {
  const page = await read("../src/app/admin/provider-settings/page.tsx");
  assert.match(page, /OpenAI APIキー/);
  assert.match(page, /BFL APIキー/);
  assert.match(page, /Resend APIキー/);
  assert.equal((page.match(/type="password"/g) ?? []).length, 3);

  const legacyPages = await Promise.all([
    read("../src/app/admin/research-ai/page.tsx"),
    read("../src/app/admin/cloud-ai/page.tsx"),
    read("../src/app/admin/general-monitors/email/page.tsx"),
  ]);
  assert.doesNotMatch(legacyPages.join("\n"), /type="password"/);
});

test("集約画面に各Providerの公式APIキー取得手順を表示する", async () => {
  const page = await read("../src/app/admin/provider-settings/page.tsx");
  assert.match(page, /https:\/\/platform\.openai\.com\/api-keys/);
  assert.match(page, /https:\/\/api\.bfl\.ai\//);
  assert.match(page, /https:\/\/docs\.bfl\.ai\/quick_start\/get_started/);
  assert.match(page, /https:\/\/resend\.com\/api-keys/);
  assert.match(page, /Sending access/);
});

test("集約画面の保存Actionは管理者認証と既存Vault設定関数を使用する", async () => {
  const actions = await read("../src/app/admin/provider-settings/actions.ts");
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 3);
  assert.match(actions, /setCloudResearchAiSettings/);
  assert.match(actions, /setCloudGeneralImageSettings/);
  assert.match(actions, /setCloudGeneralMonitorEmailSettings/);
  assert.doesNotMatch(actions, /process\.env/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("市場分析AI設定はVaultへ保存しservice roleだけが復号できる", async () => {
  const [migration, rollback] = await Promise.all([
    readSource(
      "../supabase/migrations/202607300001_cloud_research_ai_provider.sql",
    ),
    readSource(
      "../supabase/rollbacks/202607300001_cloud_research_ai_provider.sql",
    ),
  ]);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(
    migration,
    /revoke all on function public\.get_cloud_research_ai_runtime_config\(\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_cloud_research_ai_runtime_config\(\)[\s\S]*to service_role/,
  );
  assert.doesNotMatch(migration, /api_key\s+text\s+not null/);
  assert.match(rollback, /cloud_research_ai_secret_must_be_removed_before_rollback/);
});

test("管理画面はAPIキーを再表示せず設定状態だけを表示する", async () => {
  const [page, action] = await Promise.all([
    readSource("../src/app/admin/research-ai/page.tsx"),
    readSource("../src/app/admin/research-ai/actions.ts"),
  ]);
  assert.match(page, /type="password"/);
  assert.match(page, /settings\.configured/);
  assert.match(page, /APIキー本体や末尾文字は記録しません/);
  assert.doesNotMatch(page, /apiKey\.slice|secret_id/);
  assert.match(action, /requireAdmin/);
  assert.doesNotMatch(action, /console\.(?:log|error)/);
});

test("一般向けAI市場分析はキーをClientへ渡さず成人向けをProvider前に拒否する", async () => {
  const runtime = await readSource(
    "../src/modules/research/infrastructure/openai-report-generator.ts",
  );
  const functionBody = runtime.slice(
    runtime.indexOf("export async function runCloudResearchAiAnalysis"),
  );
  assert.match(runtime, /input\.request\.contentClass !== "general"/);
  assert.ok(
    functionBody.indexOf('input.request.contentClass !== "general"') <
      functionBody.indexOf("await getCloudResearchAiRuntimeConfig"),
  );
  assert.match(runtime, /Authorization: `Bearer \$\{runtime\.apiKey\}`/);
  assert.match(runtime, /store: false/);
  assert.doesNotMatch(runtime, /console\.(?:log|error)/);
});

test("保存Actionは利用者rate limitの後にOpenAIへ接続する", async () => {
  const [action, service] = await Promise.all([
    readSource("../src/app/dashboard/research/actions.ts"),
    readSource("../src/modules/research/application/generate-report.ts"),
  ]);
  assert.ok(
    service.indexOf("dependencies.enforceRateLimit(input.profileId)") <
      service.indexOf("dependencies.analyze(input)"),
  );
  assert.match(action, /enforceRateLimit: enforceCloudResearchAiAnalysisRateLimit/);
  assert.match(action, /analyze: runCloudResearchAiAnalysis/);
});

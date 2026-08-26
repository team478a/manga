import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hashRateLimitSubject,
  readRequestClientAddress,
} from "../src/lib/rate-limit-primitives.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("rate-limit primitiveは既存のIP優先順とHMAC-SHA256を維持する", () => {
  const request = new Request("https://app.example.com", {
    headers: {
      "cf-connecting-ip": "invalid",
      "x-real-ip": " 192.0.2.1 ",
      "x-forwarded-for": "198.51.100.2, 203.0.113.3",
    },
  });
  assert.equal(readRequestClientAddress(request), "192.0.2.1");
  assert.equal(
    readRequestClientAddress(
      new Request("https://app.example.com", {
        headers: { "x-forwarded-for": "invalid, 2001:db8::1" },
      }),
    ),
    "2001:db8::1",
  );
  assert.equal(
    readRequestClientAddress(
      new Request("https://app.example.com", {
        headers: { "x-forwarded-for": "unknown" },
      }),
    ),
    null,
  );

  const secret = "s".repeat(32);
  assert.equal(
    hashRateLimitSubject("subject", secret),
    createHmac("sha256", secret).update("subject", "utf8").digest("hex"),
  );
});

test("3つのrate-limitはpolicy値・secret名・RPC・failure契約を各機能に保持する", async () => {
  const [cloudAi, research, desktop] = await Promise.all([
    read("src/lib/cloud-ai-rate-limit.ts"),
    read("src/lib/cloud-research-search-rate-limit.ts"),
    read("src/lib/desktop-device-rate-limit.ts"),
  ]);

  for (const source of [cloudAi, research, desktop]) {
    assert.match(source, /hashRateLimitSubject/);
    assert.doesNotMatch(source, /createHmac/);
  }
  assert.match(cloudAi, /const WINDOW_SECONDS = 60/);
  assert.match(cloudAi, /const GLOBAL_LIMIT = 600/);
  assert.match(cloudAi, /CLOUD_AI_RATE_LIMIT_SECRET/);
  assert.match(cloudAi, /consume_cloud_ai_rate_limit/);
  assert.match(cloudAi, /Cloud AI rate limitを確認できませんでした/);

  assert.match(research, /const GLOBAL_LIMIT = 300/);
  assert.match(research, /CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET/);
  assert.match(research, /consume_cloud_ai_rate_limit/);
  assert.match(research, /出典検索は1分間に10回までです/);
  assert.match(research, /AIネーム生成は1分間に2回までです/);

  assert.match(desktop, /const WINDOW_SECONDS = 15 \* 60/);
  assert.match(desktop, /const GLOBAL_REQUEST_LIMIT = 300/);
  assert.match(desktop, /DESKTOP_AUTH_RATE_LIMIT_SECRET/);
  assert.match(desktop, /consume_desktop_device_rate_limit/);
  assert.match(desktop, /端末認証rate limitを確認できませんでした/);
});

test("auditは直接INSERTとtransaction内RPC／triggerのdomain境界を維持する", async () => {
  const [cloudAi, image, research, email, adult, monitor] = await Promise.all([
    read("src/modules/cloud-ai/infrastructure/admin-cloud-ai-repository.ts"),
    read("src/lib/cloud-general-image-settings.ts"),
    read("src/lib/cloud-research-ai-settings.ts"),
    read("src/lib/cloud-general-monitor-email-settings.ts"),
    read("src/modules/adult-research/infrastructure/admin-repository.ts"),
    read("src/modules/general-monitor/infrastructure/admin-monitor-repository.ts"),
  ]);
  assert.match(cloudAi, /cloud_ai_admin_audit_logs/);
  assert.match(cloudAi, /管理操作の監査ログを保存できませんでした/);
  assert.match(image, /set_cloud_general_image_provider/);
  assert.match(research, /set_cloud_research_ai_provider/);
  assert.match(email, /set_cloud_general_monitor_email_provider/);
  assert.match(email, /set_cloud_general_monitor_email_template/);
  assert.match(adult, /set_cloud_adult_research_enabled/);
  assert.match(adult, /set_cloud_adult_research_entitlement/);
  assert.match(monitor, /activate_cloud_general_monitor/);
  assert.match(monitor, /record_cloud_general_monitor_invite_email_sent/);
});

test("signed URLとresilienceは異なるpolicy／failure意味を統合しない", async () => {
  const [asset, exportService, checkout, monitor, admin, cloud] =
    await Promise.all([
      read("src/modules/cloud-creator/assets/asset-service.ts"),
      read("src/modules/cloud-creator/export/durable-export-service.ts"),
      read("src/modules/checkout/infrastructure/checkout-order-repository.ts"),
      read("src/modules/general-monitor/infrastructure/admin-monitor-repository.ts"),
      read("src/lib/admin-resilience.ts"),
      read("src/lib/cloud-runtime-resilience.ts"),
    ]);
  assert.match(asset, /createSignedUrl\(asset\.storage_path, 300\)/);
  assert.match(exportService, /pdf: "mangai-manuscript\.pdf"/);
  assert.match(exportService, /images: "mangai-pages\.zip"/);
  assert.match(exportService, /project_json: "mangai-project\.json"/);
  assert.match(exportService, /createSignedUrl\(data\.output_storage_path, 300, \{ download: downloadNames\[data\.format as CloudDurableExportFormat\] \}\)/);
  assert.match(checkout, /createSignedUrl\(order\.digital_products\.file_url, 300, \{/);
  assert.match(checkout, /download: true/);
  assert.match(monitor, /createSignedUrl\(path, 600\)/);
  assert.match(admin, /console\.error/);
  assert.match(admin, /\{ ok: false \}/);
  assert.match(cloud, /logHubError\("cloud_data_load_failed"/);
  assert.match(cloud, /\{ ok: false, value: fallback \}/);
});

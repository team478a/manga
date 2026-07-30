import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  providerSpecificRequestFields,
  resolveCloudTextProviderRuntime,
} from "../src/lib/cloud-text-provider-runtime.ts";

test("一般向けOpenAIと成人向けxAIはendpointとkeyを交差させない", async () => {
  const general = await resolveCloudTextProviderRuntime("general", {
    apiKey: "general-key-000000000000",
    model: "gpt-5.6-terra",
  });
  const adult = await resolveCloudTextProviderRuntime("adult", {
    apiKey: "adult-key-00000000000000",
    model: "grok-4.5",
  });
  assert.equal(general.provider, "openai");
  assert.equal(general.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(adult.provider, "xai");
  assert.equal(adult.endpoint, "https://api.x.ai/v1/responses");
  assert.notEqual(general.apiKey, adult.apiKey);
});

test("xAI requestへOpenAI専用safety_identifierを送らない", () => {
  assert.deepEqual(
    providerSpecificRequestFields(
      {
        provider: "xai",
        endpoint: "https://api.x.ai/v1/responses",
        apiKey: "adult-key",
        model: "grok-4.5",
      },
      "identifier",
    ),
    {},
  );
});

test("成人向けGrok Feature Flagは未設定時fail closedする", async () => {
  const source = await import("../src/lib/cloud-adult-grok-settings.ts");
  const previous = process.env.CLOUD_ADULT_GROK_ENABLED;
  delete process.env.CLOUD_ADULT_GROK_ENABLED;
  assert.equal(source.cloudAdultGrokFeatureEnabled(), false);
  process.env.CLOUD_ADULT_GROK_ENABLED = "true";
  assert.equal(source.cloudAdultGrokFeatureEnabled(), true);
  if (previous === undefined) delete process.env.CLOUD_ADULT_GROK_ENABLED;
  else process.env.CLOUD_ADULT_GROK_ENABLED = previous;
});

test("migrationはVault・service_role限定・監査・成人向けengineを定義する", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202607310001_cloud_adult_grok_provider.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /mangai_cloud_adult_xai/);
  assert.match(sql, /get_cloud_adult_grok_runtime_config/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /cloud_adult_grok_audit_logs/);
  assert.match(sql, /xai-adult-web-research-v1/);
  assert.match(sql, /xai-adult-proposal-v1/);
  assert.match(sql, /xai-adult-scenario-v1/);
  assert.match(sql, /xai-adult-storyboard-v1/);
});

test("管理画面はkeyを再表示せず一般向けと成人向けを明示分離する", async () => {
  const page = await readFile(
    new URL("../src/app/admin/adult-grok/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Supabase Vault/);
  assert.match(page, /一般向けOpenAIとはキーも経路も分離/);
  assert.match(page, /type="password"/);
  assert.doesNotMatch(page, /settings\.apiKey/);
});

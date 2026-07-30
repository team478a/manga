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
  assert.match(page, /APIキーを保存して利用開始/);
  assert.doesNotMatch(page, /環境Feature Flag/);
  assert.doesNotMatch(page, /DB側実行状態/);
  assert.doesNotMatch(page, /settings\.apiKey/);
});

test("管理画面の保存操作はGrokを自動有効化する", async () => {
  const action = await readFile(
    new URL("../src/app/admin/adult-grok/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(action, /enabled: true/);
  assert.match(action, /current\?\.model \?\? "grok-4\.5"/);
});

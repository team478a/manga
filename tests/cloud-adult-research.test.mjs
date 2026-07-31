import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLOUD_ADULT_RESEARCH_TERMS_VERSION,
  assertCloudResearchContentAllowed,
  cloudAdultResearchFeatureEnabled,
  evaluateCloudAdultResearchAccess,
} from "../src/lib/cloud-adult-research-policy.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const entitlement = {
  profile_id: profileId,
  status: "approved",
  source: "legacy_purchase",
  granted_at: "2026-07-29T00:00:00.000Z",
  valid_until: null,
};
const consent = {
  profile_id: profileId,
  age_confirmed_at: "2026-07-29T00:00:00.000Z",
  terms_version: CLOUD_ADULT_RESEARCH_TERMS_VERSION,
  terms_accepted_at: "2026-07-29T00:00:00.000Z",
  withdrawn_at: null,
};
const input = {
  genre: "成人向け恋愛",
  audience: "18歳以上の購入者",
  platform: "成人向け電子書籍ストア",
  contentClass: "adult",
  theme: "恋愛",
  referenceWorks: "参考作品",
  priceMin: 500,
  priceMax: 1000,
  publicationFormat: "one_shot",
  pageCount: 32,
  evidence: [],
};

test("成人向けFeature Flagは未設定時にfail closedする", () => {
  const before = process.env.CLOUD_ADULT_RESEARCH_ENABLED;
  delete process.env.CLOUD_ADULT_RESEARCH_ENABLED;
  assert.equal(cloudAdultResearchFeatureEnabled(), false);
  process.env.CLOUD_ADULT_RESEARCH_ENABLED = "true";
  assert.equal(cloudAdultResearchFeatureEnabled(), true);
  if (before === undefined) delete process.env.CLOUD_ADULT_RESEARCH_ENABLED;
  else process.env.CLOUD_ADULT_RESEARCH_ENABLED = before;
});

test("Feature Flag・管理者許可・本人同意が揃った場合だけ許可する", () => {
  assert.equal(
    evaluateCloudAdultResearchAccess({
      featureEnabled: false,
      entitlement,
      consent,
    }).reason,
    "feature_disabled",
  );
  assert.equal(
    evaluateCloudAdultResearchAccess({
      featureEnabled: true,
      entitlement: null,
      consent,
    }).reason,
    "entitlement_missing",
  );
  assert.equal(
    evaluateCloudAdultResearchAccess({
      featureEnabled: true,
      entitlement: { ...entitlement, status: "suspended" },
      consent,
    }).reason,
    "entitlement_inactive",
  );
  assert.equal(
    evaluateCloudAdultResearchAccess({
      featureEnabled: true,
      entitlement: {
        ...entitlement,
        valid_until: "2026-07-29T00:30:00.000Z",
      },
      consent,
      now: new Date("2026-07-29T01:00:00.000Z"),
    }).reason,
    "entitlement_expired",
  );
  assert.equal(
    evaluateCloudAdultResearchAccess({
      featureEnabled: true,
      entitlement,
      consent: null,
    }).reason,
    "consent_required",
  );
  const allowed = evaluateCloudAdultResearchAccess({
    featureEnabled: true,
    entitlement,
    consent,
  });
  assert.equal(allowed.allowed, true);
  assert.doesNotThrow(() => assertCloudResearchContentAllowed(input, allowed));
});

test("一般向けは成人向け権限状態の影響を受けない", () => {
  assert.doesNotThrow(() =>
    assertCloudResearchContentAllowed(
      { ...input, contentClass: "general" },
      {
        allowed: false,
        reason: "feature_disabled",
        entitlement: null,
        consent: null,
      },
    ),
  );
});

test("成人向け権限確認は外部AI呼出より前に実行される", async () => {
  const action = await readFile(
    new URL("../src/app/dashboard/research/actions.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    action.indexOf("assertCloudResearchContentAllowed") <
      action.indexOf("runCloudResearchAiAnalysis"),
  );
});

test("成人向けUIは許可・本人同意・管理者停止を提供する", async () => {
  const [form, accessPage, adminAction, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/research/new/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/adult-access/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/users/[id]/adult-research-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607290008_cloud_adult_research_option.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(form, /成人向けは明示許可・本人同意・管理者設定/);
  assert.match(form, /xAI\/Grokへ送信します/);
  assert.match(accessPage, /私は18歳以上です/);
  assert.match(accessPage, /専用規約/);
  assert.match(adminAction, /requireAdmin/);
  assert.match(adminAction, /set_cloud_adult_research_entitlement/);
  assert.match(migration, /public\.can_use_cloud_adult_research\(\)/);
  assert.match(migration, /cloud_adult_research_settings/);
  assert.match(migration, /set_cloud_adult_research_enabled/);
  assert.match(migration, /cloud_adult_research_audit_logs/);
  assert.match(migration, /input->>'contentClass' = 'adult'/);
});

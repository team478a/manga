import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLOUD_ADULT_PLANNING_FEATURE_KEY,
  assertCloudAdultPlanningAllowed,
  cloudAdultPlanningFeatureEnabled,
  evaluateCloudAdultPlanningAccess,
  parseCloudAdultPlanningForm,
} from "../src/lib/cloud-adult-planning-policy.ts";

const grant = {
  profile_id: "10000000-0000-4000-8000-000000000001",
  feature_key: CLOUD_ADULT_PLANNING_FEATURE_KEY,
  status: "approved",
  source: "legacy_purchase",
  granted_at: "2026-07-29T00:00:00.000Z",
  valid_until: null,
};

test("成人向け企画Feature Flagは未設定時にfail closedする", () => {
  const before = process.env.CLOUD_ADULT_PLANNING_ENABLED;
  delete process.env.CLOUD_ADULT_PLANNING_ENABLED;
  assert.equal(cloudAdultPlanningFeatureEnabled(), false);
  if (before === undefined) delete process.env.CLOUD_ADULT_PLANNING_ENABLED;
  else process.env.CLOUD_ADULT_PLANNING_ENABLED = before;
});

test("基本成人権限と機能単位許可が揃った場合だけ企画を許可する", () => {
  assert.equal(
    evaluateCloudAdultPlanningAccess({
      featureEnabled: false,
      adultAccessAllowed: true,
      grant,
    }).reason,
    "feature_disabled",
  );
  assert.equal(
    evaluateCloudAdultPlanningAccess({
      featureEnabled: true,
      adultAccessAllowed: false,
      grant,
    }).reason,
    "adult_access_required",
  );
  assert.equal(
    evaluateCloudAdultPlanningAccess({
      featureEnabled: true,
      adultAccessAllowed: true,
      grant: null,
    }).reason,
    "grant_missing",
  );
  assert.equal(
    evaluateCloudAdultPlanningAccess({
      featureEnabled: true,
      adultAccessAllowed: true,
      grant: { ...grant, status: "suspended" },
    }).reason,
    "grant_inactive",
  );
  const expired = evaluateCloudAdultPlanningAccess({
    featureEnabled: true,
    adultAccessAllowed: true,
    grant: { ...grant, valid_until: "2026-07-29T00:30:00.000Z" },
    now: new Date("2026-07-29T01:00:00.000Z"),
  });
  assert.equal(expired.reason, "grant_expired");
  const allowed = evaluateCloudAdultPlanningAccess({
    featureEnabled: true,
    adultAccessAllowed: true,
    grant,
  });
  assert.equal(allowed.allowed, true);
  assert.doesNotThrow(() => assertCloudAdultPlanningAllowed(allowed));
});

test("企画ブリーフ入力を長さと必須項目で検証する", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    status: "draft",
    workingTitle: "仮タイトル",
    concept: "企画コンセプト",
    protagonist: "主人公",
    protagonistGoal: "主人公の目的",
    centralConflict: "中心となる対立",
    readerPromise: "読者への約束",
    tone: "トーン",
    differentiation: "差別化",
    endingDirection: "結末",
    notes: "",
  }))
    form.set(key, value);
  assert.equal(parseCloudAdultPlanningForm(form).workingTitle, "仮タイトル");
  form.set("concept", "");
  assert.throws(() => parseCloudAdultPlanningForm(form));
});

test("成人向け企画は入力・保存・履歴・再表示と権限管理を持つ", async () => {
  const [page, action, detail, adminAction, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/research/[reportId]/proposal/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/[reportId]/proposal/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/research/[reportId]/proposal/[briefId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/users/[id]/adult-feature-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607290009_cloud_adult_planning_option.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(page, /外部AIには送信されません/);
  assert.match(page, /listCloudAdultPlanningBriefs/);
  assert.match(action, /assertCloudAdultPlanningAllowed/);
  assert.match(action, /createCloudAdultPlanningBrief/);
  assert.match(detail, /getCloudAdultPlanningBrief/);
  assert.match(adminAction, /set_cloud_adult_feature_grant/);
  assert.match(migration, /cloud_adult_feature_grants/);
  assert.match(migration, /cloud_adult_planning_briefs/);
  assert.match(migration, /can_use_cloud_adult_feature\('adult_planning'\)/);
  assert.match(migration, /input->>'contentClass' = 'adult'/);
  assert.match(page, /createCloudAdultPlanningBriefAction/);
  assert.match(page, /createCloudAdultProposalAction/);
  assert.match(
    page,
    /市場分析をOpenAIへ送信し/,
  );
  assert.doesNotMatch(detail, /runCloudAdultProposalAi/);
});

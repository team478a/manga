import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_POLICY_VERSION,
  assertGeneralCloudContent,
  contentExecutionPolicySchema,
  resolveProjectContentClass,
} from "../packages/shared/src/index.ts";
import {
  assertGeneralSalesPackage,
  generalCloudStoragePath,
  ownedMarketplaceStoragePath,
} from "../src/lib/content-boundary.ts";

test("age ratingから既存Projectの作品区分を安全に移行する", () => {
  assert.equal(resolveProjectContentClass({ ageRating: "全年齢" }), "general");
  assert.equal(resolveProjectContentClass({ ageRating: "成人向け" }), "adult");
  assert.equal(
    resolveProjectContentClass({ ageRating: "不明な旧区分" }),
    "adult",
  );
  assert.throws(
    () =>
      resolveProjectContentClass({
        ageRating: "成人向け",
        contentClass: "general",
      }),
    /一致していません/,
  );
});

test("一般向けCloudと成人向けDesktopの実行matrixを強制する", () => {
  assert.equal(
    contentExecutionPolicySchema.parse({
      contentClass: "general",
      productSurface: "cloud",
      allowedTargets: ["cloud_provider"],
      externalConfirmationRequired: false,
    }).contentClass,
    "general",
  );
  assert.equal(
    contentExecutionPolicySchema.parse({
      contentClass: "adult",
      productSurface: "desktop",
      allowedTargets: ["local"],
      externalConfirmationRequired: true,
    }).contentClass,
    "adult",
  );
  assert.throws(() =>
    contentExecutionPolicySchema.parse({
      contentClass: "adult",
      productSurface: "cloud",
      allowedTargets: ["cloud_provider"],
      externalConfirmationRequired: false,
    }),
  );
  assert.throws(() =>
    contentExecutionPolicySchema.parse({
      contentClass: "adult",
      productSurface: "desktop",
      allowedTargets: ["external_byok"],
      externalConfirmationRequired: false,
    }),
  );
});

test("Cloud保存と販売パッケージ取込は一般向けだけを許可する", () => {
  assert.equal(
    assertGeneralCloudContent({ contentClass: "general" }),
    "general",
  );
  assert.throws(
    () => assertGeneralCloudContent({ contentClass: "adult" }),
    /Desktop Adult/,
  );
  const manifest = {
    format: "mangai.sales-package",
    version: 2,
    createdAt: "2026-07-18T00:00:00.000Z",
    createdBySurface: "desktop",
    policyVersion: CONTENT_POLICY_VERSION,
    work: { contentClass: "general" },
    files: [],
  };
  assert.equal(
    assertGeneralSalesPackage(manifest).work.contentClass,
    "general",
  );
  assert.throws(
    () =>
      assertGeneralSalesPackage({
        ...manifest,
        work: { contentClass: "adult" },
      }),
    /Cloudへ保存・送信できません/,
  );
  assert.match(generalCloudStoragePath("owner-id", "cover.png"), /^general\//);
});

test("Marketplace Storage pathはAuth Userとresource単位に分離する", () => {
  const userId = "20000000-0000-4000-8000-000000000001";
  const resourceId = "31000000-0000-4000-8000-000000000001";
  assert.equal(
    ownedMarketplaceStoragePath(userId, resourceId, "表紙 image.png"),
    `${userId}/${resourceId}/---image.png`,
  );
  assert.throws(
    () => ownedMarketplaceStoragePath("profile-id", resourceId, "cover.png"),
    /所有者別/,
  );
  assert.throws(
    () => ownedMarketplaceStoragePath(userId, resourceId, "../"),
    /所有者別/,
  );
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createMarketplaceProductionCanaryPlan,
  parseCanaryPlanCreateArguments,
  resolveCanaryPlanOutputPath,
  writeMarketplaceProductionCanaryPlan,
} from "../scripts/create-marketplace-production-canary-plan.mjs";

const now = Date.parse("2026-09-28T03:00:00.000Z");
const argumentsList = () => [
  "--output",
  path.join(os.tmpdir(), "marketplace-canary.json"),
  "--product-id",
  "11111111-1111-4111-8111-111111111111",
  "--seller-profile-id",
  "22222222-2222-4222-8222-222222222222",
  "--buyer-profile-id",
  "33333333-3333-4333-8333-333333333333",
  "--amount-jpy",
  "100",
  "--duration-hours",
  "12",
];

test("固定引数から検証済み1件canary計画を生成する", () => {
  const options = parseCanaryPlanCreateArguments(argumentsList());
  const result = createMarketplaceProductionCanaryPlan(options, { now });

  assert.equal(result.plan.schemaVersion, 1);
  assert.equal(result.plan.environment, "production");
  assert.equal(result.plan.checkoutMode, "live");
  assert.equal(result.plan.expectedAmountJpy, 100);
  assert.equal(result.plan.maxPurchaseCount, 1);
  assert.equal(result.plan.refundOnAcceptanceFailure, true);
  assert.equal(result.plan.createdAt, "2026-09-28T03:00:00.000Z");
  assert.equal(result.plan.expiresAt, "2026-09-28T15:00:00.000Z");
  assert.match(result.fingerprint, /^[0-9a-f]{64}$/);
});

test("不足・未知・重複optionを拒否する", () => {
  assert.throws(
    () => parseCanaryPlanCreateArguments(argumentsList().slice(0, -2)),
    /required/,
  );
  assert.throws(
    () =>
      parseCanaryPlanCreateArguments([
        ...argumentsList(),
        "--unknown",
        "value",
      ]),
    /Unknown/,
  );
  assert.throws(
    () =>
      parseCanaryPlanCreateArguments([
        ...argumentsList(),
        "--amount-jpy",
        "100",
      ]),
    /Duplicate/,
  );
});

test("不正UUID・本人購入・金額・期間を拒否する", () => {
  const invalidCases = [
    ["--product-id", "invalid", /valid UUIDs/],
    [
      "--buyer-profile-id",
      "22222222-2222-4222-8222-222222222222",
      /different profiles/,
    ],
    ["--amount-jpy", "49", /between 50 and 1,000/],
    ["--amount-jpy", "100.5", /integer/],
    ["--duration-hours", "25", /between 1 and 24/],
  ];
  for (const [name, value, expected] of invalidCases) {
    const options = parseCanaryPlanCreateArguments(argumentsList());
    options[name] = value;
    assert.throws(
      () => createMarketplaceProductionCanaryPlan(options, { now }),
      expected,
    );
  }
});

test("出力はrepository外の未作成JSONだけを許可する", () => {
  assert.throws(
    () =>
      resolveCanaryPlanOutputPath({
        argument: "relative.json",
        repositoryRoot: "/repo",
      }),
    /absolute path/,
  );
  assert.throws(
    () =>
      resolveCanaryPlanOutputPath({
        argument: pathForPlatform("/repo/plan.json"),
        repositoryRoot: pathForPlatform("/repo"),
        existsSync: (value) => value !== pathForPlatform("/repo/plan.json"),
        realpathSync: (value) => value,
      }),
    /outside the repository/,
  );
  assert.throws(
    () =>
      resolveCanaryPlanOutputPath({
        argument: pathForPlatform("/secure/plan.json"),
        repositoryRoot: pathForPlatform("/repo"),
        existsSync: () => true,
        realpathSync: (value) => value,
      }),
    /already exists/,
  );
});

test("新規ファイルへ保存し既存ファイルを上書きしない", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-canary-plan-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, "plan.json");
  const options = parseCanaryPlanCreateArguments(argumentsList());
  const { plan } = createMarketplaceProductionCanaryPlan(options, { now });

  writeMarketplaceProductionCanaryPlan({ outputPath, plan });
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, "utf8")), plan);
  assert.throws(
    () => writeMarketplaceProductionCanaryPlan({ outputPath, plan }),
    /EEXIST/,
  );
});

function pathForPlatform(value) {
  return process.platform === "win32" ? `C:${value.replaceAll("/", "\\")}` : value;
}

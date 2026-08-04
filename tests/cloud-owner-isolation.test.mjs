import assert from "node:assert/strict";
import test from "node:test";
import { checkCloudOwnerIsolation } from "../scripts/check-cloud-owner-isolation.mjs";

test("Cloud漫画制作の所有者分離契約がすべて維持される", () => {
  const report = checkCloudOwnerIsolation();
  assert.equal(
    report.passed,
    true,
    report.checks
      .filter((check) => !check.passed)
      .map((check) => `${check.name}: ${check.file}`)
      .join("\n"),
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ledgerUrl = new URL("../docs/desktop/RC_ACCEPTANCE_STATUS.json", import.meta.url);
const closeoutUrl = new URL(
  "../docs/RELEASE_CANDIDATE_STAGING_DURABLE_EXPORT_ACCEPTANCE_CLOSEOUT_20260827.md",
  import.meta.url,
);

test("RC acceptance ledger preserves current evidence and remaining release gates", async () => {
  const ledger = JSON.parse(await readFile(ledgerUrl, "utf8"));
  const closeout = await readFile(closeoutUrl, "utf8");
  const byId = new Map(ledger.requirements.map((requirement) => [requirement.id, requirement]));

  assert.equal(ledger.updatedAt, "2026-08-28");
  assert.equal(ledger.requirements.filter(({ status }) => status === "passed").length, 5);
  assert.equal(ledger.requirements.filter(({ status }) => status === "pending").length, 9);
  assert.equal(ledger.requirements.filter(({ status }) => status === "blocked").length, 2);

  const readiness = byId.get("initial-user-readiness");
  assert.equal(readiness?.status, "passed");
  assert.equal(readiness?.completedAt, "2026-08-27");
  assert.ok(
    readiness?.evidence.includes(
      "docs/RELEASE_CANDIDATE_STAGING_DURABLE_EXPORT_ACCEPTANCE_CLOSEOUT_20260827.md",
    ),
  );
  assert.match(closeout, /INITIAL_USER_READINESS_7_OF_7/);

  for (const id of ["windows-high-contrast", "windows-scale-150"]) {
    const requirement = byId.get(id);
    assert.equal(requirement?.status, "passed");
    assert.equal(requirement?.completedAt, "2026-08-28");
    assert.ok(
      requirement?.evidence.includes(
        "docs/RELEASE_CANDIDATE_WINDOWS_MANUAL_DISPLAY_ACCEPTANCE_20260828.md",
      ),
    );
  }

  const production = byId.get("hub-production-acceptance");
  assert.equal(production?.status, "pending");
  assert.match(production?.reason ?? "", /Cloud text model/);
  assert.match(production?.reason ?? "", /AIネーム由来8ページProduction E2E/);
  assert.match(production?.reason ?? "", /owner isolation/);
  assert.match(production?.reason ?? "", /Stripe test E2E/);

  assert.equal(byId.get("windows-code-signing")?.status, "blocked");
  assert.equal(byId.get("signed-auto-update")?.status, "blocked");
});

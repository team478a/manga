import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readAcceptanceRecord,
  summarizeAcceptance,
} from "../scripts/lib/rc-acceptance.mjs";

const writeRecord = (document) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-rc-"));
  const filePath = path.join(directory, "record.json");
  fs.writeFileSync(filePath, JSON.stringify(document));
  return filePath;
};

test("validates and summarizes a complete acceptance record", () => {
  const result = readAcceptanceRecord(
    writeRecord({
      schemaVersion: 1,
      releaseVersion: "0.1.0",
      updatedAt: "2026-07-17",
      requirements: [
        {
          id: "quality",
          label: "Quality gate",
          status: "passed",
          completedAt: "2026-07-17",
          verifier: "CI",
          evidence: ["run-1"],
        },
        {
          id: "exception",
          label: "Approved exception",
          status: "waived",
          completedAt: "2026-07-17",
          approvedBy: "release owner",
          reason: "documented limitation",
        },
      ],
    }),
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(summarizeAcceptance(result.document), {
    counts: { pending: 0, passed: 1, blocked: 0, waived: 1 },
    complete: true,
    total: 2,
  });
});

test("rejects passed, blocked, and waived records without evidence", () => {
  const result = readAcceptanceRecord(
    writeRecord({
      schemaVersion: 1,
      releaseVersion: "0.1.0",
      updatedAt: "2026-07-17",
      requirements: [
        { id: "passed", label: "Passed", status: "passed" },
        { id: "blocked", label: "Blocked", status: "blocked" },
        { id: "waived", label: "Waived", status: "waived" },
      ],
    }),
  );

  assert.ok(result.errors.some((error) => error.includes("completedAt")));
  assert.ok(result.errors.some((error) => error.includes("verifier")));
  assert.ok(result.errors.some((error) => error.includes("evidence")));
  assert.equal(
    result.errors.filter((error) => error.includes("reason")).length,
    2,
  );
  assert.ok(result.errors.some((error) => error.includes("approvedBy")));
});

test("marks pending and blocked requirements incomplete", () => {
  const summary = summarizeAcceptance({
    requirements: [
      { status: "passed" },
      { status: "pending" },
      { status: "blocked" },
    ],
  });

  assert.equal(summary.complete, false);
  assert.equal(summary.total, 3);
});

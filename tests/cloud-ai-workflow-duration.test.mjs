import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const aiActionPages = [
  "../src/app/dashboard/research/new/page.tsx",
  "../src/app/dashboard/research/[reportId]/proposal/page.tsx",
  "../src/app/dashboard/research/[reportId]/proposal/scenario/page.tsx",
  "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/page.tsx",
  "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/page.tsx",
  "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx",
];

test("provider-backed workflow pages allow the Server Action to finish", async () => {
  for (const path of aiActionPages) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(
      source,
      /export const maxDuration = 180;/,
      `${path} must keep its AI Server Action alive for the whole provider call`,
    );
  }
});

test("workflow provider timeouts stay below the page execution limit", async () => {
  const providers = [
    "../src/modules/research/infrastructure/openai-report-generator.ts",
    "../src/lib/cloud-proposal-ai.ts",
    "../src/lib/cloud-scenario-ai.ts",
    "../src/lib/cloud-storyboard-ai.ts",
  ];

  for (const path of providers) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const timeouts = [...source.matchAll(/AbortSignal\.timeout\(([\d_]+)\)/g)];
    assert.ok(timeouts.length > 0, `${path} must bound provider waiting time`);
    for (const timeout of timeouts) {
      const milliseconds = Number(timeout[1].replaceAll("_", ""));
      assert.ok(
        milliseconds < 180_000,
        `${path} provider timeout must leave time for validation, persistence, and redirect`,
      );
    }
  }
});

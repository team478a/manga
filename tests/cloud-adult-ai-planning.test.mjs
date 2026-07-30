import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("成人向けAI企画Feature Flagは明示的trueだけを許可する", async () => {
  const source = await readFile(
    new URL("../src/lib/cloud-adult-ai-planning.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /CLOUD_ADULT_AI_PLANNING_ENABLED\?\.toLowerCase\(\) === "true"/);
});

test("成人向けAI企画migrationは専用許可・同意・Kill Switch・区分RLSを要求する", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202607300006_cloud_adult_ai_planning.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /adult_ai_planning/);
  assert.match(sql, /cloud_adult_ai_planning_settings/);
  assert.match(sql, /cloud_adult_ai_planning_consents/);
  assert.match(sql, /adult-ai-planning-v1/);
  assert.match(sql, /can_use_cloud_adult_ai_planning/);
  assert.match(sql, /content_class in \('general', 'adult'\)/);
  assert.match(sql, /report\.input->>'contentClass' = content_class/);
});

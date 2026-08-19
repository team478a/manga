import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("開始前Batchは割り当てフォームを表示せず再試行時刻を案内する", async () => {
  const [page, repository] = await Promise.all([
    read("../src/app/admin/general-monitors/quality-review/page.tsx"),
    read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts"),
  ]);
  assert.match(repository, /loadedAt: now/);
  assert.match(page, /const now = Date\.parse\(data\.loadedAt\)/);
  assert.doesNotMatch(page, /Date\.now\(\)/);
  assert.match(page, /const assignmentPeriodOpen = startsAt <= now && expiresAt > now/);
  assert.match(page, /割り当ては開始日時の\{startsAtJapan\}（日本時間）以降に行えます/);
  assert.match(page, /assignmentPeriodOpen && availableSlots\.length > 0/);
});

test("利用期間外を重複エラーと混同しない", async () => {
  const actions = await read("../src/app/admin/general-monitors/quality-review/actions.ts");
  assert.match(actions, /monitor_quality_review_assignment_unavailable/);
  assert.match(actions, /Batchまたはモニターが利用期間外です。開始日時・終了日時を確認してください/);
  assert.match(actions, /同じ枠または同じ利用者がすでに割り当てられています/);
});

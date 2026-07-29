import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudWorkManagementFeatureEnabled,
  cloudWorkStatusLabel,
  evaluateCloudWorkReadiness,
} from "../src/lib/cloud-work-management.ts";

const project = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "作品",
  description: "作品説明",
  cover_page_id: "20000000-0000-4000-8000-000000000001",
  revision: 3,
  updated_at: "2026-07-29T00:00:00.000Z",
};
const pages = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    page_number: 1,
    revision: 2,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    page_number: 2,
    revision: 4,
  },
];
const reviews = pages.map((page) => ({
  page_id: page.id,
  page_revision: page.revision,
  note: "",
  reviewed_at: "2026-07-29T00:00:00.000Z",
}));

test("作品管理Feature Flagは未設定時fail closed", () => {
  const previous = process.env.CLOUD_WORK_MANAGEMENT_MVP_ENABLED;
  delete process.env.CLOUD_WORK_MANAGEMENT_MVP_ENABLED;
  assert.equal(cloudWorkManagementFeatureEnabled(), false);
  process.env.CLOUD_WORK_MANAGEMENT_MVP_ENABLED = "TRUE";
  assert.equal(cloudWorkManagementFeatureEnabled(), true);
  if (previous === undefined)
    delete process.env.CLOUD_WORK_MANAGEMENT_MVP_ENABLED;
  else process.env.CLOUD_WORK_MANAGEMENT_MVP_ENABLED = previous;
});

test("公開前条件をすべて満たす作品だけをreadyにする", () => {
  const result = evaluateCloudWorkReadiness({
    project,
    pages,
    reviews,
    snapshotPageIds: pages.map((page) => page.id),
    activeJobCount: 0,
  });
  assert.equal(result.ready, true);
  assert.equal(result.reviewedPages, 2);
  assert.ok(result.checks.every((check) => check.passed));
  assert.equal(cloudWorkStatusLabel("approved"), "販売準備へ承認済み");
});

test("古いPage revision・表紙不足・実行中Jobを未完了として検出する", () => {
  const result = evaluateCloudWorkReadiness({
    project: { ...project, cover_page_id: null },
    pages,
    reviews: [{ ...reviews[0], page_revision: 1 }],
    snapshotPageIds: [pages[0].id],
    activeJobCount: 1,
  });
  assert.equal(result.ready, false);
  assert.equal(result.reviewedPages, 0);
  assert.deepEqual(
    result.checks.filter((check) => !check.passed).map((check) => check.key),
    ["cover", "snapshots", "reviews", "jobs"],
  );
});

test("Release 5 UIは一覧・Page確認・公開前check・条件付き次工程を持つ", async () => {
  const [listPage, detailPage, shell] = await Promise.all([
    readFile(
      new URL("../src/app/dashboard/projects/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/projects/[projectId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/components/CloudWorkflowShell.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(listPage, /listCloudManagedWorks/);
  assert.match(detailPage, /setCloudWorkPageReviewAction/);
  assert.match(detailPage, /公開前チェック/);
  assert.match(detailPage, /Release 6/);
  assert.match(detailPage, /sm:grid-cols-2/);
  assert.match(shell, /workManagementEnabled/);
  assert.match(shell, /\/dashboard\/projects/);
});

test("Release 5 migrationは所有者RLS・revision失効・段階承認を持つ", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607290005_cloud_work_management.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /cloud_work_management_owner_read/);
  assert.match(sql, /cloud_work_page_reviews_owner_read/);
  assert.match(sql, /cloud_projects_reset_work_management/);
  assert.match(sql, /cloud_work_revision_conflict/);
  assert.match(sql, /cloud_work_status_transition_invalid/);
  assert.match(sql, /page_revision = page\.revision/);
  assert.doesNotMatch(
    sql,
    /grant\s+(insert|update)[^;]+authenticated/i,
  );
});

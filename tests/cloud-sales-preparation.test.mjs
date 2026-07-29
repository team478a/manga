import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudSalesPreparationFeatureEnabled,
  cloudSalesPreparationInputSchema,
  cloudSalesPreparationStatus,
} from "../src/lib/cloud-sales-preparation.ts";

test("販売準備Feature Flagは未設定時fail closed", () => {
  const original = process.env.CLOUD_SALES_PREPARATION_MVP_ENABLED;
  delete process.env.CLOUD_SALES_PREPARATION_MVP_ENABLED;
  assert.equal(cloudSalesPreparationFeatureEnabled(), false);
  process.env.CLOUD_SALES_PREPARATION_MVP_ENABLED = "true";
  assert.equal(cloudSalesPreparationFeatureEnabled(), true);
  if (original === undefined)
    delete process.env.CLOUD_SALES_PREPARATION_MVP_ENABLED;
  else process.env.CLOUD_SALES_PREPARATION_MVP_ENABLED = original;
});

test("販売価格とrevision入力を検証する", () => {
  assert.equal(
    cloudSalesPreparationInputSchema.safeParse({
      projectId: "a3000000-0000-4000-8000-000000000001",
      expectedRevision: "3",
      price: "900",
    }).success,
    true,
  );
  assert.equal(
    cloudSalesPreparationInputSchema.safeParse({
      projectId: "invalid",
      expectedRevision: -1,
      price: 1_000_001,
    }).success,
    false,
  );
});

test("同期revisionと公開・販売状態から表示状態を決める", () => {
  const base = {
    project: {
      id: "a3000000-0000-4000-8000-000000000001",
      title: "test",
      description: "test",
      revision: 3,
      updated_at: "2026-07-29T00:00:00Z",
    },
    approval: {
      project_id: "a3000000-0000-4000-8000-000000000001",
      status: "approved",
      expected_project_revision: 3,
      release_notes: "",
      approved_at: "2026-07-29T00:00:00Z",
    },
    preparation: {
      project_id: "a3000000-0000-4000-8000-000000000001",
      project_revision: 3,
      work_id: "a4000000-0000-4000-8000-000000000001",
      product_id: "a5000000-0000-4000-8000-000000000001",
      price: 900,
      cover_url: "https://example.test/cover.png",
      product_path: "owner/project/main.pdf",
      synced_at: "2026-07-29T00:00:00Z",
    },
    draft: {
      work: {
        id: "a4000000-0000-4000-8000-000000000001",
        status: "draft",
        is_public: false,
        image_url: null,
      },
      product: {
        id: "a5000000-0000-4000-8000-000000000001",
        status: "paused",
        price: 900,
        file_url: "owner/project/main.pdf",
      },
    },
  };
  assert.equal(cloudSalesPreparationStatus(base), "同期済み");
  assert.equal(
    cloudSalesPreparationStatus({
      ...base,
      project: { ...base.project, revision: 4 },
    }),
    "要再同期",
  );
  assert.equal(
    cloudSalesPreparationStatus({
      ...base,
      draft: {
        ...base.draft,
        product: { ...base.draft.product, status: "active" },
      },
    }),
    "販売中",
  );
});

test("Release 6 UIは一覧・差分・価格・同期導線を持つ", async () => {
  const [list, detail, action, creator] = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/sales-preparation/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/sales-preparation/[projectId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/sales-preparation/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/creator/[projectId]/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(list, /承認済み作品/);
  assert.match(detail, /既存下書きとの差分/);
  assert.match(detail, /販売価格/);
  assert.match(action, /syncCloudMarketplaceDraft/);
  assert.doesNotMatch(creator, /syncCloudMarketplaceDraftAction/);
});

test("Release 6 migrationは承認・revision・RLSをDBで強制する", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607290006_cloud_sales_preparation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /cloud_sales_preparations_owner_read/);
  assert.match(sql, /v_approval\.status<>'approved'/);
  assert.match(sql, /v_approval\.expected_project_revision<>v_project\.revision/);
  assert.match(sql, /revoke execute on function public\.sync_cloud_marketplace_draft/);
  assert.match(sql, /on conflict\(project_id\) do update/);
});

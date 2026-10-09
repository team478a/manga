import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMarketplaceRealWorkFixtureEnvironment,
  runMarketplaceRealWorkStagingFixtureAudit,
} from "../scripts/check-marketplace-real-work-staging-fixture.mjs";

const ids = {
  seller: "11111111-1111-4111-8111-111111111111",
  buyer: "22222222-2222-4222-8222-222222222222",
  unpurchased: "33333333-3333-4333-8333-333333333333",
  work: "44444444-4444-4444-8444-444444444444",
  product: "55555555-5555-4555-8555-555555555555",
  project: "66666666-6666-4666-8666-666666666666",
  publication: "77777777-7777-4777-8777-777777777777",
  checkpoint: "88888888-8888-4888-8888-888888888888",
};

const environment = (overrides = {}) => ({
  MANGAI_DB_ENV: "staging",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
  MANGAI_STAGING_PROJECT_REF: "staging-project",
  MANGAI_STAGING_PARENT_PROJECT_REF: "production-project",
  NEXT_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "staging-service-role-key-value",
  MANGAI_STAGING_SELLER_PROFILE_ID: ids.seller,
  MANGAI_STAGING_BUYER_PROFILE_ID: ids.buyer,
  MANGAI_STAGING_UNPURCHASED_PROFILE_ID: ids.unpurchased,
  MANGAI_STAGING_E2E_WORK_ID: ids.work,
  MANGAI_STAGING_E2E_PRODUCT_ID: ids.product,
  ...overrides,
});

const fixture = () => ({
  profiles: [
    { id: ids.seller, role: "creator" },
    { id: ids.buyer, role: "buyer" },
    { id: ids.unpurchased, role: "buyer" },
  ],
  works: [
    {
      id: ids.work,
      creator_id: ids.seller,
      source_project_id: ids.project,
      content_class: "general",
      status: "draft",
      is_public: false,
      current_publication_id: ids.publication,
    },
  ],
  digital_products: [
    {
      id: ids.product,
      work_id: ids.work,
      creator_id: ids.seller,
      price: 500,
      status: "paused",
      file_url: "private/e2e-publication.pdf",
    },
  ],
  cloud_projects: [
    {
      id: ids.project,
      owner_profile_id: ids.seller,
      content_class: "general",
      visibility: "private",
      deleted_at: null,
    },
  ],
  cloud_work_publications: [
    {
      id: ids.publication,
      work_id: ids.work,
      project_id: ids.project,
      checkpoint_id: ids.checkpoint,
      created_by_profile_id: ids.seller,
      page_count: 2,
      pdf_storage_path: "private/e2e-publication.pdf",
      manifest_sha256: "a".repeat(64),
    },
  ],
  cloud_project_checkpoints: [
    {
      id: ids.checkpoint,
      project_id: ids.project,
      created_by_profile_id: ids.seller,
      kind: "release",
      page_count: 2,
      manifest_sha256: "a".repeat(64),
    },
  ],
  cloud_work_publication_pages: [
    {
      publication_id: ids.publication,
      page_number: 1,
      width: 1600,
      height: 2400,
      storage_path: "private/page-1.png",
      is_sample: true,
    },
    {
      publication_id: ids.publication,
      page_number: 2,
      width: 1600,
      height: 2400,
      storage_path: "private/page-2.png",
      is_sample: false,
    },
  ],
  orders: [],
});

const response = (rows) => ({
  ok: true,
  status: 200,
  json: async () => rows,
});

const fetchFixture = (data, requests = []) => async (input, options) => {
  const url = new URL(input);
  requests.push({ options, url });
  const table = url.pathname.split("/").at(-1);
  let rows = data[table] ?? [];
  if (table === "profiles") {
    const targetId = url.searchParams.get("id")?.replace(/^eq\./, "");
    rows = rows.filter((row) => row.id === targetId);
  }
  return response(rows);
};

test("隔離Stagingと3主体のUUIDをfail-closedで解決する", () => {
  const resolved = resolveMarketplaceRealWorkFixtureEnvironment(environment());
  assert.equal(resolved.stagingRef, "staging-project");
  assert.equal(resolved.parentRef, "production-project");
  assert.equal(resolved.sellerProfileId, ids.seller);

  assert.throws(
    () =>
      resolveMarketplaceRealWorkFixtureEnvironment(
        environment({ MANGAI_DB_ENV: "production" }),
      ),
    /must be staging/,
  );
  assert.throws(
    () =>
      resolveMarketplaceRealWorkFixtureEnvironment(
        environment({ MANGAI_STAGING_PARENT_PROJECT_REF: "staging-project" }),
      ),
    /distinct/,
  );
  assert.throws(
    () =>
      resolveMarketplaceRealWorkFixtureEnvironment(
        environment({ MANGAI_STAGING_BUYER_PROFILE_ID: ids.seller }),
      ),
    /must be distinct/,
  );
});

test("非公開2ページ完成版とpaused商品・注文0件をREADYにする", async () => {
  const requests = [];
  const report = await runMarketplaceRealWorkStagingFixtureAudit({
    environment: environment(),
    fetchFn: fetchFixture(fixture(), requests),
  });

  assert.equal(report.passed, true);
  assert.deepEqual(report.counts, {
    checkedProfiles: 3,
    existingOrders: 0,
    publicationPages: 2,
    samplePages: 1,
  });
  assert.ok(requests.length >= 10);
  assert.ok(requests.every((request) => request.options.method === "GET"));
  assert.ok(
    requests.every(
      (request) => request.url.origin === "https://staging-project.supabase.co",
    ),
  );
});

test("公開作品・active商品・既存注文をREADYにしない", async () => {
  const data = fixture();
  data.works[0].status = "published";
  data.works[0].is_public = true;
  data.digital_products[0].status = "active";
  data.orders.push({ id: "99999999-9999-4999-8999-999999999999" });

  const report = await runMarketplaceRealWorkStagingFixtureAudit({
    environment: environment(),
    fetchFn: fetchFixture(data),
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((item) => item.id === "private-work").ready,
    false,
  );
  assert.equal(
    report.checks.find((item) => item.id === "paused-product").ready,
    false,
  );
  assert.equal(
    report.checks.find((item) => item.id === "zero-orders").ready,
    false,
  );
});

test("所有者不一致・checkpoint不一致・ページ不足をREADYにしない", async () => {
  const data = fixture();
  data.cloud_projects[0].owner_profile_id = ids.buyer;
  data.cloud_project_checkpoints[0].kind = "checkpoint";
  data.cloud_work_publication_pages.pop();

  const report = await runMarketplaceRealWorkStagingFixtureAudit({
    environment: environment(),
    fetchFn: fetchFixture(data),
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((item) => item.id === "private-project").ready,
    false,
  );
  assert.equal(
    report.checks.find((item) => item.id === "release-checkpoint").ready,
    false,
  );
  assert.equal(
    report.checks.find((item) => item.id === "publication-pages").ready,
    false,
  );
});

test("結果とrequestは識別子・個人情報・file取得を含めない", async () => {
  const requests = [];
  const report = await runMarketplaceRealWorkStagingFixtureAudit({
    environment: environment(),
    fetchFn: fetchFixture(fixture(), requests),
  });
  const serialized = JSON.stringify(report);

  for (const value of Object.values(ids))
    assert.doesNotMatch(serialized, new RegExp(value, "i"));
  assert.ok(
    requests.every((request) => {
      const selected = request.url.searchParams.get("select") ?? "";
      return !/email|display_name|title|description|buyer_email/i.test(selected);
    }),
  );
  assert.deepEqual(report.safety, {
    requestMethods: ["GET"],
    identifiersPrinted: false,
    personalDataSelected: false,
    productFileDownloaded: false,
    stagingMutation: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});

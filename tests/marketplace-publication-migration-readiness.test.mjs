import assert from "node:assert/strict";
import test from "node:test";
import {
  assessMarketplacePublicationMigrationReadiness,
  marketplacePublicationMigration,
  runMarketplacePublicationMigrationReadiness,
} from "../scripts/check-marketplace-publication-migration-readiness.mjs";

const allDependencies = () => ({
  works: true,
  digitalProducts: true,
  cloudProjects: true,
  cloudProjectCheckpoints: true,
  cloudProjectCheckpointPages: true,
  profiles: true,
});

const noArtifacts = () => ({
  workPublicationColumns: false,
  publicationsTable: false,
  publicationPagesTable: false,
});

test("未適用schemaと安全な既存データだけをmigration適用可能にする", () => {
  const report = assessMarketplacePublicationMigrationReadiness({
    activeProducts: [],
    artifacts: noArtifacts(),
    cloudWorks: [
      {
        id: "work-1",
        source_project_id: "project-1",
        status: "draft",
        is_public: false,
      },
    ],
    dependencies: allDependencies(),
  });

  assert.equal(report.passed, true);
  assert.equal(report.state, "not-applied");
  assert.deepEqual(report.migration, marketplacePublicationMigration);
  assert.deepEqual(report.counts, {
    activeCloudProducts: 0,
    checkedActiveProducts: 0,
    checkedCloudWorks: 1,
    duplicateCloudProjectMappings: 0,
    publicOrPublishedCloudWorks: 0,
  });
  assert.equal(report.safety.productionMutation, false);
  assert.equal(report.safety.identifiersPrinted, false);
});

test("公開済みCloud作品、active商品、重複Project mappingを停止する", () => {
  const report = assessMarketplacePublicationMigrationReadiness({
    activeProducts: [{ id: "product-1", work_id: "work-1", status: "active" }],
    artifacts: noArtifacts(),
    cloudWorks: [
      {
        id: "work-1",
        source_project_id: "project-1",
        status: "published",
        is_public: true,
      },
      {
        id: "work-2",
        source_project_id: "project-1",
        status: "draft",
        is_public: false,
      },
    ],
    dependencies: allDependencies(),
  });

  assert.equal(report.passed, false);
  assert.equal(report.counts.publicOrPublishedCloudWorks, 1);
  assert.equal(report.counts.activeCloudProducts, 1);
  assert.equal(report.counts.duplicateCloudProjectMappings, 1);
});

test("migration artifactの一部だけが存在する状態をfail closedにする", () => {
  const report = assessMarketplacePublicationMigrationReadiness({
    activeProducts: [],
    artifacts: {
      ...noArtifacts(),
      publicationsTable: true,
    },
    cloudWorks: [],
    dependencies: allDependencies(),
  });

  assert.equal(report.passed, false);
  assert.equal(report.state, "partial");
  assert.match(report.checks[1].missing[0], /partially present/);
});

test("既に全artifactがある場合は再適用候補にしない", () => {
  const report = assessMarketplacePublicationMigrationReadiness({
    activeProducts: [],
    artifacts: {
      workPublicationColumns: true,
      publicationsTable: true,
      publicationPagesTable: true,
    },
    cloudWorks: [],
    dependencies: allDependencies(),
  });

  assert.equal(report.passed, false);
  assert.equal(report.state, "already-applied");
  assert.match(report.checks[1].missing[0], /do not apply again/);
});

test("Production実行はGETだけを使い識別子や個人情報を出力しない", async () => {
  const calls = [];
  const fetchFn = async (input, init) => {
    const url = new URL(input);
    calls.push({ method: init.method, select: url.searchParams.get("select"), url });
    const select = url.searchParams.get("select") ?? "";
    const isArtifact =
      url.pathname.endsWith("/cloud_work_publications") ||
      url.pathname.endsWith("/cloud_work_publication_pages") ||
      select.includes("current_publication_id");
    if (isArtifact) {
      return new Response(JSON.stringify({ code: "PGRST205" }), {
        status: url.pathname.endsWith("/works") ? 400 : 404,
        headers: { "content-type": "application/json" },
      });
    }
    const isCloudInventory =
      url.pathname.endsWith("/works") &&
      select === "id,source_project_id,status,is_public";
    return new Response(
      JSON.stringify(
        isCloudInventory
          ? [
              {
                id: "work-hidden",
                source_project_id: "project-hidden",
                status: "draft",
                is_public: false,
              },
            ]
          : [],
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const report = await runMarketplacePublicationMigrationReadiness({
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: "https://production-parent-ref.supabase.co",
      NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
      SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key-value",
      MANGAI_MARKETPLACE_CHECKOUT_MODE: "disabled",
    },
    fetchFn,
  });

  assert.equal(report.passed, true);
  assert.ok(calls.length > 0);
  assert.ok(calls.every((call) => call.method === "GET"));
  assert.ok(calls.every((call) => !call.select?.includes("email")));
  assert.equal(JSON.stringify(report).includes("work-hidden"), false);
  assert.equal(JSON.stringify(report).includes("project-hidden"), false);
});

test("必須relationがない場合はinventoryを読まずPENDINGを返す", async () => {
  const calls = [];
  const fetchFn = async (input, init) => {
    const url = new URL(input);
    calls.push({ method: init.method, url });
    if (url.pathname.endsWith("/works")) {
      return new Response(JSON.stringify({ code: "PGRST205" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    if (
      url.pathname.endsWith("/cloud_work_publications") ||
      url.pathname.endsWith("/cloud_work_publication_pages")
    ) {
      return new Response(JSON.stringify({ code: "PGRST205" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const report = await runMarketplacePublicationMigrationReadiness({
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: "https://production-parent-ref.supabase.co",
      NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
      SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key-value",
      MANGAI_MARKETPLACE_CHECKOUT_MODE: "disabled",
    },
    fetchFn,
  });

  assert.equal(report.passed, false);
  assert.equal(report.checks[0].ready, false);
  assert.ok(calls.every((call) => call.method === "GET"));
  assert.equal(
    calls.some((call) => call.url.searchParams.get("limit") === "101"),
    false,
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runCloudStoryProposal } from "../src/lib/cloud-proposal.ts";
import {
  parseCloudResearchForm,
  runCloudMarketAnalysis,
} from "../src/lib/cloud-research.ts";
import { runCloudScenario } from "../src/lib/cloud-scenario.ts";
import {
  cloudMangaFeatureEnabled,
  runCloudMangaPlan,
} from "../src/lib/cloud-manga.ts";

const reportId = "20000000-0000-4000-8000-000000000001";
const selectionId = "40000000-0000-4000-8000-000000000001";
const scenarioRunId = "50000000-0000-4000-8000-000000000001";
const confirmationId = "60000000-0000-4000-8000-000000000001";

function scenario() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    genre: "ファンタジー",
    audience: "Web漫画読者",
    platform: "電子書籍",
    contentClass: "general",
    theme: "再出発",
    referenceWorks: "参考作品",
    priceMin: "300",
    priceMax: "800",
    publicationFormat: "one_shot",
    pageCount: "24",
    sourceTitle0: "公式",
    sourceUrl0: "https://example.com",
    sourceRetrievedAt0: "2026-07-29T09:00",
    sourceFact0: "公式特集に掲載。",
  }))
    form.set(key, value);
  const input = parseCloudResearchForm(form);
  const research = runCloudMarketAnalysis(
    input,
    "2026-07-29T00:00:00.000Z",
  );
  const proposal = runCloudStoryProposal(
    {
      input,
      findings: research.findings,
      sourceUrls: input.evidence.map((item) => item.url),
    },
    "2026-07-29T01:00:00.000Z",
  );
  return runCloudScenario(
    {
      proposalSelectionId: selectionId,
      researchReportId: reportId,
      candidate: proposal.candidates[0],
      totalPages: input.pageCount,
      contentClass: "general",
    },
    "2026-07-29T02:00:00.000Z",
  );
}

function plan(overrides = {}) {
  return runCloudMangaPlan(
    {
      confirmationId,
      scenarioRunId,
      proposalSelectionId: selectionId,
      scenario: scenario(),
      contentClass: "general",
      ...overrides,
    },
    "2026-07-29T03:00:00.000Z",
  );
}

test("マンガFeature Flagは未設定時fail closed", () => {
  const previous = process.env.CLOUD_MANGA_MVP_ENABLED;
  delete process.env.CLOUD_MANGA_MVP_ENABLED;
  assert.equal(cloudMangaFeatureEnabled(), false);
  process.env.CLOUD_MANGA_MVP_ENABLED = "TRUE";
  assert.equal(cloudMangaFeatureEnabled(), true);
  if (previous === undefined) delete process.env.CLOUD_MANGA_MVP_ENABLED;
  else process.env.CLOUD_MANGA_MVP_ENABLED = previous;
});

test("確定Scenarioを連続Page・Scene trace・コマ割り案へ変換する", () => {
  const result = plan();
  assert.equal(result.engineVersion, "manga-layout-rules-v1");
  assert.equal(result.classification, "ai_inference");
  assert.equal(result.pages.length, 24);
  assert.deepEqual(
    result.pages.map((page) => page.pageNumber),
    Array.from({ length: 24 }, (_, index) => index + 1),
  );
  assert.equal(result.pages[0].layoutId, "single");
  assert.equal(result.pages.at(-1).pageRole, "resolution");
  assert.ok(result.pages.every((page) => page.sceneId.startsWith("scene-")));
  assert.deepEqual(result.scenarioTrace, {
    confirmationId,
    scenarioRunId,
    proposalSelectionId: selectionId,
  });
});

test("成人向け・201Page超・Scenario Page欠落を拒否する", () => {
  assert.throws(
    () => plan({ contentClass: "adult" }),
    /Desktop Adult/,
  );
  const tooLong = { ...scenario(), totalPages: 201 };
  assert.throws(
    () => plan({ scenario: tooLong }),
    /200Page以下/,
  );
  const missing = {
    ...scenario(),
    scenes: scenario().scenes.map((scene, index) =>
      index === 0 ? { ...scene, pageStart: 2 } : scene,
    ),
  };
  assert.throws(() => plan({ scenario: missing }), /対応するScene/);
});

test("Release 4 UIは生成・履歴・Page構成・Canvas導線を持つ", async () => {
  const sources = await Promise.all([
    readFile(
      new URL(
        "../src/app/dashboard/scenarios/[runId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/dashboard/manga/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/manga/[generationId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(sources[0], /createCloudMangaAction/);
  assert.match(sources[1], /listCloudMangaGenerations/);
  assert.match(sources[2], /getCloudProjectWorkspace/);
  assert.match(sources[2], /Canvasで編集/);
  assert.match(sources[2], /sm:grid-cols-2/);
  assert.match(sources[2], /AI推論・制作仮説/);
});

test("Release 4 migrationは原子的Project生成・所有者RLS・冪等性を持つ", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607290004_cloud_manga_generations.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /cloud_manga_generations_owner_read/);
  assert.match(sql, /scenario_confirmation_id uuid not null unique/);
  assert.match(sql, /create_cloud_manga_generation/);
  assert.match(sql, /insert into public\.cloud_projects/);
  assert.match(sql, /insert into public\.cloud_pages/);
  assert.match(sql, /insert into public\.cloud_canvas_snapshots/);
  assert.match(sql, /scene->>'summary' = value->>'sceneSummary'/);
  assert.doesNotMatch(
    sql,
    /grant insert on public\.cloud_manga_generations to authenticated/i,
  );
});

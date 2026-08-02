import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCloudLongformCockpit, filterCloudCockpitStructure } from "../src/lib/cloud-longform-cockpit.ts";

const projectId = crypto.randomUUID();
const episodeId = crypto.randomUUID();
const chapterId = crypto.randomUUID();
const sceneId = crypto.randomUUID();
const pages = [1, 2, 3, 4].map((pageNumber) => ({
  id: crypto.randomUUID(), project_id: projectId, episode_id: episodeId,
  page_number: pageNumber, order_index: pageNumber - 1, width: 1600, height: 2400,
  background_color: "#fff", revision: 1,
}));

function build() {
  return buildCloudLongformCockpit({
    episodes: [{ id: episodeId, project_id: projectId, title: "第1話", order_index: 0, revision: 1 }],
    pages,
    longform: {
      available: true,
      chapters: [{ id: chapterId, project_id: projectId, title: "出会い", order_index: 0, revision: 1 }],
      scenes: [{ id: sceneId, project_id: projectId, chapter_id: chapterId, episode_id: episodeId, title: "駅", summary: "二人が出会う", order_index: 0, revision: 1 }],
      episodeChapterIds: { [episodeId]: chapterId },
      pageSceneIds: { [pages[0].id]: sceneId, [pages[1].id]: sceneId },
    },
    productionStates: [
      { pageId: pages[0].id, status: "finalized", statusUpdatedAt: null, finalizedRevision: 1, reviewedContextRevision: 1, contextRevision: 1, isStale: false },
      { pageId: pages[1].id, status: "generating", statusUpdatedAt: null, finalizedRevision: null, reviewedContextRevision: null, contextRevision: 1, isStale: false },
      { pageId: pages[2].id, status: "finalized", statusUpdatedAt: null, finalizedRevision: 1, reviewedContextRevision: 0, contextRevision: 1, isStale: true },
    ],
    facts: [{ id: crypto.randomUUID(), project_id: projectId, fact_kind: "relationship", subject: "主人公と師匠", attribute: "関係", fact_value: "再会", start_page: 2, end_page: 3, source_page: 2, notes: "", updated_at: new Date().toISOString() }],
    threads: [{ id: crypto.randomUUID(), project_id: projectId, title: "懐中時計", setup_page: 1, target_payoff_page: 4, payoff_page: null, status: "planted", notes: "", updated_at: new Date().toISOString() }],
    issues: [{ code: "payoff_overdue", severity: "warning", factIds: [], threadId: "thread", message: "未回収" }],
    characterNames: ["師匠", "主人公", "主人公"],
    chapterPlans: [{ id: crypto.randomUUID(), project_id: projectId, chapter_id: chapterId, priority: "urgent", assignee_name: "田中", due_date: "2026-07-31", notes: "確認", updated_at: new Date().toISOString() }],
    today: "2026-08-01",
  });
}

test("長編制作の進捗、章、シーン、未割当ページを集約する", () => {
  const result = build();
  assert.equal(result.totalPages, 4);
  assert.equal(result.finalizedPages, 1);
  assert.equal(result.generatingPages, 1);
  assert.equal(result.reviewPages, 1);
  assert.equal(result.notStartedPages, 1);
  assert.equal(result.completionPercent, 25);
  assert.equal(result.chapters[0].scenes[0].pages.length, 2);
  assert.equal(result.unassignedPages.length, 2);
  assert.equal(result.overdueChapterCount, 1);
  assert.equal(result.priorityChapterCount, 1);
  assert.equal(result.nextChapter.id, chapterId);
});

test("確認済みの人物・伏線・関係時系列だけを表示用に整理する", () => {
  const result = build();
  assert.deepEqual(result.characterNames, ["師匠", "主人公"]);
  assert.equal(result.openThreads.length, 1);
  assert.equal(result.timeline[0].label, "関係: 再会");
  assert.equal(result.issues.length, 1);
});

test("作品詳細から長編コックピットへ移動できる", async () => {
  const detail = await readFile("src/app/creator/[projectId]/page.tsx", "utf8");
  const cockpit = await readFile("src/app/creator/[projectId]/cockpit/page.tsx", "utf8");
  assert.match(detail, /長編コックピット/);
  assert.match(cockpit, /章・シーン進捗/);
  assert.match(cockpit, /関係・時系列/);
});

test("100ページ向け一覧は章・状態で絞り込み24ページずつ表示する", () => {
  const cockpit = build();
  const attention = filterCloudCockpitStructure({ chapters: cockpit.chapters, unassignedPages: cockpit.unassignedPages, chapterId: "all", status: "attention", limit: 24 });
  assert.equal(attention.totalMatches, 1);
  assert.deepEqual(attention.visiblePageIds, [pages[2].id]);
  const chapter = filterCloudCockpitStructure({ chapters: cockpit.chapters, unassignedPages: cockpit.unassignedPages, chapterId, status: "all", limit: 1 });
  assert.equal(chapter.totalMatches, 4);
  assert.equal(chapter.visiblePageIds.length, 1);
});

test("コックピットUIは章・制作状態フィルターと段階表示を持つ", async () => {
  const component = await readFile("src/app/creator/[projectId]/cockpit/CockpitStructure.tsx", "utf8");
  assert.match(component, /すべての章/);
  assert.match(component, /確認・修正が必要/);
  assert.match(component, /次の.*ページを表示/);
  assert.match(component, /<details/);
  assert.match(component, /制作計画を保存/);
  assert.match(component, /期限超過/);
});

test("章制作計画は所有者限定RPCと未適用時の安全な案内を持つ", async () => {
  const migration = await readFile("supabase/migrations/202608010009_cloud_chapter_production_plans.sql", "utf8");
  const service = await readFile("src/modules/cloud-creator/projects/chapter-production-plan-service.ts", "utf8");
  assert.match(migration, /cloud_project_can_edit/);
  assert.match(migration, /cloud_chapter_production_plans_owner_read/);
  assert.match(service, /42P01/);
  assert.match(service, /制作計画を読み込めませんでした/);
});

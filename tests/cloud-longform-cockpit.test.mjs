import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCloudLongformCockpit } from "../src/lib/cloud-longform-cockpit.ts";

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

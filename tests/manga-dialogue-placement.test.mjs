import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { placeCompletedPageDialogue } from "../src/modules/manga/application/auto-place-page-dialogue.ts";
import { placeStructuredPageDialogue } from "../src/modules/manga/domain/dialogue-placement.ts";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const pageId = "20000000-0000-4000-8000-000000000001";
const panelId = "30000000-0000-4000-8000-000000000001";

function canvas(overrides = {}) {
  return {
    schemaVersion: 1,
    pageId,
    width: 1200,
    height: 1800,
    backgroundColor: "#ffffff",
    panels: [
      {
        id: panelId,
        pageId,
        name: "コマ1",
        x: 100,
        y: 100,
        width: 800,
        height: 700,
        rotation: 0,
        zIndex: 0,
        visible: true,
        locked: false,
        borderColor: "#111111",
        borderWidth: 4,
        fillColor: "#ffffff",
        shape: "rectangle",
        slant: 0,
        imageAssetId: null,
        imageFit: "cover",
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1,
        imageRotation: 0,
        imageOpacity: 1,
        createdAt: "",
        updatedAt: "",
      },
    ],
    panelLayers: [],
    balloons: [],
    textObjects: [],
    ...overrides,
  };
}

function balloon(overrides = {}) {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    pageId,
    name: "空吹き出し",
    type: "speech_ellipse",
    x: 500,
    y: 140,
    width: 300,
    height: 240,
    rotation: 0,
    zIndex: 100,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    strokeColor: "#111111",
    strokeWidth: 3,
    opacity: 1,
    tailDirection: "bottom_right",
    tailOffset: 0.5,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const dialogue = (text = "ここから始めよう。") => [
  {
    panelIndex: 0,
    dialogues: [{ type: "speech", speaker: "真琴", text }],
  },
];

function place(value, panels = dialogue()) {
  let id = 0;
  return placeStructuredPageDialogue({
    canvas: value,
    panels,
    createId: () => `50000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    now: "2026-08-14T03:00:00.000Z",
  });
}

test("対象コマの空吹き出しへ縦書きテキストを関連付ける", () => {
  const result = place(canvas({ balloons: [balloon()] }));
  assert.equal(result.blockers.length, 0);
  assert.equal(result.placedDialogueCount, 1);
  assert.equal(result.canvas.balloons.length, 1);
  assert.equal(result.canvas.textObjects[0].parentBalloonId, balloon().id);
  assert.equal(result.canvas.textObjects[0].writingMode, "vertical");
  assert.equal(result.canvas.textObjects[0].text, "ここから始めよう。");
  assert.ok(result.canvas.textObjects[0].fontSize >= 18);
  assert.ok(result.canvas.textObjects[0].fontSize <= 32);
});

test("吹き出し不足時はコマ内へ型別に作成し、再処理しても重複しない", () => {
  const first = place(
    canvas(),
    [
      {
        panelIndex: 0,
        dialogues: [{ type: "narration", speaker: "語り", text: "夜が明ける。" }],
      },
    ],
  );
  assert.equal(first.canvas.balloons[0].type, "narration_box");
  assert.ok(first.canvas.balloons[0].x >= first.canvas.panels[0].x);
  assert.ok(
    first.canvas.balloons[0].x + first.canvas.balloons[0].width <=
      first.canvas.panels[0].x + first.canvas.panels[0].width,
  );
  const second = place(first.canvas, [
    {
      panelIndex: 0,
      dialogues: [{ type: "narration", speaker: "語り", text: "夜が明ける。" }],
    },
  ]);
  assert.equal(second.changed, false);
  assert.equal(second.canvas.balloons.length, 1);
  assert.equal(second.canvas.textObjects.length, 1);
});

test("自動作成する会話吹き出しをコマ幅の半分未満に抑え左右へ分散する", () => {
  const result = place(canvas(), [
    {
      panelIndex: 0,
      dialogues: [
        { type: "speech", speaker: "真琴", text: "証拠を見つけた。" },
        { type: "speech", speaker: "圭吾", text: "すぐに確認しよう。" },
      ],
    },
  ]);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.canvas.balloons.length, 2);
  assert.ok(result.canvas.balloons.every((item) => item.width < 800 * 0.5));
  assert.ok(result.canvas.balloons[0].x > result.canvas.balloons[1].x);
  assert.equal(result.canvas.balloons[0].tailDirection, "bottom_right");
  assert.equal(result.canvas.balloons[1].tailDirection, "bottom_left");
  assert.ok(result.canvas.textObjects.every((item) => item.fontSize <= 32));
});

test("既存の手動テキストとlocked吹き出しを上書きしない", () => {
  const manual = place(
    canvas({
      balloons: [balloon()],
      textObjects: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          pageId,
          parentBalloonId: balloon().id,
          text: "ユーザーが直した本文",
          x: 520,
          y: 160,
          width: 260,
          height: 200,
        },
      ],
    }),
  );
  assert.deepEqual(manual.blockers, ["manual_text_present"]);
  assert.equal(manual.canvas.textObjects[0].text, "ユーザーが直した本文");
  const locked = place(canvas({ balloons: [balloon({ locked: true })] }));
  assert.deepEqual(locked.blockers, ["balloon_locked"]);
  assert.equal(locked.canvas.textObjects.length, 0);
});

test("空の既存textObjectは再利用し、locked textObjectは変更しない", () => {
  const emptyText = {
    id: "60000000-0000-4000-8000-000000000002",
    pageId,
    parentBalloonId: balloon().id,
    name: "空テキスト",
    text: "",
    x: 520,
    y: 160,
    width: 260,
    height: 200,
    rotation: 0,
    zIndex: 101,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 42,
    fontWeight: 500,
    color: "#111111",
    writingMode: "vertical",
    textAlign: "start",
    verticalAlign: "top",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 0,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  };
  const reused = place(
    canvas({ balloons: [balloon()], textObjects: [emptyText] }),
  );
  assert.equal(reused.canvas.textObjects.length, 1);
  assert.equal(reused.canvas.textObjects[0].id, emptyText.id);
  assert.equal(reused.canvas.textObjects[0].text, "ここから始めよう。");
  const locked = place(
    canvas({
      balloons: [balloon()],
      textObjects: [{ ...emptyText, locked: true }],
    }),
  );
  assert.deepEqual(locked.blockers, ["text_locked"]);
  assert.equal(locked.canvas.textObjects[0].text, "");
});

test("最小フォントでも収まらない本文は空テキストを保存せずblockerにする", () => {
  const tiny = balloon({ width: 60, height: 60 });
  const result = place(
    canvas({ balloons: [tiny] }),
    dialogue("これは吹き出し内へ到底収まらない非常に長いセリフです。".repeat(8)),
  );
  assert.deepEqual(result.blockers, ["dialogue_does_not_fit"]);
  assert.equal(result.canvas.textObjects.length, 0);
});

test("applicationは全コマ画像の配置完了前にrevisionを進めない", async () => {
  const calls = { saved: 0, recorded: 0 };
  const repository = {
    async load() {
      return {
        jobId: "10000000-0000-4000-8000-000000000001",
        pageId,
        currentPageRevision: 4,
        productionStatus: "review_required",
        imagesReady: false,
        canvas: canvas(),
        panels: dialogue(),
        existingStatus: null,
      };
    },
    async save() {
      calls.saved += 1;
      return { revision: 5 };
    },
    async record() {
      calls.recorded += 1;
    },
  };
  const result = await placeCompletedPageDialogue({
    jobId: "10000000-0000-4000-8000-000000000001",
    repository,
  });
  assert.deepEqual(result, { status: "not_ready" });
  assert.deepEqual(calls, { saved: 0, recorded: 0 });
});

test("migrationはowner read、全画像ready、service-role transactionを固定する", () => {
  const sql = read(
    "supabase/migrations/202608140003_cloud_page_dialogue_placements.sql",
  );
  assert.match(sql, /cloud_page_dialogue_placements_owner_read/);
  assert.match(sql, /owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /cloud_page_images_ready_for_dialogue/);
  assert.match(sql, /target\.generation_job_id is null or adoption\.generation_job_id is null/);
  assert.match(sql, /p_canvas-'balloons'-'textObjects'/);
  assert.match(sql, /page_dialogue_auto_placed/);
  assert.match(sql, /auth\.role\(\)<>'service_role'/g);
  assert.doesNotMatch(
    sql,
    /grant execute on function public\.save_cloud_page_dialogue_placement[^;]+authenticated/,
  );
});

test("workerは画像採用後に配置し、中断分も独立回収する", () => {
  const worker = read("src/modules/cloud-ai/application/process-generation.ts");
  const adoption = worker.indexOf("await adoptCompletedPanelCandidate", worker.indexOf("await completeCloudGenerationJob"));
  const dialoguePlacement = worker.indexOf("await placeCompletedPageDialogue", adoption);
  assert.ok(adoption >= 0 && dialoguePlacement > adoption);
  assert.match(worker, /processPendingCloudDialoguePlacement/);
  const route = read("src/app/api/internal/cloud-ai/worker/route.ts");
  assert.match(route, /processPendingCloudDialoguePlacement\(\{ client \}\)/);
});

test("文章生成Jobは構造化セリフ配置の完成条件に使わない", () => {
  const repository = read(
    "src/modules/manga/infrastructure/dialogue-placement-repository.ts",
  );
  assert.match(repository, /job\.kind !== "image"/);
  assert.match(repository, /cloud_story_storyboard_versions/);
  assert.doesNotMatch(repository, /output\.text/);
});

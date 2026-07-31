import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  buildStoryboardPanelGeneration,
  cloudPanelImageGenerationFeatureEnabled,
  cloudPanelImageGenerationRequestSchema,
} from "../src/lib/cloud-panel-image-generation.ts";
import { MockCloudImageProvider } from "../src/lib/cloud-ai-mock-provider.ts";

const pageId = "10000000-0000-4000-8000-000000000001";
const panelId = "20000000-0000-4000-8000-000000000001";
const panel = (index = 1) => ({
  index,
  shot: "medium",
  cameraAngle: "eye_level",
  composition: "主人公を右手前、駅を左奥に置く",
  characters: ["明日香"],
  background: "朝の駅前",
  action: "主人公が一歩を踏み出す",
  emotion: "迷いから決意へ変わる",
  dialogue: [{ type: "speech", speaker: "明日香", text: "行こう。" }],
  visualDirection: "朝日を逆光として希望を示す",
});
const storyboard = {
  engineVersion: "openai-storyboard-v1",
  generatedAt: "2026-07-30T00:00:00.000Z",
  model: "gpt-5.6-terra",
  classification: "ai_inference",
  containsGeneratedMarketNumbers: false,
  title: "再出発の約束・ネーム",
  pageCount: 8,
  readingDirection: "rtl",
  pages: Array.from({ length: 8 }, (_, index) => ({
    pageNumber: index + 1,
    sceneIndex: index + 1,
    purpose: `ページ${index + 1}の目的`,
    pageTurnHook: "次の選択を見たくなる",
    panels: [panel()],
  })),
  productionNotes: {
    pageRhythm: "前半を速く進める",
    visualMotifs: ["朝日"],
    continuityRisks: ["衣装の連続性"],
  },
};
const canvas = {
  schemaVersion: 1,
  pageId,
  width: 1600,
  height: 2400,
  backgroundColor: "#ffffff",
  panels: [
    {
      id: panelId,
      pageId,
      name: "コマ1",
      x: 48,
      y: 72,
      width: 740,
      height: 1080,
      rotation: 0,
      zIndex: 0,
      visible: true,
      locked: false,
      borderColor: "#111111",
      borderWidth: 4,
      fillColor: "#fafafa",
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
};

test("Release 6 Feature Flagは未設定時fail closedする", () => {
  const previous = process.env.CLOUD_PANEL_IMAGE_GENERATION_ENABLED;
  delete process.env.CLOUD_PANEL_IMAGE_GENERATION_ENABLED;
  assert.equal(cloudPanelImageGenerationFeatureEnabled(), false);
  if (previous !== undefined)
    process.env.CLOUD_PANEL_IMAGE_GENERATION_ENABLED = previous;
});

test("選択コマのネームから利用者入力なしで画像生成条件を作る", () => {
  const result = buildStoryboardPanelGeneration({
    storyboard,
    pageNumber: 1,
    canvas,
    panelId,
  });
  assert.equal(result.panelId, panelId);
  assert.equal(result.generation.targetPanelId, panelId);
  assert.equal(result.generation.jobType, "background");
  assert.match(result.generation.prompt, /朝の駅前/);
  assert.match(result.generation.prompt, /主人公が一歩を踏み出す/);
  assert.match(result.generation.prompt, /吹き出し、セリフ/);
  assert.doesNotMatch(result.generation.prompt, /行こう/);
  assert.ok(result.generation.width >= 256);
  assert.ok(result.generation.height >= 256);
});

test("シナリオの人物設定を画像生成条件へ引き継ぐ", () => {
  const result = buildStoryboardPanelGeneration({
    storyboard,
    pageNumber: 1,
    canvas,
    panelId,
    characterProfiles: [
      {
        id: "character-1",
        name: "明日香",
        role: "protagonist",
        desire: "自分の進路を決めたい",
        fear: "大切な人を失うこと",
        conflict: "期待と本心の間で揺れる",
        arc: "自分で一歩を選ぶ",
      },
    ],
  });
  assert.match(result.generation.prompt, /自分の進路を決めたい/);
  assert.match(result.generation.prompt, /服装の一貫性/);
});

test("版管理された外見設定を生成条件と監査用入力へ固定する", () => {
  const profileId = "70000000-0000-4000-8000-000000000001";
  const result = buildStoryboardPanelGeneration({
    storyboard,
    pageNumber: 1,
    canvas,
    panelId,
    visualCharacterProfiles: [
      {
        id: profileId,
        project_id: "50000000-0000-4000-8000-000000000001",
        name: "明日香",
        role: "protagonist",
        current_version: 3,
        appearance_age: "20代前半",
        body_build: "小柄",
        hair: "黒髪のショートボブ",
        costume: "白いシャツと紺のジャケット",
        color_palette: "黒、白、紺",
        immutable_traits: ["左目の下のほくろ"],
        prompt: "切れ長の目",
        negative_prompt: "長髪",
        updated_at: "2026-07-31T00:00:00.000Z",
      },
    ],
  });
  assert.match(result.generation.prompt, /外見設定v3/);
  assert.match(result.generation.prompt, /黒髪のショートボブ/);
  assert.match(result.generation.prompt, /左目の下のほくろ/);
  assert.match(result.generation.negativePrompt, /長髪/);
  assert.deepEqual(result.generation.characterProfileVersions, [
    { profileId, version: 3 },
  ]);
});

test("画風と該当する場所・小物だけを生成条件へ固定する", () => {
  const bibleId = "71000000-0000-4000-8000-000000000001";
  const locationId = "72000000-0000-4000-8000-000000000001";
  const propId = "73000000-0000-4000-8000-000000000001";
  const base = {
    project_id: "50000000-0000-4000-8000-000000000001",
    current_version: 2,
    color_palette: "白、青",
    visual_traits: [],
    continuity_rules: [],
    prompt: "",
    negative_prompt: "",
    updated_at: "2026-07-31T00:00:00.000Z",
  };
  const result = buildStoryboardPanelGeneration({
    storyboard,
    pageNumber: 1,
    canvas,
    panelId,
    styleBible: {
      id: bibleId,
      project_id: base.project_id,
      current_version: 4,
      art_style: "繊細な青年漫画",
      linework: "細い均一線",
      shading: "網点中心",
      background_detail: "主要コマは詳細",
      composition_rules: "視線誘導を右から左へ",
      negative_prompt: "厚塗り",
      updated_at: base.updated_at,
    },
    worldProfiles: [
      {
        ...base,
        id: locationId,
        kind: "location",
        name: "駅前",
        description: "時計塔のある広場",
        continuity_rules: ["時計塔は左奥"],
      },
      {
        ...base,
        id: propId,
        kind: "prop",
        name: "赤い傘",
        description: "主人公の傘",
      },
    ],
  });
  assert.match(result.generation.prompt, /繊細な青年漫画/);
  assert.match(result.generation.prompt, /時計塔のある広場/);
  assert.doesNotMatch(result.generation.prompt, /赤い傘/);
  assert.match(result.generation.negativePrompt, /厚塗り/);
  assert.deepEqual(result.generation.styleBibleVersion, {
    bibleId,
    version: 4,
  });
  assert.deepEqual(result.generation.worldProfileVersions, [
    { profileId: locationId, version: 2, kind: "location" },
  ]);
});

test("1回の要求で最大4候補まで安全に指定できる", () => {
  const request = cloudPanelImageGenerationRequestSchema.parse({
    projectId: "50000000-0000-4000-8000-000000000001",
    pageId,
    panelId,
    idempotencyKey: "60000000-0000-4000-8000-000000000001",
    candidateCount: 4,
  });
  assert.equal(request.candidateCount, 4);
  assert.throws(
    () =>
      cloudPanelImageGenerationRequestSchema.parse({
        ...request,
        candidateCount: 5,
      }),
    /Too big|less than or equal to 4/i,
  );
});

test("候補ごとに同じネームを保ちながら異なる制作指示を付ける", () => {
  const prompts = Array.from({ length: 4 }, (_, candidateIndex) =>
    buildStoryboardPanelGeneration({
      storyboard,
      pageNumber: 1,
      canvas,
      panelId,
      candidateIndex,
      candidateCount: 4,
    }),
  );
  assert.deepEqual(
    prompts.map((result) => result.candidateNumber),
    [1, 2, 3, 4],
  );
  assert.equal(new Set(prompts.map((result) => result.generation.prompt)).size, 4);
  for (const result of prompts) {
    assert.match(result.generation.prompt, /朝の駅前/);
    assert.equal(result.candidateCount, 4);
  }
});

test("追加コマや存在しないコマはProvider呼出前に拒否する", () => {
  assert.throws(
    () =>
      buildStoryboardPanelGeneration({
        storyboard,
        pageNumber: 1,
        canvas: {
          ...canvas,
          panels: [
            ...canvas.panels,
            {
              ...canvas.panels[0],
              id: "30000000-0000-4000-8000-000000000001",
              name: "追加コマ",
              x: 800,
              zIndex: 1,
            },
          ],
        },
        panelId: "30000000-0000-4000-8000-000000000001",
      }),
    /元ネームがない/,
  );
});

test("作成した条件をモックProviderへ渡し画像を生成できる", async () => {
  const resolved = buildStoryboardPanelGeneration({
    storyboard,
    pageNumber: 1,
    canvas,
    panelId,
  });
  const generated = await new MockCloudImageProvider().generate(
    resolved.generation,
    {
      jobId: "40000000-0000-4000-8000-000000000001",
      projectId: "50000000-0000-4000-8000-000000000001",
      pageId,
      idempotencyKey: "60000000-0000-4000-8000-000000000001",
    },
  );
  const metadata = await sharp(generated.images[0].bytes).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, resolved.generation.width);
  assert.equal(metadata.height, resolved.generation.height);
  assert.equal(generated.usage.actualCostMicros, 0);
});

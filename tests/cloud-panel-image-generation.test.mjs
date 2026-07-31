import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  buildStoryboardPanelGeneration,
  cloudPanelImageGenerationFeatureEnabled,
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

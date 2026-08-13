import assert from "node:assert/strict";
import test from "node:test";
import { buildGeneralAudienceGenerationRetry } from "../src/modules/manga/domain/general-audience-generation-retry.ts";

const imageGeneration = {
  kind: "image",
  jobType: "background",
  prompt: [
    "一般向け日本漫画用モノクロ場面イラスト。",
    "人物設定: 視覚表現に不要な心理的背景。",
    "背景: 夜の港。",
    "動作: 刺激の強い出来事を直接描く。",
    "演出: 出来事を大きく強調する。",
  ].join("\n"),
  negativePrompt: "文字",
  targetPanelId: "10000000-0000-4000-8000-000000000001",
  outputAlphaMode: "preserve",
};

test("Provider拒否後の一般向け再実行は視覚に不要な心理設定と直接描写を外す", () => {
  const retry = buildGeneralAudienceGenerationRetry(imageGeneration);
  assert.match(retry.prompt, /一般向け作品として刺激の強い直接描写を避け/);
  assert.match(retry.prompt, /背景: 夜の港/);
  assert.match(retry.prompt, /表情と視線で状況を伝える/);
  assert.match(retry.prompt, /構図、照明で間接的に伝える/);
  assert.doesNotMatch(retry.prompt, /人物設定:/);
  assert.doesNotMatch(retry.prompt, /刺激の強い出来事を直接描く/);
  assert.equal(retry.targetPanelId, imageGeneration.targetPanelId);
  assert.equal(retry.negativePrompt, imageGeneration.negativePrompt);
});

test("一般向け再実行条件は二重変換せず、文章Jobは変更しない", () => {
  const once = buildGeneralAudienceGenerationRetry(imageGeneration);
  assert.equal(buildGeneralAudienceGenerationRetry(once), once);
  const textGeneration = {
    kind: "text",
    jobType: "story",
    prompt: "短編を作る",
    negativePrompt: "",
    outputAlphaMode: "preserve",
  };
  assert.equal(buildGeneralAudienceGenerationRetry(textGeneration), textGeneration);
});

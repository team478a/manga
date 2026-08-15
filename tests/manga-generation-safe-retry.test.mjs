import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeneralAudienceGenerationRetry,
  isGeneralAudienceGenerationRetry,
} from "../src/modules/manga/domain/general-audience-generation-retry.ts";

const imageGeneration = {
  kind: "image",
  jobType: "background",
  prompt: [
    "一般向けモノクロ漫画場面。",
    "人物設定: 黒髪、細身、灰色のパーカー。",
    "固定ビジュアル設定: 同一人物の顔と衣装を維持する。",
    "この瞬間の動作: 刺激の強い出来事を直接描く。",
    "表情・感情: 強い恐怖。",
    "動作: 刺激の強い出来事を直接描く。",
    "感情: 強い恐怖。",
    "演出: 出来事を大きく強調する。",
    "追加指定: 強い直接描写を追加する。",
  ].join("\n"),
  negativePrompt: "文字",
  targetPanelId: "10000000-0000-4000-8000-000000000001",
  referenceAssetIds: ["20000000-0000-4000-8000-000000000001"],
  outputAlphaMode: "preserve",
};

const providerContractGeneration = {
  ...imageGeneration,
  prompt: [
    "PROVIDER CONTROL CONTRACT:",
    JSON.stringify({
      output_type: "single frameless monochrome manga panel illustration",
      composition:
        "medium close-up head-and-shoulders portrait; complete hair silhouette, both eyes, nose, mouth, chin, neck, and shoulder tops inside the image; clear 10% margin around the head",
      camera_angle: "目線の高さ",
      lettering_stage: "blank artwork ready for dialogue overlay",
    }),
    imageGeneration.prompt,
  ].join("\n"),
};

test("Provider拒否後は人物同一性と参照画像を維持して直接描写だけを安全化する", () => {
  const retry = buildGeneralAudienceGenerationRetry(imageGeneration);
  assert.match(retry.prompt, /一般向け作品として刺激の強い直接描写を避け/);
  assert.match(retry.prompt, /人物設定: 黒髪、細身、灰色のパーカー/);
  assert.match(retry.prompt, /固定ビジュアル設定/);
  assert.match(retry.prompt, /表情と視線で状況を伝える/);
  assert.match(retry.prompt, /構図、照明で.*間接的に伝える/);
  assert.doesNotMatch(retry.prompt, /刺激の強い出来事を直接描く/);
  assert.equal(retry.targetPanelId, imageGeneration.targetPanelId);
  assert.equal(retry.referenceAssetIds, imageGeneration.referenceAssetIds);
  assert.equal(retry.negativePrompt, imageGeneration.negativePrompt);
  assert.equal(isGeneralAudienceGenerationRetry(retry), true);
});

test("一般向け安全化は二重変換せず文章Jobを変更しない", () => {
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

test("Provider拒否後は構造化構図の身体部位列挙を安全な非crop契約へ置換する", () => {
  const retry = buildGeneralAudienceGenerationRetry(providerContractGeneration);
  const contract = JSON.parse(retry.prompt.split("\n")[2]);
  assert.equal(
    contract.composition,
    "uncropped medium portrait; subject centered and fully contained; complete silhouette surrounded by clear background; subject height about 65% of image height",
  );
  assert.equal(contract.camera_angle, "目線の高さ");
  assert.match(retry.prompt, /人物設定: 黒髪、細身、灰色のパーカー/);
  assert.doesNotMatch(retry.prompt, /both eyes, nose, mouth, chin/);
});

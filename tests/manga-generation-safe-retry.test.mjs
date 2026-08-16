import assert from "node:assert/strict";
import test from "node:test";
import { moderateGeneralCloudPrompt } from "@mangai/ai-core";
import {
  buildConservativeGeneralAudienceGenerationRetry,
  buildGeneralAudienceGenerationRetry,
  isConservativeGeneralAudienceGenerationRetry,
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

const compactProviderContractGeneration = {
  ...imageGeneration,
  prompt: [
    "PROVIDER CONTROL CONTRACT:",
    JSON.stringify({
      scene: "one general-audience monochrome manga portrait from one camera view",
      subjects: [
        {
          description: "same black-haired protagonist in a gray hoodie",
          action: "directly depicts a disturbing incident",
          expression: "intense fear caused by the incident",
          position: "centered with the complete portrait silhouette visible",
        },
      ],
      style: "clean monochrome manga ink linework",
      background: "the disturbing incident is shown directly in the background",
      composition:
        "uncropped medium portrait; subject centered and fully contained; complete silhouette surrounded by clear background; subject height about 65% of image height",
      camera: {
        angle: "eye level",
        distance: "stable medium portrait distance",
        lens: "70mm-equivalent portrait lens",
      },
      surface_finish: "clean unmarked monochrome pictorial line art",
      variation: "emphasize the disturbing incident",
      input_image_roles: ["input_image_1: preserve character identity only"],
    }),
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
  assert.match(retry.prompt, /手持ち端末は無地の背面または細い側面だけ/);
  assert.match(retry.prompt, /必要な小物はそれぞれ一つだけ/);
  assert.match(retry.negativePrompt, /pseudo-text/);
  assert.match(retry.negativePrompt, /device screen UI/);
  assert.match(retry.negativePrompt, /duplicate props/);
  assert.match(retry.negativePrompt, /文字$/);
  assert.equal(retry.targetPanelId, imageGeneration.targetPanelId);
  assert.equal(retry.referenceAssetIds, imageGeneration.referenceAssetIds);
  assert.equal(
    moderateGeneralCloudPrompt(
      `${retry.prompt}\n${retry.negativePrompt}`,
    ).decision,
    "allow",
  );
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
    "roomy environmental portrait; subject occupies about 58% of canvas height; complete silhouette remains comfortably inside the canvas with generous headroom and environmental space on both sides",
  );
  assert.equal(contract.camera_angle, "目線の高さ");
  assert.match(retry.prompt, /人物設定: 黒髪、細身、灰色のパーカー/);
  assert.doesNotMatch(retry.prompt, /both eyes, nose, mouth, chin/);
});

test("短縮クローズアップ契約は同一性と撮影条件を保って直接描写だけを安全化する", () => {
  const retry = buildGeneralAudienceGenerationRetry(
    compactProviderContractGeneration,
  );
  const contract = JSON.parse(retry.prompt.split("\n")[2]);

  assert.equal(
    contract.subjects[0].description,
    "same black-haired protagonist in a gray hoodie",
  );
  assert.match(contract.subjects[0].action, /posture and gaze/);
  assert.match(contract.subjects[0].expression, /general audience/);
  assert.match(contract.background, /non-graphic/);
  assert.match(contract.variation, /convey tension indirectly/);
  assert.match(contract.scene, /roomy environmental portrait/);
  assert.match(contract.output_type, /continuous edge-to-edge/);
  assert.match(contract.canvas, /one uninterrupted pictorial scene/);
  assert.match(contract.subjects[0].position, /top of hairstyle near 18%/);
  assert.equal(contract.camera.angle, "eye level");
  assert.deepEqual(contract.framing, {
    subject_height_percent: 58,
    top_hair_y_percent: 18,
    lower_clothing_y_percent: 82,
    side_environment_percent: 18,
  });
  assert.equal(
    contract.camera.distance,
    "roomy environmental portrait distance with the camera clearly pulled back",
  );
  assert.equal(contract.camera["lens-mm"], 50);
  assert.equal("lens" in contract.camera, false);
  assert.match(contract.camera.focus, /identity and expression/);
  assert.match(contract.surface_content, /pure pictorial artwork/);
  assert.match(contract.face_finish, /clean linework and shading/);
  assert.match(contract.quality_gate, /each required prop exactly once/);
  assert.match(contract.quality_gate, /plain back or side edge/);
  assert.match(contract.quality_gate, /pure pictorial marks/);
  assert.doesNotMatch(retry.prompt, /speaking|lettering|unmarked/);
  assert.doesNotMatch(JSON.stringify(contract), /\b(?:chest|waist)\b/i);
  assert.deepEqual(contract.input_image_roles, [
    "input_image_1: preserve character identity only",
  ]);
  assert.doesNotMatch(retry.prompt, /disturbing incident|intense fear/);
  assert.equal(retry.targetPanelId, imageGeneration.targetPanelId);
  assert.equal(retry.referenceAssetIds, imageGeneration.referenceAssetIds);
});

test("安全再構成もProviderに拒否された場合は穏やかな日常場面へ一度だけ再構成する", () => {
  const firstRetry = buildGeneralAudienceGenerationRetry(
    compactProviderContractGeneration,
  );
  const conservativeRetry = buildConservativeGeneralAudienceGenerationRetry(
    firstRetry,
  );
  const contract = JSON.parse(conservativeRetry.prompt.split("\n")[4]);

  assert.equal(isGeneralAudienceGenerationRetry(conservativeRetry), true);
  assert.equal(
    isConservativeGeneralAudienceGenerationRetry(conservativeRetry),
    true,
  );
  assert.match(conservativeRetry.prompt, /一般向けの穏やかな日常場面/);
  assert.match(contract.scene, /calm general-audience manga moment/);
  assert.match(contract.background, /tidy well-lit everyday environment/);
  assert.match(contract.variation, /calm natural pose/);
  assert.match(contract.quality_gate, /plain back or side edge/);
  assert.match(contract.subjects[0].description, /same black-haired protagonist/);
  assert.deepEqual(
    conservativeRetry.referenceAssetIds,
    imageGeneration.referenceAssetIds,
  );
  assert.equal(
    moderateGeneralCloudPrompt(
      `${conservativeRetry.prompt}\n${conservativeRetry.negativePrompt}`,
    ).decision,
    "allow",
  );
  assert.equal(
    buildConservativeGeneralAudienceGenerationRetry(conservativeRetry),
    conservativeRetry,
  );
});

test("詳細Promptの第2段階再構成は背景・構図・動作を穏やかな内容へ置換する", () => {
  const firstRetry = buildGeneralAudienceGenerationRetry({
    ...imageGeneration,
    prompt: [
      imageGeneration.prompt,
      "場所: 刺激の強い出来事が起きている場所。",
      "背景: 出来事を直接描く。",
      "人物と背景の配置: 出来事を大きく見せる。",
      "構図: 出来事を中央に置く。",
    ].join("\n"),
  });
  const conservativeRetry = buildConservativeGeneralAudienceGenerationRetry(
    firstRetry,
  );

  assert.match(conservativeRetry.prompt, /明るく整った一般向けの日常環境/);
  assert.match(conservativeRetry.prompt, /余白のある安定した構図/);
  assert.doesNotMatch(conservativeRetry.prompt, /出来事を直接描く/);
});

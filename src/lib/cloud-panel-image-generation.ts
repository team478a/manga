import { z } from "zod";
import { pageCanvasSchema, type PageCanvas } from "@mangai/canvas-core";
import {
  cloudStoryboardResultSchema,
  type CloudStoryboardResult,
} from "./cloud-storyboard.ts";
import {
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "./domain-errors.ts";
import type { CloudStoryScenarioResult } from "./cloud-scenario.ts";
import type { CloudCharacterProfile } from "./cloud-character-profile.ts";
import {
  resolveWorldProfilesForPanel,
  type CloudStyleBible,
  type CloudWorldProfile,
} from "./cloud-world-bible.ts";

export const cloudPanelImageGenerationFeatureEnabled = () =>
  process.env.CLOUD_PANEL_IMAGE_GENERATION_ENABLED?.toLowerCase() === "true";

export const cloudPanelImageGenerationRequestSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  panelId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  candidateCount: z.number().int().min(1).max(4).default(1),
});

export type CloudPanelImageGenerationRequest = z.infer<
  typeof cloudPanelImageGenerationRequestSchema
>;

const shotLabels: Record<
  CloudStoryboardResult["pages"][number]["panels"][number]["shot"],
  string
> = {
  extreme_close_up: "極端なクローズアップ",
  close_up: "クローズアップ",
  medium: "中景",
  wide: "広い画角",
  establishing: "状況を示す遠景",
  detail: "細部の寄り",
};

const angleLabels: Record<
  CloudStoryboardResult["pages"][number]["panels"][number]["cameraAngle"],
  string
> = {
  eye_level: "目線の高さ",
  high: "俯瞰",
  low: "あおり",
  over_shoulder: "肩越し",
  top_down: "真上",
  dynamic: "躍動的な角度",
};

function imageSize(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = 1024 / Math.max(safeWidth, safeHeight);
  const round = (value: number) =>
    Math.max(256, Math.min(1536, Math.round(value / 64) * 64));
  return {
    width: round(safeWidth * scale),
    height: round(safeHeight * scale),
  };
}

export function buildStoryboardPanelGeneration(input: {
  storyboard: unknown;
  pageNumber: number;
  canvas: unknown;
  panelId: string;
  candidateIndex?: number;
  candidateCount?: number;
  characterProfiles?: CloudStoryScenarioResult["characters"];
  visualCharacterProfiles?: CloudCharacterProfile[];
  styleBible?: CloudStyleBible | null;
  worldProfiles?: CloudWorldProfile[];
}) {
  const storyboard = cloudStoryboardResultSchema.parse(input.storyboard);
  const canvas: PageCanvas = pageCanvasSchema.parse(input.canvas);
  const canvasPanelIndex = canvas.panels.findIndex(
    (panel) => panel.id === input.panelId,
  );
  if (canvasPanelIndex < 0)
    throw new ResourceNotFoundError("選択したコマが見つかりません。");
  const storyboardPage = storyboard.pages.find(
    (page) => page.pageNumber === input.pageNumber,
  );
  if (!storyboardPage)
    throw new ResourceNotFoundError("ネームのページが見つかりません。");
  const storyboardPanel = storyboardPage.panels[canvasPanelIndex];
  if (!storyboardPanel)
    throw new ValidationError(
      "追加したコマには元ネームがないため、おまかせ生成を利用できません。",
    );
  const canvasPanel = canvas.panels[canvasPanelIndex];
  const characters = storyboardPanel.characters.length
    ? storyboardPanel.characters.join("、")
    : "人物なし";
  const characterDetails = storyboardPanel.characters
    .map((name) =>
      input.characterProfiles?.find(
        (character) => character.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
    )
    .filter(
      (character): character is CloudStoryScenarioResult["characters"][number] =>
        Boolean(character),
    )
    .map(
      (character) =>
        `${character.name}（役割:${character.role}、望み:${character.desire}、恐れ:${character.fear}、葛藤:${character.conflict}）`,
    );
  const visualProfiles = storyboardPanel.characters
    .map((name) =>
      input.visualCharacterProfiles?.find(
        (character) =>
          character.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
    )
    .filter((profile): profile is CloudCharacterProfile => Boolean(profile));
  const visualDetails = visualProfiles.map((profile) =>
    [
      `${profile.name}（外見設定v${profile.current_version}`,
      profile.appearance_age && `見た目年齢:${profile.appearance_age}`,
      profile.body_build && `体格:${profile.body_build}`,
      profile.hair && `髪:${profile.hair}`,
      profile.costume && `衣装:${profile.costume}`,
      profile.color_palette && `配色:${profile.color_palette}`,
      profile.immutable_traits.length &&
        `変えてはいけない特徴:${profile.immutable_traits.join("、")}`,
      profile.prompt && `追加指定:${profile.prompt}`,
    ]
      .filter(Boolean)
      .join("、") + "）",
  );
  const worldProfiles = resolveWorldProfilesForPanel(
    input.worldProfiles ?? [],
    storyboardPanel,
  );
  const worldDetails = worldProfiles.map((profile) =>
    [
      `${profile.kind === "location" ? "場所" : "小物"}:${profile.name}（設定v${profile.current_version}`,
      profile.description && `概要:${profile.description}`,
      profile.visual_traits.length && `特徴:${profile.visual_traits.join("、")}`,
      profile.color_palette && `配色:${profile.color_palette}`,
      profile.continuity_rules.length &&
        `変えてはいけない点:${profile.continuity_rules.join("、")}`,
      profile.prompt && `追加指定:${profile.prompt}`,
    ].filter(Boolean).join("、") + "）",
  );
  const styleDetails = input.styleBible
    ? [
        `作品画風（設定v${input.styleBible.current_version}）`,
        input.styleBible.art_style && `画風:${input.styleBible.art_style}`,
        input.styleBible.linework && `線:${input.styleBible.linework}`,
        input.styleBible.shading && `陰影:${input.styleBible.shading}`,
        input.styleBible.background_detail &&
          `背景密度:${input.styleBible.background_detail}`,
        input.styleBible.composition_rules &&
          `構図ルール:${input.styleBible.composition_rules}`,
      ].filter(Boolean).join("、")
    : "";
  const candidateCount = Math.max(1, Math.min(4, input.candidateCount ?? 1));
  const candidateIndex = Math.max(
    0,
    Math.min(candidateCount - 1, input.candidateIndex ?? 0),
  );
  const variationDirections = [
    "ネームの構図と人物配置を最優先し、読みやすい基準案にする。",
    "人物の表情と感情の伝わりやすさを優先した別案にする。",
    "視線誘導と明暗の演出を強めた別案にする。",
    "背景情報と奥行きを明瞭にした別案にする。",
  ];
  const prompt = [
    "一般向け日本漫画の完成原稿用モノクロ1コマ。",
    `画角: ${shotLabels[storyboardPanel.shot]}。`,
    `カメラ: ${angleLabels[storyboardPanel.cameraAngle]}。`,
    `構図: ${storyboardPanel.composition}。`,
    `登場人物: ${characters}。`,
    characterDetails.length
      ? `人物設定: ${characterDetails.join(" / ")}。同一人物の顔立ち、髪型、体格、服装の一貫性を保つ。`
      : "登場人物がいる場合は、前後のコマと外見の一貫性を保つ。",
    visualDetails.length
      ? `固定ビジュアル設定: ${visualDetails.join(" / ")}。この設定を最優先し、別人化や衣装変更を避ける。`
      : "固定ビジュアル設定がない人物は、ネームと前後のコマから自然に補完する。",
    styleDetails || "作品全体で漫画の線、陰影、背景密度を統一する。",
    worldDetails.length
      ? `固定世界設定: ${worldDetails.join(" / ")}。同じ場所・小物の形状と配置規則を維持する。`
      : "登録済みの場所・小物名に一致しない場合は、ネームの背景指定を優先する。",
    `背景: ${storyboardPanel.background}。`,
    `動作: ${storyboardPanel.action}。`,
    `感情: ${storyboardPanel.emotion}。`,
    `演出: ${storyboardPanel.visualDirection}。`,
    candidateCount > 1
      ? `候補${candidateIndex + 1}/${candidateCount}: ${variationDirections[candidateIndex]}`
      : variationDirections[0],
    "吹き出し、セリフ、字幕、ロゴ、透かしは描かない。",
  ].join("\n");
  if (prompt.length > 20_000)
    throw new ValidationError("生成条件が長すぎます。");
  return {
    generation: {
      kind: "image" as const,
      jobType: "background" as const,
      prompt,
      negativePrompt: [
        "文字、字幕、ロゴ、透かし、低品質、崩れた構図、別人、髪型の変化、衣装の無断変更",
        ...visualProfiles
          .map((profile) => profile.negative_prompt)
          .filter(Boolean),
        input.styleBible?.negative_prompt ?? "",
        ...worldProfiles.map((profile) => profile.negative_prompt).filter(Boolean),
      ].join("、"),
      targetPanelId: canvasPanel.id,
      characterProfileVersions: visualProfiles.map((profile) => ({
        profileId: profile.id,
        version: profile.current_version,
      })),
      styleBibleVersion: input.styleBible
        ? {
            bibleId: input.styleBible.id,
            version: input.styleBible.current_version,
          }
        : undefined,
      worldProfileVersions: worldProfiles.map((profile) => ({
        profileId: profile.id,
        version: profile.current_version,
        kind: profile.kind,
      })),
      ...imageSize(canvasPanel.width, canvasPanel.height),
    },
    panelId: canvasPanel.id,
    pageNumber: storyboardPage.pageNumber,
    panelNumber: storyboardPanel.index,
    candidateNumber: candidateIndex + 1,
    candidateCount,
  };
}

export function assertGeneralStoryboardProject(input: {
  materializationFound: boolean;
  ownerProfileId: string | null;
  expectedOwnerProfileId: string;
}) {
  if (
    !input.materializationFound ||
    input.ownerProfileId !== input.expectedOwnerProfileId
  )
    throw new PermissionDeniedError(
      "採用ネームから作成した本人のCanvasだけで利用できます。",
    );
}

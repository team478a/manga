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
import { featureFlagEnabled } from "./feature-flags.ts";
import {
  resolveWorldProfilesForPanel,
  type CloudStyleBible,
  type CloudWorldProfile,
} from "./cloud-world-bible.ts";
import { panelSpecificationSchema } from "../modules/manga-quality/domain/panel-specification.ts";
import { registerCharacterIdentity } from "../modules/manga-quality/application/manage-character-identity.ts";
import { attachCharacterIdentities } from "../modules/manga-quality/application/attach-character-identities.ts";
import {
  selectPanelReferenceAssets,
  type PanelReferenceAsset,
} from "../modules/manga/domain/panel-reference-policy.ts";

export const cloudPanelImageGenerationFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_PANEL_IMAGE_GENERATION_ENABLED");
export const cloudPanelInpaintingFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_PANEL_INPAINTING_ENABLED");
export const cloudPanelOutpaintingFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_PANEL_OUTPAINTING_ENABLED");

export const cloudPanelImageGenerationRequestSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  panelId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  candidateCount: z.number().int().min(1).max(4).default(1),
  sourceAssetId: z.string().uuid().optional(),
  maskAssetId: z.string().uuid().optional(),
  outpaintingDirection: z
    .enum(["left", "right", "top", "bottom", "all"])
    .optional(),
  revisionPreset: z
    .enum(["face", "hands", "expression", "costume", "background", "polish"])
    .optional(),
  revisionInstruction: z.string().trim().max(1000).optional(),
  shotOverride: z
    .enum(["storyboard", "close_up", "medium", "wide", "full_body"])
    .optional(),
  cameraAngleOverride: z
    .enum(["storyboard", "eye_level", "high", "low", "over_shoulder", "dynamic"])
    .optional(),
  subjectPlacement: z
    .enum(["storyboard", "center", "left", "right", "two_shot", "foreground_background"])
    .optional(),
  gazeDirection: z
    .enum(["storyboard", "camera", "left", "right", "partner", "off_frame"])
    .optional(),
  compositionInstruction: z.string().trim().max(500).optional(),
  generationTarget: z
    .enum(["composite", "background", "character", "effect"])
    .default("composite"),
}).superRefine((value, context) => {
  const revisionValues = [
    value.sourceAssetId,
    value.maskAssetId,
    value.outpaintingDirection,
    value.revisionPreset,
    value.revisionInstruction,
  ].filter(Boolean).length;
  if (revisionValues > 0 && (!value.sourceAssetId || !value.revisionPreset))
    context.addIssue({
      code: "custom",
      path: ["sourceAssetId"],
      message: "修正元画像と修正内容を指定してください。",
    });
  if (value.maskAssetId && !value.sourceAssetId)
    context.addIssue({
      code: "custom",
      path: ["maskAssetId"],
      message: "部分修正には修正元画像が必要です。",
    });
  if (value.outpaintingDirection && !value.sourceAssetId)
    context.addIssue({
      code: "custom",
      path: ["outpaintingDirection"],
      message: "画角拡張には修正元画像が必要です。",
    });
  if (value.maskAssetId && value.outpaintingDirection)
    context.addIssue({
      code: "custom",
      path: ["outpaintingDirection"],
      message: "部分修正と画角拡張は同時に指定できません。",
    });
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

const outpaintingDirectionLabels = {
  left: "左側",
  right: "右側",
  top: "上側",
  bottom: "下側",
  all: "全方向",
} as const;

const shotOverrideDirections = {
  storyboard: "ネームで指定した画角を維持する",
  close_up: "顔と表情が主役になるクローズアップにする",
  medium: "人物の上半身と動作が分かる中景にする",
  wide: "人物と背景の関係が分かる広い画角にする",
  full_body: "頭から足先まで入り、全身のポーズが分かる画角にする",
} as const;

const cameraAngleOverrideDirections = {
  storyboard: "ネームで指定したカメラ位置を維持する",
  eye_level: "人物の目線と同じ高さから撮る",
  high: "人物を上から見下ろす俯瞰にする",
  low: "人物を下から見上げるあおりにする",
  over_shoulder: "手前人物の肩越しに相手を見る構図にする",
  dynamic: "奥行きと動きを強調する躍動的な角度にする",
} as const;

const subjectPlacementDirections = {
  storyboard: "ネームで指定した人物配置を維持する",
  center: "主役を中央に置き、視線を一点へ集める",
  left: "主役を画面左側に置き、右側に視線と動きの余白を作る",
  right: "主役を画面右側に置き、左側に視線と動きの余白を作る",
  two_shot: "二人の表情と位置関係が同時に分かる配置にする",
  foreground_background: "手前と奥に人物を分け、距離と関係性を見せる",
} as const;

const gazeDirectionDirections = {
  storyboard: "ネームで指定した視線を維持する",
  camera: "主役の視線をカメラへ向ける",
  left: "主役の視線を画面左へ向ける",
  right: "主役の視線を画面右へ向ける",
  partner: "主役の視線を会話相手へ向ける",
  off_frame: "主役の視線を画面外の対象へ向け、続きを意識させる",
} as const;

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
  explicitCharacterProfileIds?: string[];
  explicitWorldProfileIds?: string[];
  referenceAssets?: PanelReferenceAsset[];
  revision?: {
    sourceAssetId: string;
    maskAssetId?: string;
    outpaintingDirection?: "left" | "right" | "top" | "bottom" | "all";
    preset: "face" | "hands" | "expression" | "costume" | "background" | "polish";
    instruction?: string;
  };
  compositionControl?: {
    shot: keyof typeof shotOverrideDirections;
    cameraAngle: keyof typeof cameraAngleOverrideDirections;
    subjectPlacement: keyof typeof subjectPlacementDirections;
    gazeDirection: keyof typeof gazeDirectionDirections;
    instruction?: string;
  };
  generationTarget?: "composite" | "background" | "character" | "effect";
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
  const automaticVisualProfiles = storyboardPanel.characters
    .map((name) =>
      input.visualCharacterProfiles?.find(
        (character) =>
          character.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
    )
    .filter((profile): profile is CloudCharacterProfile => Boolean(profile));
  const visualProfiles = Array.from(
    new Map(
      [
        ...automaticVisualProfiles,
        ...(input.visualCharacterProfiles ?? []).filter((profile) =>
          input.explicitCharacterProfileIds?.includes(profile.id),
        ),
      ].map((profile) => [profile.id, profile]),
    ).values(),
  );
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
  const automaticWorldProfiles = resolveWorldProfilesForPanel(
    input.worldProfiles ?? [],
    storyboardPanel,
  );
  const worldProfiles = Array.from(
    new Map(
      [
        ...automaticWorldProfiles,
        ...(input.worldProfiles ?? []).filter((profile) =>
          input.explicitWorldProfileIds?.includes(profile.id),
        ),
      ].map((profile) => [profile.id, profile]),
    ).values(),
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
  const generationTarget = input.generationTarget ?? "composite";
  const usesCharacters =
    generationTarget === "composite" || generationTarget === "character";
  const usesWorld =
    generationTarget === "composite" || generationTarget === "background";
  const selectedVisualProfiles = usesCharacters ? visualProfiles : [];
  const selectedWorldProfiles = usesWorld ? worldProfiles : [];
  const selectedReferenceAssets = selectPanelReferenceAssets({
    references: input.referenceAssets ?? [],
    orderedSubjects: [
      ...selectedVisualProfiles.map((profile) => ({
        kind: "character" as const,
        id: profile.id,
      })),
      ...(input.styleBible
        ? [{ kind: "style" as const, id: input.styleBible.id }]
        : []),
      ...selectedWorldProfiles.map((profile) => ({
        kind: profile.kind,
        id: profile.id,
      })),
    ],
  });
  const referenceAssetIds = selectedReferenceAssets.map(
    (reference) => reference.assetId,
  );
  const characterIdentities = selectedVisualProfiles.map((profile) =>
    registerCharacterIdentity({
      id: profile.id,
      name: profile.name,
      appearanceAge: profile.appearance_age,
      bodyBuild: profile.body_build,
      hair: profile.hair,
      costume: profile.costume,
      immutableTraits: profile.immutable_traits,
      referenceAssetIds: (input.referenceAssets ?? [])
        .filter(
          (reference) =>
            reference.subjectKind === "character" &&
            reference.subjectId === profile.id,
        )
        .map((reference) => reference.assetId),
    }),
  );
  const panelSpecification = attachCharacterIdentities(
    panelSpecificationSchema.parse({
      version: 1,
      panelId: canvasPanel.id,
      characterNames: usesCharacters ? storyboardPanel.characters : [],
      expectedCharacterCount: usesCharacters
        ? storyboardPanel.characters.length
        : 0,
      expression: usesCharacters ? storyboardPanel.emotion : "",
      composition: [
        storyboardPanel.composition,
        input.compositionControl?.instruction,
      ]
        .filter(Boolean)
        .join(" / "),
      background: usesWorld ? storyboardPanel.background : "",
      props: selectedWorldProfiles
        .filter((profile) => profile.kind === "prop")
        .map((profile) => profile.name),
      action: usesCharacters ? storyboardPanel.action : "",
      shot: input.compositionControl?.shot ?? storyboardPanel.shot,
      cameraAngle:
        input.compositionControl?.cameraAngle ?? storyboardPanel.cameraAngle,
      generationTarget,
    }),
    characterIdentities,
  );
  const referenceCounts = selectedReferenceAssets.reduce(
    (counts, reference) => ({
      ...counts,
      [reference.subjectKind]: counts[reference.subjectKind] + 1,
    }),
    { character: 0, style: 0, location: 0, prop: 0 },
  );
  const referenceGuidance = selectedReferenceAssets.length
    ? [
        `参照素材: 人物${referenceCounts.character}点・画風${referenceCounts.style}点・場所${referenceCounts.location}点・小物${referenceCounts.prop}点。参照素材は人物同一性、衣装、画風、場所、小物の形だけに用い、場面と構図は次の生成契約を優先する。`,
        "Use supplied images only for the referenced identity and visual traits. The scene contract below overrides their camera view and composition.",
      ]
    : [];
  const contractedShot =
    !input.compositionControl || input.compositionControl.shot === "storyboard"
      ? shotLabels[storyboardPanel.shot]
      : shotOverrideDirections[input.compositionControl.shot];
  const contractedCamera =
    !input.compositionControl ||
    input.compositionControl.cameraAngle === "storyboard"
      ? angleLabels[storyboardPanel.cameraAngle]
      : cameraAngleOverrideDirections[input.compositionControl.cameraAngle];
  const sceneContract = [
    "【生成契約：一枚の場面画像】",
    `登場人数: ${panelSpecification.expectedCharacterCount}人。`,
    panelSpecification.characterNames.length
      ? `登場人物: ${panelSpecification.characterNames.join("、")}。`
      : "人物を配置しない。",
    panelSpecification.action ? `この瞬間の動作: ${panelSpecification.action}。` : "",
    panelSpecification.expression
      ? `表情・感情: ${panelSpecification.expression}。`
      : "",
    panelSpecification.background ? `場所: ${panelSpecification.background}。` : "",
    panelSpecification.props.length
      ? `必要な小物: ${panelSpecification.props.join("、")}。`
      : "",
    panelSpecification.composition
      ? `人物と背景の配置: ${panelSpecification.composition}。`
      : "",
    `画角: ${contractedShot}。カメラ: ${contractedCamera}。`,
    "画像全体をこの一つの瞬間と一つの視点だけで満たす。編集用の文字要素は後工程で追加するため、描画面は意味のある絵だけで完成させる。",
  ].filter(Boolean);
  const candidateCount = Math.max(1, Math.min(4, input.candidateCount ?? 1));
  const candidateIndex = Math.max(
    0,
    Math.min(candidateCount - 1, input.candidateIndex ?? 0),
  );
  const variationDirections = {
    composite: [
      "ネームの構図と人物配置を最優先し、読みやすい基準案にする。",
      "人物の表情と感情の伝わりやすさを優先した別案にする。",
      "視線誘導と明暗の演出を強めた別案にする。",
      "背景情報と奥行きを明瞭にした別案にする。",
    ],
    background: [
      "ネームの空間配置を最優先した読みやすい背景にする。",
      "遠近感と奥行きを強調した背景にする。",
      "光と影で時間帯と雰囲気を強調した背景にする。",
      "場所を識別できる情報量を増やした背景にする。",
    ],
    character: [
      "ネームのポーズとシルエットを最優先した人物素材にする。",
      "表情と感情の伝わりやすさを優先した人物素材にする。",
      "手足の動きと重心を明瞭にした人物素材にする。",
      "衣装と外見設定の再現を優先した人物素材にする。",
    ],
    effect: [
      "ネームの演出意図を最優先した読みやすい効果にする。",
      "視線誘導を強める効果線の別案にする。",
      "明暗とコントラストを強めた効果の別案にする。",
      "線の密度とリズムを変えた効果の別案にする。",
    ],
  } as const;
  const revisionDirections = {
    face: "元画像の構図・人物・衣装・背景を維持し、顔立ちと目鼻の崩れだけを自然に修正する。",
    hands: "元画像の構図・人物・衣装・背景を維持し、手指の本数・関節・持ち方の崩れだけを自然に修正する。",
    expression: "元画像の構図・人物・衣装・背景を維持し、ネームで指定した感情が伝わる表情へ修正する。",
    costume: "元画像の構図・人物・背景を維持し、登録済み人物設定どおりの衣装へ修正する。",
    background: "元画像の人物・ポーズ・表情を維持し、ネームと場所設定に沿う背景へ修正する。",
    polish: "元画像の内容と構図を維持し、線の乱れ、形状破綻、不要物だけを整えて完成度を上げる。",
  } as const;
  const targetDirections = {
    composite:
      "背景・人物・演出を含む完成コマとして描く。各要素を一枚の画像として自然に統合する。",
    background:
      "無人の背景空間として描く。建築、風景、小物、自然な環境光で構成し、後から人物を重ねられる連続した空間を確保する。",
    character:
      "純白の無地背景に人物を描く。黒い漫画線と必要最小限の網点で全身とポーズを明瞭にする。",
    effect:
      "純白の無地背景に漫画の効果素材を描く。効果線、集中線、スピード線、衝撃、光、影の演出を黒い線と網点で明瞭に構成する。",
  } as const;
  const explicitlyNonUprightAction =
    /(?:逆さ|上下反転|落下|転落|落ち(?:る|た|て|そう)|吊|ぶら下|横たわ|倒れ|\bfall(?:ing)?\b|\bhang(?:ing)?\b|\bsuspended\b|upside[ -]?down|\blying\b)/i.test(
      [
        storyboardPanel.action,
        storyboardPanel.composition,
        storyboardPanel.visualDirection,
      ].join(" "),
    );
  const uprightDirection = explicitlyNonUprightAction
    ? [
        "紙面の上辺と地平線を正立させる。ネームで明示された非正立の動作だけを、重力と関節が読み取れる意図的な姿勢として描き、ほかの人物は自然に正立させる。",
        "Keep the page frame and horizon upright. Render only the clearly described off-balance subject as a deliberate, anatomically coherent action under gravity; all other people remain conventionally upright.",
      ]
    : [
        "紙面の上辺を上、下辺を地面側とする自然な正立方向で描く。人物は頭部が画面上側、足元が画面下側となり、重力に沿った姿勢にする。",
        "Upright orientation with the top edge skyward and the bottom edge groundward. Human heads stay toward the top edge, feet toward the bottom edge, with natural anatomy and gravity.",
      ];
  const prompt = [
    "端から端まで一続きの、一般向けモノクロインク場面イラスト。枠のない一枚の長方形画像として描く。",
    "A single frameless rectangular monochrome ink illustration for a general audience.",
    ...referenceGuidance,
    ...sceneContract,
    "画像全体を一つの視点、一つの瞬間、連続した一つの場面で満たす。画面は純粋な絵だけで構成し、表面は無記名で清潔に保つ。",
    "A single continuous edge-to-edge monochrome scene, one camera view and one moment in time, composed as pure unlettered pictorial artwork.",
    ...uprightDirection,
    "画面内の線と形は、人物・背景・小物・光・影として意味のある絵柄だけで構成し、顔、手指、関節を自然な人体構造で仕上げる。",
    "Every mark and shape belongs to the depicted people, environment, objects, light, or shadow as coherent pictorial artwork.",
    "小物はネームで指定した持ち方と位置だけに置き、手指との接触、衣服との境界、実物らしい大きさを明瞭にする。平面や衣服・小物の表面は、記号に見えない無地の面と素材の陰影で描く。",
    "Props have clear physical contact, believable scale, and clean separation from anatomy and clothing. Flat surfaces use plain, featureless material shading made only from non-symbolic pictorial marks.",
    `生成対象: ${targetDirections[generationTarget]}`,
    `画角: ${shotLabels[storyboardPanel.shot]}。`,
    `カメラ: ${angleLabels[storyboardPanel.cameraAngle]}。`,
    `構図: ${storyboardPanel.composition}。`,
    input.compositionControl
      ? [
          "構図調整:",
          `${shotOverrideDirections[input.compositionControl.shot]}。`,
          `${cameraAngleOverrideDirections[input.compositionControl.cameraAngle]}。`,
          usesCharacters
            ? `${subjectPlacementDirections[input.compositionControl.subjectPlacement]}。`
            : "",
          usesCharacters
            ? `${gazeDirectionDirections[input.compositionControl.gazeDirection]}。`
            : "",
          input.compositionControl.instruction
            ? `追加指定:${input.compositionControl.instruction}。`
            : "",
        ].join("")
      : "",
    usesCharacters ? `登場人物: ${characters}。` : "",
    usesCharacters && characterDetails.length
      ? `人物設定: ${characterDetails.join(" / ")}。同一人物の顔立ち、髪型、体格、服装の一貫性を保つ。`
      : usesCharacters
        ? "登場人物がいる場合は、前後のコマと外見の一貫性を保つ。"
        : "",
    usesCharacters && visualDetails.length
      ? `固定ビジュアル設定: ${visualDetails.join(" / ")}。この設定を最優先し、別人化や衣装変更を避ける。`
      : usesCharacters
        ? "固定ビジュアル設定がない人物は、ネームと前後のコマから自然に補完する。"
        : "",
    styleDetails || "作品全体で漫画の線、陰影、背景密度を統一する。",
    usesWorld && worldDetails.length
      ? `固定世界設定: ${worldDetails.join(" / ")}。同じ場所・小物の形状と配置規則を維持する。`
      : usesWorld
        ? "登録済みの場所・小物名に一致しない場合は、ネームの背景指定を優先する。"
        : "",
    usesWorld ? `背景: ${storyboardPanel.background}。` : "",
    usesCharacters ? `動作: ${storyboardPanel.action}。` : "",
    usesCharacters ? `感情: ${storyboardPanel.emotion}。` : "",
    generationTarget === "composite" || generationTarget === "effect"
      ? `演出: ${storyboardPanel.visualDirection}。`
      : "",
    candidateCount > 1
      ? `候補${candidateIndex + 1}/${candidateCount}: ${variationDirections[generationTarget][candidateIndex]}`
      : variationDirections[generationTarget][0],
    input.revision
      ? `修正指示: ${revisionDirections[input.revision.preset]}${input.revision.instruction ? ` 追加要望:${input.revision.instruction}` : ""}`
      : "",
    input.revision?.outpaintingDirection
      ? `画角拡張: ${outpaintingDirectionLabels[input.revision.outpaintingDirection]}へ自然に背景と構図を延長する。元画像内の人物、衣装、表情、線、色を変更しない。`
      : "",
    ...sceneContract,
    "最終出力は、生成契約どおりの一つの瞬間だけを端から端まで描いた、枠のない無記名の完成イラストにする。",
    "最終確認として、正立方向、自然な人体、意味のある絵柄だけで構成された一枚絵に整える。",
    "Final output: one upright continuous edge-to-edge scene, a single camera view, natural anatomy, and pure unlettered artwork.",
  ].filter(Boolean).join("\n");
  if (prompt.length > 20_000)
    throw new ValidationError("生成条件が長すぎます。");
  return {
    generation: {
      kind: "image" as const,
      jobType:
        generationTarget === "character"
          ? ("character_base" as const)
          : generationTarget === "effect"
            ? ("effect" as const)
            : ("background" as const),
      prompt,
      negativePrompt: [
        "文字、疑似文字、読めない文字、字幕、セリフ、吹き出し、看板、ロゴ、透かし、漫画ページ、複数コマ、コマ枠、余白、text, letters, pseudo-text, gibberish, typography, captions, speech balloons, signs, logos, watermarks, manga page, multiple panels, panel borders, gutters, 低品質、崩れた構図、別人、髪型の変化、衣装の無断変更",
        ...selectedVisualProfiles
          .map((profile) => profile.negative_prompt)
          .filter(Boolean),
        input.styleBible?.negative_prompt ?? "",
        ...selectedWorldProfiles
          .map((profile) => profile.negative_prompt)
          .filter(Boolean),
      ].join("、"),
      targetPanelId: canvasPanel.id,
      characterProfileVersions: selectedVisualProfiles.map((profile) => ({
        profileId: profile.id,
        version: profile.current_version,
      })),
      styleBibleVersion: input.styleBible
        ? {
            bibleId: input.styleBible.id,
            version: input.styleBible.current_version,
          }
        : undefined,
      worldProfileVersions: selectedWorldProfiles.map((profile) => ({
        profileId: profile.id,
        version: profile.current_version,
        kind: profile.kind,
      })),
      referenceAssetIds: Array.from(
        new Set([
          ...(input.revision ? [input.revision.sourceAssetId] : []),
          ...referenceAssetIds,
        ]),
      ).slice(0, 8),
      operation: input.revision?.maskAssetId
        ? ("inpainting" as const)
        : input.revision?.outpaintingDirection
          ? ("outpainting" as const)
          : input.revision
            ? ("image_to_image" as const)
            : ("text_to_image" as const),
      sourceAssetId: input.revision?.sourceAssetId,
      maskAssetId: input.revision?.maskAssetId,
      outpaintingDirection: input.revision?.outpaintingDirection,
      revisionPreset: input.revision?.preset,
      revisionInstruction: input.revision?.instruction,
      outputAlphaMode:
        generationTarget === "character" || generationTarget === "effect"
          ? ("remove_white" as const)
          : ("preserve" as const),
      ...imageSize(canvasPanel.width, canvasPanel.height),
    },
    panelId: canvasPanel.id,
    pageNumber: storyboardPage.pageNumber,
    panelNumber: storyboardPanel.index,
    candidateNumber: candidateIndex + 1,
    candidateCount,
    panelSpecification,
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
      "この作品ではAI画像を生成できません。AIシナリオからネームを採用し、そのネームから作成した本人の作品で実行してください。",
    );
}

import {
  moderateGeneralCloudPrompt,
  type CloudGenerationInput,
} from "@mangai/ai-core";

const GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向け作品として刺激の強い直接描写を避け、緊迫感は人物の表情、距離、構図、照明で間接的に伝える。";
const CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向けの穏やかな日常場面として、人物が整った環境で自然に立ち、表情と視線だけで物語の余韻を伝える。";
const GENERAL_AUDIENCE_RETRY_OUTPUT_QUALITY_GUIDANCE =
  "最終出力は正立した一つの場面として、顔・手指・関節を自然にし、必要な小物はそれぞれ一つだけ描く。手持ち端末は無地の背面または細い側面だけをカメラへ向け、表示面は人物の体側または画面外へ向ける。描画面は人物、背景、小物、光、影だけで構成した清潔な一枚絵として完成させる。";
const GENERAL_AUDIENCE_RETRY_OUTPUT_QUALITY_NEGATIVE_PROMPT =
  "文字、疑似文字、読めない文字、記号、字幕、セリフ、吹き出し、看板、ロゴ、透かし、端末画面のUI、text, letters, pseudo-text, gibberish, symbols, typography, captions, speech balloons, signs, logos, watermarks, device screen UI, 複数の同一小物、duplicate props";

const SAFE_ACTION =
  "登場人物は場面に合う自然な姿勢を取り、表情と視線で状況を伝える。";
const SAFE_EXPRESSION =
  "抑制された自然な表情と視線で物語上の緊張感を伝える。";
const SAFE_DIRECTION =
  "光と影、人物間の距離、視線誘導で物語上の緊張感を間接的に伝える。";
const CONSERVATIVE_SAFE_LOCATION =
  "明るく整った一般向けの日常環境を、簡潔な建物と自然な光で描く。";
const CONSERVATIVE_SAFE_COMPOSITION =
  "元のネームの画角、人数、人物と背景の相対配置を維持し、刺激の強い出来事そのものは描かず、直前または直後の安全な瞬間として構成する。";
const SAFE_STORYBOARD_COMPOSITION_FALLBACK =
  "人物と背景の相対配置、視線方向、前後関係を元のネームどおりに維持する";
const SAFE_PROVIDER_CLOSE_UP_SCENE =
  "one general-audience manga character in a roomy environmental portrait from one upright camera view, with the complete silhouette comfortably inside the canvas";
const SAFE_PROVIDER_CLOSE_UP_COMPOSITION =
  "roomy environmental portrait; subject occupies about 58% of canvas height; complete silhouette remains comfortably inside the canvas with generous headroom and environmental space on both sides";
const SAFE_PROVIDER_CLOSE_UP_POSITION =
  "centered with visible pictorial environment around the silhouette; top of hairstyle near 18% from the top edge, lower edge of visible clothing near 82% from the top edge, and broad environment along both side margins";
const SAFE_PROVIDER_CLOSE_UP_OUTPUT =
  "one continuous edge-to-edge monochrome manga illustration across the entire portrait canvas";
const SAFE_PROVIDER_CLOSE_UP_FRAMING = {
  subject_height_percent: 58,
  top_hair_y_percent: 18,
  lower_clothing_y_percent: 82,
  side_environment_percent: 18,
} as const;
const SAFE_PROVIDER_ACTION =
  "a calm natural pose that communicates the story moment through posture and gaze";
const SAFE_PROVIDER_EXPRESSION =
  "a restrained natural expression suitable for a general audience";
const SAFE_PROVIDER_BACKGROUND =
  "a simple non-graphic story-appropriate environment";
const SAFE_PROVIDER_VARIATION =
  "preserve identity and framing; convey tension indirectly through pose, gaze, spacing, light, and shadow";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeProviderControlContract(line: string) {
  try {
    const contract = JSON.parse(line) as Record<string, unknown>;
    const camera = isRecord(contract.camera) ? contract.camera : {};
    const { lens: _legacyLens, ...cameraWithoutLegacyLens } = camera;
    const compactSubjects = Array.isArray(contract.subjects)
      ? contract.subjects.map((subject) =>
          isRecord(subject)
            ? {
                ...subject,
                action: SAFE_PROVIDER_ACTION,
                expression: SAFE_PROVIDER_EXPRESSION,
                position: SAFE_PROVIDER_CLOSE_UP_POSITION,
              }
            : subject,
        )
      : contract.subjects;
    const compactCloseUp = Array.isArray(contract.subjects);
    const unsafeLegacyComposition =
      typeof contract.composition === "string" &&
      contract.composition.includes("both eyes, nose, mouth, chin");
    if (!compactCloseUp && !unsafeLegacyComposition) return line;
    const contractWithoutCloseUpFraming = { ...contract };
    delete contractWithoutCloseUpFraming.composition;
    delete contractWithoutCloseUpFraming.framing;
    return JSON.stringify({
      composition: SAFE_PROVIDER_CLOSE_UP_COMPOSITION,
      ...(compactCloseUp ? { framing: SAFE_PROVIDER_CLOSE_UP_FRAMING } : {}),
      ...contractWithoutCloseUpFraming,
      ...(compactCloseUp
        ? {
            scene: SAFE_PROVIDER_CLOSE_UP_SCENE,
            output_type: SAFE_PROVIDER_CLOSE_UP_OUTPUT,
            subjects: compactSubjects,
            background: SAFE_PROVIDER_BACKGROUND,
            variation: SAFE_PROVIDER_VARIATION,
            canvas:
              "one uninterrupted pictorial scene fills every edge of the portrait canvas",
            surface_content:
              "pure pictorial artwork made exclusively from character, clothing, environment, light, and shadow",
            face_finish:
              "natural facial anatomy and expression formed exclusively by clean linework and shading",
            surface_finish:
              "clean monochrome pictorial line art and natural material shading across every surface",
            quality_gate:
              "upright page, natural gravity, coherent face/hands/joints, each required prop exactly once, handheld devices show only a plain back or side edge, and pure pictorial marks throughout",
            camera: {
              ...cameraWithoutLegacyLens,
              distance:
                "roomy environmental portrait distance with the camera clearly pulled back",
              "lens-mm": 50,
              focus:
                "sharp identity and expression within the complete silhouette while preserving broad surrounding environment",
            },
          }
        : {}),
    });
  } catch {
    // Older prompts without a JSON provider contract keep their existing line.
  }
  return line;
}

function safeStoryboardComposition(value: unknown) {
  if (typeof value !== "string") return SAFE_STORYBOARD_COMPOSITION_FALLBACK;
  const normalized = value.trim().slice(0, 500);
  if (!normalized) return SAFE_STORYBOARD_COMPOSITION_FALLBACK;
  if (
    /(?:刺激の強い|直接描|燃え|炎|爆発|流血|遺体|殺|暴力|事件|事故|disturbing|incident|violence|blood|gore|weapon|fire|burn|explosion|assault|kill|dead)/i.test(
      normalized,
    )
  )
    return SAFE_STORYBOARD_COMPOSITION_FALLBACK;
  return moderateGeneralCloudPrompt(normalized).decision === "allow"
    ? normalized
    : SAFE_STORYBOARD_COMPOSITION_FALLBACK;
}

function conservativelySanitizeProviderControlContract(line: string) {
  try {
    const contract = JSON.parse(line) as Record<string, unknown>;
    const camera = isRecord(contract.camera) ? contract.camera : {};
    const { lens: _legacyLens, ...cameraWithoutLegacyLens } = camera;
    const storyboardComposition = safeStoryboardComposition(
      contract.layout,
    );
    const subjects = Array.isArray(contract.subjects)
      ? contract.subjects.map((subject) =>
          isRecord(subject)
            ? {
                ...subject,
                action: SAFE_PROVIDER_ACTION,
                expression: SAFE_PROVIDER_EXPRESSION,
                position: SAFE_PROVIDER_CLOSE_UP_POSITION,
              }
            : subject,
        )
      : contract.subjects;
    return JSON.stringify({
      ...contract,
      composition: `${storyboardComposition}; keep all relevant subjects comfortably inside the canvas with clear headroom and story-appropriate environmental space`,
      ...(Array.isArray(contract.subjects)
        ? { framing: SAFE_PROVIDER_CLOSE_UP_FRAMING }
        : {}),
      layout: storyboardComposition,
      scene:
        "one calm general-audience manga moment in a tidy everyday environment from one upright camera view",
      output_type: SAFE_PROVIDER_CLOSE_UP_OUTPUT,
      ...(subjects ? { subjects } : {}),
      background:
        "a tidy well-lit everyday environment with simple architecture and no depicted incident",
      variation:
        "preserve character identity, clothing, storyboard shot, subject count, and safe relative placement; communicate the original narrative beat through pose, gaze, spacing, light, and shadow",
      canvas:
        "one uninterrupted pictorial scene fills every edge of the portrait canvas",
      surface_content:
        "pure pictorial artwork made exclusively from character, clothing, environment, light, and shadow",
      face_finish:
        "natural facial anatomy and expression formed exclusively by clean linework and shading",
      surface_finish:
        "clean monochrome pictorial line art and natural material shading across every surface",
      quality_gate:
        "upright page, natural gravity, coherent face/hands/joints, each required everyday prop exactly once, handheld devices show only a plain back or side edge, and pure pictorial marks throughout",
      camera: {
        ...cameraWithoutLegacyLens,
        distance:
          "roomy environmental portrait distance with the camera clearly pulled back",
        "lens-mm": 50,
        focus:
          "sharp identity and expression within the complete silhouette while preserving broad surrounding environment",
      },
    });
  } catch {
    // Older prompts without a JSON provider contract keep their existing line.
  }
  return line;
}

export function isGeneralAudienceGenerationRetry(
  generation: CloudGenerationInput,
) {
  return (
    generation.kind === "image" &&
    generation.prompt.includes(GENERAL_AUDIENCE_RETRY_GUIDANCE)
  );
}

export function isConservativeGeneralAudienceGenerationRetry(
  generation: CloudGenerationInput,
) {
  return (
    generation.kind === "image" &&
    generation.prompt.includes(CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE)
  );
}

export function buildGeneralAudienceGenerationRetry(
  generation: CloudGenerationInput,
): CloudGenerationInput {
  if (generation.kind !== "image" || isGeneralAudienceGenerationRetry(generation))
    return generation;

  const promptLines = generation.prompt.split(/\r?\n/).map((line, index, lines) => {
    if (lines[index - 1] === "PROVIDER CONTROL CONTRACT:")
      return sanitizeProviderControlContract(line);
    if (line.startsWith("この瞬間の動作:"))
      return `この瞬間の動作: ${SAFE_ACTION}`;
    if (line.startsWith("動作:")) return `動作: ${SAFE_ACTION}`;
    if (line.startsWith("表情・感情:"))
      return `表情・感情: ${SAFE_EXPRESSION}`;
    if (line.startsWith("感情:")) return `感情: ${SAFE_EXPRESSION}`;
    if (line.startsWith("演出:")) return `演出: ${SAFE_DIRECTION}`;
    if (line.startsWith("追加指定:"))
      return "追加指定: 一般向けの間接表現として安全に再構成する。";
    return line;
  });
  const prompt = [
    `${GENERAL_AUDIENCE_RETRY_GUIDANCE} ${GENERAL_AUDIENCE_RETRY_OUTPUT_QUALITY_GUIDANCE}`,
    ...promptLines,
  ]
    .join("\n")
    .slice(0, 20_000)
    .trim();
  const negativePrompt = [
    GENERAL_AUDIENCE_RETRY_OUTPUT_QUALITY_NEGATIVE_PROMPT,
    generation.negativePrompt.trim(),
  ]
    .filter(Boolean)
    .join("、")
    .slice(0, 10_000);

  return { ...generation, prompt, negativePrompt };
}

export function buildConservativeGeneralAudienceGenerationRetry(
  generation: CloudGenerationInput,
): CloudGenerationInput {
  if (
    generation.kind !== "image" ||
    !isGeneralAudienceGenerationRetry(generation) ||
    isConservativeGeneralAudienceGenerationRetry(generation)
  )
    return generation;

  const promptLines = generation.prompt.split(/\r?\n/).map((line, index, lines) => {
    if (lines[index - 1] === "PROVIDER CONTROL CONTRACT:")
      return conservativelySanitizeProviderControlContract(line);
    if (line.startsWith("この瞬間の動作:"))
      return `この瞬間の動作: ${SAFE_ACTION}`;
    if (line.startsWith("動作:")) return `動作: ${SAFE_ACTION}`;
    if (line.startsWith("表情・感情:"))
      return `表情・感情: ${SAFE_EXPRESSION}`;
    if (line.startsWith("感情:")) return `感情: ${SAFE_EXPRESSION}`;
    if (line.startsWith("場所:") || line.startsWith("背景:"))
      return `場所・背景: ${CONSERVATIVE_SAFE_LOCATION}`;
    if (
      line.startsWith("人物と背景の配置:") ||
      line.startsWith("構図:") ||
      line.startsWith("演出:") ||
      line.startsWith("構図調整:")
    )
      return `構図・演出: ${CONSERVATIVE_SAFE_COMPOSITION}`;
    if (line.startsWith("追加指定:") || line.startsWith("修正指示:"))
      return "追加指定: 穏やかな一般向け場面として自然に整える。";
    return line;
  });
  const prompt = [
    CONSERVATIVE_GENERAL_AUDIENCE_RETRY_GUIDANCE,
    GENERAL_AUDIENCE_RETRY_OUTPUT_QUALITY_GUIDANCE,
    ...promptLines,
  ]
    .join("\n")
    .slice(0, 20_000)
    .trim();

  return { ...generation, prompt };
}

import type { CloudGenerationInput } from "@mangai/ai-core";

const GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向け作品として刺激の強い直接描写を避け、緊迫感は人物の表情、距離、構図、照明で間接的に伝える。";

const SAFE_ACTION =
  "登場人物は場面に合う自然な姿勢を取り、表情と視線で状況を伝える。";
const SAFE_EXPRESSION =
  "抑制された自然な表情と視線で物語上の緊張感を伝える。";
const SAFE_DIRECTION =
  "光と影、人物間の距離、視線誘導で物語上の緊張感を間接的に伝える。";
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

export function isGeneralAudienceGenerationRetry(
  generation: CloudGenerationInput,
) {
  return (
    generation.kind === "image" &&
    generation.prompt.includes(GENERAL_AUDIENCE_RETRY_GUIDANCE)
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
  const prompt = [GENERAL_AUDIENCE_RETRY_GUIDANCE, ...promptLines]
    .join("\n")
    .slice(0, 20_000)
    .trim();

  return { ...generation, prompt };
}

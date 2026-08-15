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
  "one general-audience manga character in a medium portrait from one upright camera view, with the complete hairstyle and clothing silhouette visible";
const SAFE_PROVIDER_CLOSE_UP_COMPOSITION =
  "medium portrait; subject occupies about 72% of canvas height; complete hairstyle and clothing silhouette remain inside the canvas; clear headroom and environmental space on both sides";
const SAFE_PROVIDER_CLOSE_UP_POSITION =
  "centered in the portrait canvas; top of hair near 15% from the top edge, lower edge of the visible jacket near 92% from the top edge, and clear environment along both side margins";
const SAFE_PROVIDER_CLOSE_UP_OUTPUT =
  "one continuous edge-to-edge monochrome manga illustration across the entire portrait canvas";
const SAFE_PROVIDER_CLOSE_UP_FRAMING = {
  subject_height_percent: 72,
  top_hair_y_percent: 15,
  lower_jacket_y_percent: 92,
  side_environment_percent: 12,
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
    return JSON.stringify({
      ...contract,
      composition: SAFE_PROVIDER_CLOSE_UP_COMPOSITION,
      ...(compactCloseUp
        ? {
            scene: SAFE_PROVIDER_CLOSE_UP_SCENE,
            output_type: SAFE_PROVIDER_CLOSE_UP_OUTPUT,
            subjects: compactSubjects,
            background: SAFE_PROVIDER_BACKGROUND,
            variation: SAFE_PROVIDER_VARIATION,
            framing: SAFE_PROVIDER_CLOSE_UP_FRAMING,
            canvas:
              "one uninterrupted pictorial scene fills every edge of the portrait canvas",
            camera: {
              ...cameraWithoutLegacyLens,
              distance: "medium portrait distance with the camera pulled back",
              "lens-mm": 50,
              focus:
                "sharp focus on identity, expression, and the complete clothing silhouette while retaining visible surrounding environment",
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

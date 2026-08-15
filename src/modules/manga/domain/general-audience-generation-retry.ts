import type { CloudGenerationInput } from "@mangai/ai-core";

const GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向け作品として刺激の強い直接描写を避け、緊迫感は人物の表情、距離、構図、照明で間接的に伝える。";

const SAFE_ACTION =
  "登場人物は場面に合う自然な姿勢を取り、表情と視線で状況を伝える。";
const SAFE_EXPRESSION =
  "抑制された自然な表情と視線で物語上の緊張感を伝える。";
const SAFE_DIRECTION =
  "光と影、人物間の距離、視線誘導で物語上の緊張感を間接的に伝える。";

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

  const promptLines = generation.prompt.split(/\r?\n/).map((line) => {
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

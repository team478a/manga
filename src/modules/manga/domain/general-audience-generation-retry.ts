import type { CloudGenerationInput } from "@mangai/ai-core";

const GENERAL_AUDIENCE_RETRY_GUIDANCE =
  "一般向け作品として刺激の強い直接描写を避け、緊迫感は人物の表情、距離、構図、照明で間接的に伝える。";

const SAFE_ACTION =
  "動作: 登場人物は場面に合う自然な姿勢を取り、表情と視線で状況を伝える。";
const SAFE_DIRECTION =
  "演出: 光と影、人物間の距離、視線誘導で物語上の緊張感を間接的に伝える。";

export function buildGeneralAudienceGenerationRetry(
  generation: CloudGenerationInput,
): CloudGenerationInput {
  if (
    generation.kind !== "image" ||
    generation.prompt.includes(GENERAL_AUDIENCE_RETRY_GUIDANCE)
  )
    return generation;

  const visualPromptLines = generation.prompt
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("人物設定:"))
    .map((line) => {
      if (line.startsWith("動作:")) return SAFE_ACTION;
      if (line.startsWith("演出:")) return SAFE_DIRECTION;
      return line;
    });
  const prompt = [GENERAL_AUDIENCE_RETRY_GUIDANCE, ...visualPromptLines]
    .join("\n")
    .slice(0, 20_000)
    .trim();

  return { ...generation, prompt };
}

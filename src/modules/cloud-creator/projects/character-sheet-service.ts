import {
  cloudStoryScenarioResultSchema,
  type CloudStoryScenarioResult,
} from "@/lib/cloud-scenario";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";

export type CloudCharacterSheetEntry =
  CloudStoryScenarioResult["characters"][number];

export async function getCloudProjectCharacterSheet(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const materialization = await supabase
    .from("cloud_story_storyboard_projects")
    .select("storyboard_version_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (materialization.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "キャラクター設定を読み込めませんでした。",
      { cause: materialization.error },
    );
  if (!materialization.data) return [] as CloudCharacterSheetEntry[];

  const storyboard = await supabase
    .from("cloud_story_storyboard_versions")
    .select("scenario_version_id")
    .eq("id", materialization.data.storyboard_version_id)
    .maybeSingle();
  if (storyboard.error || !storyboard.data)
    throw new DomainError(
      "INTERNAL_ERROR",
      "キャラクター設定を読み込めませんでした。",
      { cause: storyboard.error },
    );

  const scenario = await supabase
    .from("cloud_story_scenario_versions")
    .select("result")
    .eq("id", storyboard.data.scenario_version_id)
    .maybeSingle();
  if (scenario.error || !scenario.data)
    throw new DomainError(
      "INTERNAL_ERROR",
      "キャラクター設定を読み込めませんでした。",
      { cause: scenario.error },
    );
  const parsed = cloudStoryScenarioResultSchema.safeParse(scenario.data.result);
  if (!parsed.success) return [] as CloudCharacterSheetEntry[];
  return parsed.data.characters;
}

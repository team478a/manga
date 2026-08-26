export const featureFlagDefinitions = {
  CLOUD_ADULT_PLANNING_ENABLED: "case-insensitive",
  CLOUD_ADULT_RESEARCH_ENABLED: "case-insensitive",
  CLOUD_GENERAL_MONITOR_BETA_ENABLED: "case-insensitive",
  CLOUD_PANEL_IMAGE_GENERATION_ENABLED: "case-insensitive",
  CLOUD_PANEL_INPAINTING_ENABLED: "strict",
  CLOUD_PANEL_OUTPAINTING_ENABLED: "strict",
  CLOUD_PANEL_DESIGN_GENERATION_ENABLED: "strict",
  CLOUD_PROPOSAL_GENERATION_ENABLED: "case-insensitive",
  CLOUD_RESEARCH_MVP_ENABLED: "case-insensitive",
  CLOUD_RESEARCH_SEARCH_ENABLED: "case-insensitive",
  CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED: "case-insensitive",
  CLOUD_GENERATION_RESUMABLE_V2_ENABLED: "strict",
  CLOUD_SCENARIO_GENERATION_ENABLED: "case-insensitive",
  CLOUD_STORYBOARD_CANVAS_ENABLED: "case-insensitive",
  CLOUD_STORYBOARD_GENERATION_ENABLED: "case-insensitive",
  MANGAI_CLOUD_AI_MOCK_ENABLED: "strict",
  MANGAI_CLOUD_AI_WORKER_ENABLED: "strict",
  MANGAI_CLOUD_EXPORT_WORKER_ENABLED: "strict",
  MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED: "strict",
  MANGAI_CLOUD_IMAGE_ENABLED: "strict",
  MANGAI_CLOUD_STORAGE_WORKER_ENABLED: "strict",
  MANGAI_CLOUD_TEXT_ENABLED: "strict",
  MANGAI_ENABLE_LEGACY_LOCAL_TOOLS: "strict",
  MANGAI_MONITOR_OPS_WORKER_ENABLED: "strict",
  MANGAI_MONITOR_QUALITY_REVIEW_ENABLED: "strict",
} as const;

export type FeatureFlagName = keyof typeof featureFlagDefinitions;
type FeatureFlagEnvironment = Readonly<Record<string, string | undefined>>;

export function featureFlagEnabled(
  name: FeatureFlagName,
  env: FeatureFlagEnvironment = process.env,
) {
  const value = env[name];
  return featureFlagDefinitions[name] === "case-insensitive"
    ? value?.toLowerCase() === "true"
    : value === "true";
}


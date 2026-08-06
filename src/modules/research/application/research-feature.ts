import { featureFlagEnabled } from "../../../lib/feature-flags.ts";

export const cloudResearchFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_RESEARCH_MVP_ENABLED");

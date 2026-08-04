export const cloudResearchFeatureEnabled = () =>
  process.env.CLOUD_RESEARCH_MVP_ENABLED?.toLowerCase() === "true";

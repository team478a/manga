const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CLOUD_RESEARCH_MVP_ENABLED",
  "CLOUD_PROPOSAL_GENERATION_ENABLED",
  "CLOUD_ADULT_RESEARCH_ENABLED",
  "CLOUD_ADULT_AI_PLANNING_ENABLED",
];

let failed = false;
for (const key of required) {
  const configured = Boolean(process.env[key]?.trim());
  console.log(`${configured ? "OK" : "MISSING"} ${key}`);
  failed ||= !configured;
}
console.log("INFO OpenAI API key is managed by the existing Supabase Vault admin setting.");
if (failed) process.exitCode = 1;

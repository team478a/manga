import { createClient } from "@supabase/supabase-js";

export const REQUIRED_ACCEPTANCE_ENV = [
  "MANGAI_DB_ENV",
  "MANGAI_OWNER_TEST_SUPABASE_URL",
  "MANGAI_OWNER_TEST_SUPABASE_ANON_KEY",
  "MANGAI_OWNER_TEST_USER_A_EMAIL",
  "MANGAI_OWNER_TEST_USER_A_PASSWORD",
  "MANGAI_OWNER_TEST_USER_B_EMAIL",
  "MANGAI_OWNER_TEST_USER_B_PASSWORD",
  "MANGAI_OWNER_TEST_CONFIRM",
];

const expectedConfirmation = "READ_ONLY_STAGING";

export function validateAcceptanceEnvironment(environment = process.env) {
  const missing = REQUIRED_ACCEPTANCE_ENV.filter(
    (name) => typeof environment[name] !== "string" || environment[name].trim() === "",
  );
  const errors = [];
  if (missing.length > 0) errors.push(`missing:${missing.join(",")}`);
  if (environment.MANGAI_DB_ENV !== "staging") errors.push("target:not-staging");
  if (environment.MANGAI_OWNER_TEST_CONFIRM !== expectedConfirmation)
    errors.push("confirmation:missing");
  try {
    const url = new URL(environment.MANGAI_OWNER_TEST_SUPABASE_URL ?? "");
    if (url.protocol !== "https:") errors.push("supabase-url:not-https");
  } catch {
    errors.push("supabase-url:invalid");
  }
  return { passed: errors.length === 0, missing, errors };
}

export function evaluateReadIsolation(resources) {
  return resources.map((resource) => ({
    ...resource,
    passed: resource.ownerCount === 1 && resource.outsiderCount === 0,
  }));
}

function clientFor(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function signIn(client, email, password) {
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user) throw new Error("acceptance-user-authentication-failed");
  return result.data.user;
}

async function profileIdFor(client, userId) {
  const result = await client.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  if (result.error || !result.data?.id) throw new Error("acceptance-profile-not-found");
  return result.data.id;
}

async function exactlyOne(client, table, column, value) {
  const result = await client.from(table).select("id", { count: "exact" }).eq(column, value).limit(2);
  if (result.error) throw new Error(`acceptance-query-failed:${table}`);
  return result.data?.length ?? 0;
}

async function latestId(client, table, filters) {
  let query = client.from(table).select("id");
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const result = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error(`acceptance-query-failed:${table}`);
  return result.data?.id ?? null;
}

async function visibilityPair(owner, outsider, table, id) {
  return {
    resource: table,
    ownerCount: await exactlyOne(owner, table, "id", id),
    outsiderCount: await exactlyOne(outsider, table, "id", id),
  };
}

export async function runReadOnlyOwnerIsolation(environment = process.env) {
  const validation = validateAcceptanceEnvironment(environment);
  if (!validation.passed) return { passed: false, stage: "preflight", validation, checks: [] };

  const url = environment.MANGAI_OWNER_TEST_SUPABASE_URL;
  const anonKey = environment.MANGAI_OWNER_TEST_SUPABASE_ANON_KEY;
  const owner = clientFor(url, anonKey);
  const outsider = clientFor(url, anonKey);
  try {
    const ownerUser = await signIn(
      owner,
      environment.MANGAI_OWNER_TEST_USER_A_EMAIL,
      environment.MANGAI_OWNER_TEST_USER_A_PASSWORD,
    );
    const outsiderUser = await signIn(
      outsider,
      environment.MANGAI_OWNER_TEST_USER_B_EMAIL,
      environment.MANGAI_OWNER_TEST_USER_B_PASSWORD,
    );
    if (ownerUser.id === outsiderUser.id) throw new Error("acceptance-users-must-be-distinct");

    const ownerProfileId = await profileIdFor(owner, ownerUser.id);
    await profileIdFor(outsider, outsiderUser.id);
    const projectId = await latestId(owner, "cloud_projects", {
      owner_profile_id: ownerProfileId,
      content_class: "general",
    });
    if (!projectId) throw new Error("acceptance-owner-project-required");

    const artifacts = [
      ["cloud_projects", projectId],
      ["cloud_generation_jobs", await latestId(owner, "cloud_generation_jobs", { project_id: projectId })],
      ["cloud_export_jobs", await latestId(owner, "cloud_export_jobs", { project_id: projectId })],
      [
        "cloud_general_monitor_feedback",
        await latestId(owner, "cloud_general_monitor_feedback", { project_id: projectId }),
      ],
    ];
    const missingArtifacts = artifacts.filter(([, id]) => !id).map(([table]) => table);
    if (missingArtifacts.length > 0)
      throw new Error(`acceptance-artifacts-required:${missingArtifacts.join(",")}`);

    const rawChecks = [];
    for (const [table, id] of artifacts) rawChecks.push(await visibilityPair(owner, outsider, table, id));
    const checks = evaluateReadIsolation(rawChecks);
    return { passed: checks.every((check) => check.passed), stage: "read-isolation", checks };
  } finally {
    await Promise.allSettled([owner.auth.signOut(), outsider.auth.signOut()]);
  }
}

async function main() {
  const preflightOnly = process.argv.includes("--preflight");
  const validation = validateAcceptanceEnvironment(process.env);
  console.log("MANGAI Cloud owner isolation staging acceptance");
  for (const name of REQUIRED_ACCEPTANCE_ENV)
    console.log(`${validation.missing.includes(name) ? "MISSING" : "CONFIGURED"} ${name}`);
  if (!validation.passed) {
    console.error("Owner isolation staging acceptance: PREFLIGHT FAILED");
    process.exitCode = 1;
    return;
  }
  if (preflightOnly) {
    console.log("Owner isolation staging acceptance: PREFLIGHT PASS");
    return;
  }
  try {
    const report = await runReadOnlyOwnerIsolation(process.env);
    for (const check of report.checks)
      console.log(
        check.passed
          ? `PASS ${check.resource}: owner=visible outsider=hidden`
          : `FAIL ${check.resource}: visibility-mismatch`,
      );
    console.log(report.passed ? "Owner isolation staging acceptance: PASS" : "Owner isolation staging acceptance: FAIL");
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "acceptance-failed";
    console.error(`Owner isolation staging acceptance: FAILED (${message})`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href)
  await main();

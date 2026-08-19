import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const contracts = [
  {
    name: "private project edit boundary",
    file: "supabase/migrations/202607180002_cloud_creator_foundation.sql",
    patterns: [
      /create or replace function public\.cloud_project_can_edit/,
      /project\.owner_profile_id = public\.current_profile_id\(\)/,
      /collaborator\.status = 'accepted'/,
      /collaborator\.role = 'editor'/,
    ],
  },
  {
    name: "generation job project boundary",
    file: "supabase/migrations/202607180004_cloud_ai_queue.sql",
    patterns: [
      /create policy "cloud_generation_jobs_read"[\s\S]*public\.cloud_project_can_edit\(project_id\)/,
      /enqueue_cloud_generation_job[\s\S]*not public\.cloud_project_can_edit\(p_project_id\)/,
      /cancel_cloud_generation_job[\s\S]*public\.cloud_project_can_edit\(project_id\)/,
    ],
  },
  {
    name: "durable export owner boundary",
    file: "supabase/migrations/202608010006_cloud_durable_export.sql",
    patterns: [
      /cloud_export_jobs_owner_read[\s\S]*created_by_profile_id=public\.current_profile_id\(\)/,
      /set_cloud_export_job_state[\s\S]*created_by_profile_id=public\.current_profile_id\(\)/,
    ],
  },
  {
    name: "quality feedback owner boundary",
    file: "supabase/migrations/202608020002_cloud_general_monitor_quality_feedback.sql",
    patterns: [
      /owner_profile_id=public\.current_profile_id\(\)/,
      /public\.cloud_project_can_edit\(project_id\)/,
    ],
  },
  {
    name: "signed export URL defense in depth",
    file: "src/modules/cloud-creator/export/durable-export-service.ts",
    patterns: [
      /createCloudExportDownloadUrl[\s\S]*cloudCreatorContext\(\)/,
      /\.eq\("id", jobId\)[\s\S]*\.eq\("created_by_profile_id", profile\.id\)[\s\S]*\.maybeSingle\(\)/,
      /createAdminClient\(\)[\s\S]*createSignedUrl/,
    ],
  },
  {
    name: "route UUID rejection",
    file: "src/app/api/creator/exports/[jobId]/download/route.ts",
    patterns: [/z\.string\(\)\.uuid\(\)\.parse/],
  },
  {
    name: "quality feedback trusted ownership",
    file: "src/app/api/creator/quality-feedback/route.ts",
    patterns: [
      /requireProfile\(\)/,
      /getCloudPageSnapshot\(input\.pageId\)/,
      /snapshot\.project_id !== input\.projectId/,
      /saveMonitorQualityFeedback\(\{[\s\S]*ownerProfileId: profile\.id/,
    ],
  },
  {
    name: "quality feedback trusted persistence",
    file: "src/modules/general-monitor/infrastructure/quality-feedback-repository.ts",
    patterns: [
      /createAdminClient\(\)/,
      /owner_profile_id: input\.ownerProfileId/,
      /if \(structuredError && !isMissingMonitorFeedbackSchema\(structuredError\)\)/,
      /if \(error\) throw error/,
    ],
  },
];

export function checkCloudOwnerIsolation({ root = process.cwd() } = {}) {
  const checks = contracts.map((contract) => {
    const absolute = path.join(root, contract.file);
    if (!fs.existsSync(absolute)) {
      return { name: contract.name, file: contract.file, passed: false };
    }
    const source = fs.readFileSync(absolute, "utf8");
    return {
      name: contract.name,
      file: contract.file,
      passed: contract.patterns.every((pattern) => pattern.test(source)),
    };
  });
  return { passed: checks.every((check) => check.passed), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = checkCloudOwnerIsolation();
  console.log("MANGAI Cloud owner isolation repository check");
  for (const check of report.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name} (${check.file})`);
  }
  console.log(report.passed ? "Owner isolation repository check: PASS" : "Owner isolation repository check: FAIL");
  if (!report.passed) process.exitCode = 1;
}

import { pathToFileURL } from "node:url";
import { checkCloudRelease1Environment } from "./check-cloud-release1-preflight.mjs";

const PASS = "PASS";
const FAIL = "FAIL";
const INFO = "INFO";

function release2FlagEnabled(env) {
  return String(env.CLOUD_PROPOSAL_GENERATION_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";
}

export function checkCloudRelease2Environment(env = process.env) {
  const release1 = checkCloudRelease1Environment(env);
  const proposalEnabled = release2FlagEnabled(env);
  const checks = [
    ...release1.checks.filter(
      (check) => check.name !== "CLOUD_PROPOSAL_GENERATION_ENABLED",
    ),
    {
      name: "CLOUD_PROPOSAL_GENERATION_ENABLED",
      status: proposalEnabled ? PASS : FAIL,
      message: proposalEnabled
        ? "限定公開対象で有効です。"
        : "Release 2限定公開時はtrueが必要です。",
    },
    {
      name: "OPENAI_RUNTIME_CONFIG",
      status: INFO,
      message:
        "APIキーとmodelは環境変数ではなく、管理画面とSupabase Vaultで確認してください。",
    },
    {
      name: "CLOUD_STORY_PROPOSAL_MIGRATION",
      status: INFO,
      message:
        "202607300002_cloud_story_proposals.sqlの適用状態を対象DBで確認してください。",
    },
  ];
  return {
    passed:
      release1.passed &&
      proposalEnabled &&
      checks.every((check) => check.status !== FAIL),
    checks,
  };
}

function printReport(report) {
  for (const check of report.checks)
    console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(
    report.passed
      ? "Release 2 environment preflight: PASS"
      : "Release 2 environment preflight: FAIL",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = checkCloudRelease2Environment();
  printReport(report);
  if (!report.passed) process.exitCode = 1;
}

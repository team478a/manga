import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkCloudGeneralMonitorBetaEnvironment } from "./check-cloud-general-monitor-beta-preflight.mjs";
import { checkCloudOwnerIsolation } from "./check-cloud-owner-isolation.mjs";

const requiredArtifacts = [
  "supabase/migrations/202607180004_cloud_ai_queue.sql",
  "supabase/migrations/202607180005_cloud_ai_billing.sql",
  "supabase/migrations/202607310004_cloud_general_image_provider.sql",
  "supabase/migrations/202608010004_cloud_batch_production.sql",
  "supabase/migrations/202608010006_cloud_durable_export.sql",
  "src/app/api/internal/cloud-ai/worker/route.ts",
  "src/app/api/creator/generation-jobs/route.ts",
  "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
  "src/app/creator/[projectId]/pages/[pageId]/PanelImageComparisonDialog.tsx",
  "src/lib/cloud-canvas-export.ts",
  "tests/cloud-eight-page-export.test.mjs",
  "tests/cloud-manuscript-preflight.test.mjs",
];

const responsiveSources = [
  "src/app/creator/page.tsx",
  "src/app/creator/[projectId]/page.tsx",
  "src/app/creator/[projectId]/LongformPageManager.tsx",
  "src/app/creator/[projectId]/pages/[pageId]/page.tsx",
  "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
  "src/app/creator/[projectId]/pages/[pageId]/PanelImageComparisonDialog.tsx",
  "src/app/creator/[projectId]/pages/[pageId]/PanelInpaintingDialog.tsx",
];

// max-widthは表示領域を押し広げないため許可し、width/min-widthだけを拒否する。
const widerThanMobile = /(?:min-w|(?<!max-)w)-\[(?:39[1-9]|[4-9]\d{2,}|\d{4,})px\]/;

export function checkCloudMangaAcceptance({
  env = process.env,
  root = process.cwd(),
  repositoryOnly = false,
} = {}) {
  const artifacts = requiredArtifacts.map((relativePath) => ({
    path: relativePath,
    ready: fs.existsSync(path.join(root, relativePath)),
  }));
  const responsive = responsiveSources.map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return { path: relativePath, ready: false };
    const source = fs.readFileSync(absolutePath, "utf8");
    return { path: relativePath, ready: !widerThanMobile.test(source) };
  });
  const environment = checkCloudGeneralMonitorBetaEnvironment(env);
  const ownerIsolation = checkCloudOwnerIsolation({ root });
  const repositoryPassed =
    artifacts.every((item) => item.ready) &&
    responsive.every((item) => item.ready) &&
    ownerIsolation.passed;

  return {
    passed: repositoryPassed && (repositoryOnly || environment.passed),
    repositoryPassed,
    environmentPassed: environment.passed,
    artifacts,
    responsive,
    ownerIsolation,
    manual: [
      "実Providerで1コマだけ生成する",
      "候補比較・採用・再生成・復元を確認する",
      "8ページを編集・保存してPDF／PNGを目視比較する",
      "実ブラウザの390px・768px・1280pxで操作する",
      "ステージングの2つの一般ユーザーで、非公開作品・Job・出力を相互参照できないことを最終確認する",
    ],
  };
}

function printReport(report, repositoryOnly) {
  console.log("MANGAI Cloud manga acceptance preflight");
  for (const item of report.artifacts)
    console.log(`${item.ready ? "PASS" : "FAIL"} artifact ${item.path}`);
  for (const item of report.responsive)
    console.log(`${item.ready ? "PASS" : "FAIL"} responsive-structure ${item.path}`);
  for (const item of report.ownerIsolation.checks)
    console.log(`${item.passed ? "PASS" : "FAIL"} owner-isolation ${item.name}`);
  console.log(
    `${report.environmentPassed ? "PASS" : repositoryOnly ? "INFO" : "FAIL"} environment configuration`,
  );
  console.log("INFO Credential values are never printed.");
  for (const item of report.manual) console.log(`MANUAL ${item}`);
  console.log(report.passed ? "Cloud manga acceptance preflight: PASS" : "Cloud manga acceptance preflight: FAIL");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repositoryOnly = process.argv.includes("--repository-only");
  const report = checkCloudMangaAcceptance({ repositoryOnly });
  printReport(report, repositoryOnly);
  if (!report.passed) process.exitCode = 1;
}

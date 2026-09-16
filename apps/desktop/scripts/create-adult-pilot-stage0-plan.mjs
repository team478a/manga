import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultDesktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const candidateIdPattern = /^candidate-[0-9a-f]{12}$/;
const maxRetentionMs = 14 * 24 * 60 * 60 * 1000;

const parseIsoTimestamp = (value, label) => {
  const parsed = new Date(value ?? "");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new Error(`${label}はUTCのISO日時で指定してください。`);
  return parsed;
};

const isInside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export const createStage0Plan = ({
  desktopRoot = defaultDesktopRoot,
  candidateId,
  scheduledStartAt,
  deleteBy,
  outputPath,
  assistedSessionConfirmed = false,
  stopContactConfirmed = false,
  evidenceTransferConfirmed = false,
  now = new Date(),
}) => {
  if (!candidateIdPattern.test(candidateId ?? ""))
    throw new Error(
      "candidate IDはcandidate-に続く12桁の小文字16進数で指定してください。",
    );
  if (!path.isAbsolute(outputPath ?? "") || outputPath.startsWith("\\\\"))
    throw new Error(
      "計画出力先はローカルドライブ上の絶対pathで指定してください。",
    );
  if (isInside(desktopRoot, outputPath))
    throw new Error("計画はGit管理外のアクセス制限領域へ出力してください。");
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error("現在日時が不正です。");

  const scheduledStart = parseIsoTimestamp(scheduledStartAt, "実施日時");
  const deletionDeadline = parseIsoTimestamp(deleteBy, "削除期限");
  if (scheduledStart.getTime() < now.getTime())
    throw new Error("実施日時は現在以降を指定してください。");
  const retentionMs = deletionDeadline.getTime() - scheduledStart.getTime();
  if (retentionMs <= 0 || retentionMs > maxRetentionMs)
    throw new Error("削除期限は実施日時より後、14日以内を指定してください。");
  if (
    assistedSessionConfirmed !== true ||
    stopContactConfirmed !== true ||
    evidenceTransferConfirmed !== true
  )
    throw new Error("支援、停止連絡、証跡回収の3項目を明示確認してください。");

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  if (
    typeof packageJson.version !== "string" ||
    packageJson.version.length === 0
  )
    throw new Error("Desktop versionを取得できませんでした。");

  const plan = {
    format: "mangai.desktop-adult-stage0-plan",
    version: 1,
    candidateId,
    artifactVersion: packageJson.version,
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt,
    deleteBy,
    assistedSessionConfirmed: true,
    stopContactConfirmed: true,
    evidenceTransferConfirmed: true,
    artifactSeparatedFromStage1: true,
    stage1DistributionAuthorized: false,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return plan;
};

const valueAfter = (args, name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = process.argv.slice(2);
    const plan = createStage0Plan({
      candidateId: valueAfter(args, "--candidate-id"),
      scheduledStartAt: valueAfter(args, "--scheduled-start"),
      deleteBy: valueAfter(args, "--delete-by"),
      outputPath: valueAfter(args, "--out"),
      assistedSessionConfirmed: args.includes("--confirm-assisted-session"),
      stopContactConfirmed: args.includes("--confirm-stop-contact"),
      evidenceTransferConfirmed: args.includes("--confirm-evidence-transfer"),
    });
    console.log("MANGAI Desktop Adult Stage 0 plan");
    console.log(`  Version: ${plan.artifactVersion}`);
    console.log("  Assisted session: confirmed");
    console.log("  Stop contact: confirmed");
    console.log("  Evidence transfer: confirmed");
    console.log("  Candidate identity and output path: hidden");
    console.log("  Stage 1 distribution authorized: no");
    console.log("  Result: CREATED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "計画fileの操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 plan creation failed: ${message}`);
    process.exit(1);
  }
}

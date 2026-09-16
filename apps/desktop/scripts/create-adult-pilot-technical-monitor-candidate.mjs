import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const choices = {
  windows: new Set(["windows_11", "other"]),
  gpuVendor: new Set(["nvidia", "other"]),
  vramBand: new Set(["under_12gb", "12gb", "16gb_or_more"]),
  ramBand: new Set(["under_16gb", "16_to_31gb", "32gb_or_more"]),
  freeDiskBand: new Set(["under_40gb", "40_to_49gb", "50gb_or_more"]),
};

const isInside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const requireChoice = (value, allowed, label) => {
  if (!allowed.has(value))
    throw new Error(`${label}は定義済みの選択肢から指定してください。`);
  return value;
};

export const createTechnicalMonitorCandidate = ({
  repositoryRoot = defaultRepositoryRoot,
  outputPath,
  windows,
  gpuVendor,
  vramBand,
  ramBand,
  freeDiskBand,
  assistedFirstRun = false,
  observation24Hours = false,
  age18OrOlder = false,
  fictionalAdultsOnly = false,
  prohibitedContentPolicy = false,
  localOnlyBoundary = false,
  officialSourceDownloads = false,
  contentFreeDiagnostics = false,
  localBackupResponsibility = false,
  manualStopProcedure = false,
  now = new Date(),
  randomBytes = crypto.randomBytes,
}) => {
  if (!path.isAbsolute(outputPath ?? "") || outputPath.startsWith("\\\\"))
    throw new Error(
      "候補者JSONの出力先はローカルドライブ上の絶対pathで指定してください。",
    );
  if (isInside(repositoryRoot, outputPath))
    throw new Error(
      "候補者JSONはGit管理外のアクセス制限領域へ出力してください。",
    );
  const parent = path.dirname(outputPath);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory())
    throw new Error("候補者JSONの出力先directoryがありません。");
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error("確認日時が不正です。");

  const idBytes = randomBytes(6);
  if (!Buffer.isBuffer(idBytes) || idBytes.length !== 6)
    throw new Error("candidate IDを安全に生成できませんでした。");

  const candidate = {
    format: "mangai.desktop-adult-technical-monitor-candidate",
    version: 1,
    candidateId: `candidate-${idBytes.toString("hex")}`,
    confirmedAt: now.toISOString(),
    environment: {
      windows: requireChoice(windows, choices.windows, "Windows"),
      gpuVendor: requireChoice(gpuVendor, choices.gpuVendor, "GPU vendor"),
      vramBand: requireChoice(vramBand, choices.vramBand, "VRAM帯"),
      ramBand: requireChoice(ramBand, choices.ramBand, "RAM帯"),
      freeDiskBand: requireChoice(
        freeDiskBand,
        choices.freeDiskBand,
        "空き容量帯",
      ),
    },
    availability: {
      assistedFirstRun: assistedFirstRun === true,
      observation24Hours: observation24Hours === true,
    },
    confirmations: {
      age18OrOlder: age18OrOlder === true,
      fictionalAdultsOnly: fictionalAdultsOnly === true,
      prohibitedContentPolicy: prohibitedContentPolicy === true,
      localOnlyBoundary: localOnlyBoundary === true,
      officialSourceDownloads: officialSourceDownloads === true,
      contentFreeDiagnostics: contentFreeDiagnostics === true,
      localBackupResponsibility: localBackupResponsibility === true,
      manualStopProcedure: manualStopProcedure === true,
    },
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return candidate;
};

const valueFlags = new Set([
  "--windows",
  "--gpu-vendor",
  "--vram-band",
  "--ram-band",
  "--free-disk-band",
  "--out",
]);
const confirmationFlags = new Set([
  "--confirm-assisted-first-run",
  "--confirm-observation-24-hours",
  "--confirm-age-18-or-older",
  "--confirm-fictional-adults-only",
  "--confirm-prohibited-content-policy",
  "--confirm-local-only-boundary",
  "--confirm-official-source-downloads",
  "--confirm-content-free-diagnostics",
  "--confirm-local-backup-responsibility",
  "--confirm-manual-stop-procedure",
]);

const parseArgs = (args) => {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!valueFlags.has(argument) && !confirmationFlags.has(argument))
      throw new Error("未対応の引数があります。");
    if (parsed.has(argument))
      throw new Error("同じ引数を複数回指定できません。");
    if (valueFlags.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error("値が必要な引数があります。");
      parsed.set(argument, value);
      index += 1;
    } else {
      parsed.set(argument, true);
    }
  }
  return parsed;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseArgs(process.argv.slice(2));
    createTechnicalMonitorCandidate({
      outputPath: args.get("--out"),
      windows: args.get("--windows"),
      gpuVendor: args.get("--gpu-vendor"),
      vramBand: args.get("--vram-band"),
      ramBand: args.get("--ram-band"),
      freeDiskBand: args.get("--free-disk-band"),
      assistedFirstRun: args.has("--confirm-assisted-first-run"),
      observation24Hours: args.has("--confirm-observation-24-hours"),
      age18OrOlder: args.has("--confirm-age-18-or-older"),
      fictionalAdultsOnly: args.has("--confirm-fictional-adults-only"),
      prohibitedContentPolicy: args.has("--confirm-prohibited-content-policy"),
      localOnlyBoundary: args.has("--confirm-local-only-boundary"),
      officialSourceDownloads: args.has("--confirm-official-source-downloads"),
      contentFreeDiagnostics: args.has("--confirm-content-free-diagnostics"),
      localBackupResponsibility: args.has(
        "--confirm-local-backup-responsibility",
      ),
      manualStopProcedure: args.has("--confirm-manual-stop-procedure"),
    });
    console.log("MANGAI Desktop Adult technical monitor candidate");
    console.log("  Candidate identity and output path: hidden");
    console.log("  Personal data and free text: not accepted");
    console.log("  Distribution authorized: no");
    console.log("  Next: run technical monitor preflight");
    console.log("  Result: CREATED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "候補者JSONのfile操作に失敗しました。"
        : error.message;
    console.error(`Technical monitor candidate creation failed: ${message}`);
    process.exit(1);
  }
}

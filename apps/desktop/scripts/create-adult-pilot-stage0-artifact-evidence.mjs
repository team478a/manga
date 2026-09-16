import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultDesktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const directoryPattern = /^[a-zA-Z0-9._-]+$/;
const thumbprintPattern = /^[0-9a-f]{40}$/i;

const sha256File = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const assertRegularFile = (filePath, label) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
    throw new Error(`${label}がありません。`);
  if (fs.statSync(filePath).size <= 0) throw new Error(`${label}が空です。`);
};

export const probeAuthenticode = (artifactPath) => {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$module=Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1'; Import-Module $module; $signature=Get-AuthenticodeSignature -LiteralPath $env:MANGAI_ARTIFACT_PATH; [pscustomobject]@{status=$signature.Status.ToString();thumbprint=$signature.SignerCertificate.Thumbprint} | ConvertTo-Json -Compress",
    ],
    {
      env: { ...process.env, MANGAI_ARTIFACT_PATH: artifactPath },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.status !== 0)
    throw new Error("Authenticode署名状態を確認できませんでした。");
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Authenticode署名結果を読み取れませんでした。");
  }
};

const verifyReleaseWithExistingGates = (desktopRoot, directoryName) => {
  const commands = [
    [
      path.join(desktopRoot, "scripts", "check-windows-artifacts.mjs"),
      "--directory",
      directoryName,
      "--require-metadata",
      "--require-signed",
    ],
    [
      path.join(
        desktopRoot,
        "scripts",
        "generate-windows-release-evidence.mjs",
      ),
      "verify",
      directoryName,
    ],
  ];
  for (const command of commands) {
    const result = spawnSync(process.execPath, command, {
      cwd: desktopRoot,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0)
      throw new Error("Windows release成果物の既存検証gateが失敗しました。");
  }
};

export const createStage0ArtifactEvidence = ({
  desktopRoot = defaultDesktopRoot,
  directoryName,
  productExecutablePath,
  outputPath,
  now = new Date(),
  verifyRelease = verifyReleaseWithExistingGates,
  signatureProbe = probeAuthenticode,
}) => {
  if (
    !directoryPattern.test(directoryName ?? "") ||
    directoryName === "." ||
    directoryName === ".."
  )
    throw new Error("release directoryはDesktop内の単一名で指定してください。");
  if (
    !path.isAbsolute(productExecutablePath ?? "") ||
    productExecutablePath.startsWith("\\\\") ||
    path.extname(productExecutablePath).toLowerCase() !== ".exe"
  )
    throw new Error(
      "製品EXEはローカルドライブ上の絶対pathで指定してください。",
    );
  if (!path.isAbsolute(outputPath ?? ""))
    throw new Error("証跡出力先は絶対pathで指定してください。");
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error("証跡作成日時が不正です。");

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"),
  );
  const version = packageJson.version;
  const releaseDirectory = path.join(desktopRoot, directoryName);
  const installerName = `MANGAI-Desktop-Setup-${version}-x64.exe`;
  const metadataName = version.includes("-beta.") ? "beta.yml" : "latest.yml";
  const paths = {
    installer: path.join(releaseDirectory, installerName),
    blockmap: path.join(releaseDirectory, `${installerName}.blockmap`),
    updateMetadata: path.join(releaseDirectory, metadataName),
    sbom: path.join(
      releaseDirectory,
      `MANGAI-Desktop-${version}-sbom.spdx.json`,
    ),
    checksums: path.join(releaseDirectory, "SHA256SUMS.txt"),
    productExecutable: path.resolve(productExecutablePath),
  };

  verifyRelease(desktopRoot, directoryName);
  for (const [id, artifactPath] of Object.entries(paths))
    assertRegularFile(artifactPath, id);

  const installerSignature = signatureProbe(paths.installer);
  const productSignature = signatureProbe(paths.productExecutable);
  for (const signature of [installerSignature, productSignature]) {
    if (
      signature?.status !== "Valid" ||
      !thumbprintPattern.test(signature?.thumbprint ?? "")
    )
      throw new Error(
        "installerまたは製品EXEの有効な署名を確認できませんでした。",
      );
  }
  const sameSigner =
    installerSignature.thumbprint.toUpperCase() ===
    productSignature.thumbprint.toUpperCase();
  if (!sameSigner)
    throw new Error("installerと製品EXEの署名者が一致しません。");

  const evidence = {
    format: "mangai.desktop-adult-stage0-artifact-evidence",
    version: 1,
    generatedAt: now.toISOString(),
    artifactVersion: version,
    artifactPurpose: "stage0_acceptance_only",
    distributionAuthorized: false,
    signatures: {
      installerStatus: "Valid",
      productExecutableStatus: "Valid",
      sameSigner,
    },
    artifacts: Object.fromEntries(
      Object.entries(paths).map(([id, artifactPath]) => [
        `${id}Sha256`,
        sha256File(artifactPath),
      ]),
    ),
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    flag: "wx",
  });
  return evidence;
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
    const evidence = createStage0ArtifactEvidence({
      directoryName: valueAfter(args, "--directory"),
      productExecutablePath: valueAfter(args, "--product-exe"),
      outputPath: valueAfter(args, "--out"),
    });
    console.log("MANGAI Desktop Adult Stage 0 artifact evidence");
    console.log(`  Version: ${evidence.artifactVersion}`);
    console.log("  Installer signature: Valid");
    console.log("  Product executable signature: Valid");
    console.log("  Same signer: yes");
    console.log("  Paths and signer identity: hidden");
    console.log("  Stage 1 distribution authorized: no");
    console.log("  Result: PASSED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "artifactのfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 artifact evidence failed: ${message}`);
    process.exit(1);
  }
}

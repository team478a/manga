import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positionalDirectory = args.find(
  (argument) =>
    !argument.startsWith("--") &&
    argument !== "metadata" &&
    argument !== "signed",
);
const directoryName =
  valueAfter("--directory") ?? positionalDirectory ?? "release";
const requireMetadata =
  args.includes("--require-metadata") || args.includes("metadata");
const requireSigned =
  args.includes("--require-signed") || args.includes("signed");

if (
  !/^[a-zA-Z0-9._-]+$/.test(directoryName) ||
  directoryName === "." ||
  directoryName === ".."
) {
  console.error("出力先はDesktop内の単一ディレクトリ名で指定してください。");
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const artifactName = `MANGAI-Desktop-Setup-${version}-x64.exe`;
const directory = path.join(root, directoryName);
const installerPath = path.join(directory, artifactName);
const blockmapPath = `${installerPath}.blockmap`;
const metadataPath = path.join(
  directory,
  version.includes("-beta.") ? "beta.yml" : "latest.yml",
);

const failures = [];
const assertFile = (filePath, label) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    failures.push(`${label}がありません。`);
    return false;
  }
  if (fs.statSync(filePath).size <= 0) {
    failures.push(`${label}が空です。`);
    return false;
  }
  return true;
};

const installerReady = assertFile(installerPath, "NSIS installer");
const blockmapReady = assertFile(blockmapPath, "blockmap");
let installerSize = 0;
let installerSha512 = "";
if (installerReady) {
  const bytes = fs.readFileSync(installerPath);
  installerSize = bytes.byteLength;
  installerSha512 = crypto.createHash("sha512").update(bytes).digest("base64");
}
if (blockmapReady) {
  const blockmapBytes = fs.readFileSync(blockmapPath);
  const header = blockmapBytes.subarray(0, 2);
  if (header[0] !== 0x1f || header[1] !== 0x8b)
    failures.push("blockmapがgzip形式ではありません。");
  else {
    try {
      const blockmap = JSON.parse(zlib.gunzipSync(blockmapBytes));
      const file = blockmap.files?.find((entry) => entry.name === "file");
      const blockSize = file?.sizes?.reduce(
        (total, size) => total + Number(size),
        0,
      );
      if (
        blockmap.version !== "2" ||
        !file ||
        file.sizes?.length !== file.checksums?.length ||
        blockSize !== installerSize
      )
        failures.push("blockmapがinstallerと一致しません。");
    } catch {
      failures.push("blockmapを解析できませんでした。");
    }
  }
}

let metadataState = "not generated";
if (fs.existsSync(metadataPath)) {
  const failureCountBeforeMetadata = failures.length;
  const metadata = fs.readFileSync(metadataPath, "utf8");
  const metadataVersion = metadata.match(
    /^version:\s*['\"]?([^'\"\r\n]+)$/m,
  )?.[1];
  const metadataPathValue = metadata.match(
    /^path:\s*['\"]?([^'\"\r\n]+)$/m,
  )?.[1];
  const metadataSha512 = metadata.match(
    /^sha512:\s*['\"]?([^'\"\r\n]+)$/m,
  )?.[1];
  const metadataSize = Number(metadata.match(/^\s+size:\s*(\d+)$/m)?.[1]);
  if (metadataVersion !== version)
    failures.push("更新metadataのversionが一致しません。");
  if (metadataPathValue !== artifactName)
    failures.push("更新metadataのinstaller名が一致しません。");
  if (metadataSha512 !== installerSha512)
    failures.push("更新metadataのSHA-512が一致しません。");
  if (metadataSize !== installerSize)
    failures.push("更新metadataのファイルサイズが一致しません。");
  metadataState =
    failures.length === failureCountBeforeMetadata ? "verified" : "mismatch";
} else if (requireMetadata) {
  failures.push("更新metadataがありません。");
}

let signatureState = "unavailable";
if (process.platform === "win32" && installerReady) {
  const signature = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$module=Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1'; Import-Module $module; (Get-AuthenticodeSignature -LiteralPath $env:MANGAI_ARTIFACT_PATH).Status.ToString()",
    ],
    {
      cwd: root,
      env: { ...process.env, MANGAI_ARTIFACT_PATH: installerPath },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (signature.status === 0) {
    signatureState = signature.stdout.trim();
    if (!signatureState)
      failures.push("Authenticode署名状態を読み取れませんでした。");
  } else {
    failures.push("Authenticode署名状態を確認できませんでした。");
  }
}
if (requireSigned && signatureState !== "Valid")
  failures.push("有効なAuthenticode署名がありません。");

console.log("MANGAI Windows artifact verification");
console.log(`  Version: ${version}`);
console.log(`  Installer: ${installerReady ? "verified" : "missing"}`);
console.log(`  Blockmap: ${blockmapReady ? "verified" : "missing"}`);
console.log(`  Update metadata: ${metadataState}`);
console.log(`  Authenticode: ${signatureState}`);
console.log(`  Result: ${failures.length === 0 ? "PASSED" : "FAILED"}`);
for (const failure of failures) console.error(`  - ${failure}`);

if (failures.length > 0) process.exit(1);

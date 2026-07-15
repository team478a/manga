import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const directoryName =
  args.find((argument) => argument !== "allow-local") ?? "release";
const allowLocal = args.includes("allow-local") || process.env.CI === "true";

if (process.platform !== "win32") {
  console.error("Windows installer E2EはWindows上で実行してください。");
  process.exit(1);
}
if (!allowLocal) {
  console.error(
    "ローカル実行では末尾にallow-localを指定してください。既存インストールがある場合は自動停止します。",
  );
  process.exit(1);
}
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
const installerName = `MANGAI-Desktop-Setup-${packageJson.version}-x64.exe`;
const installerPath = path.join(root, directoryName, installerName);
if (!fs.existsSync(installerPath)) {
  console.error("検査対象のWindows installerがありません。");
  process.exit(1);
}

const desktopShortcut = path.join(
  process.env.USERPROFILE ?? "",
  "Desktop",
  "MANGAI Desktop.lnk",
);
const startMenuShortcut = path.join(
  process.env.APPDATA ?? "",
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "MANGAI Desktop.lnk",
);
const defaultInstallDirectory = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Programs",
  "MANGAI Desktop",
);

function registryContainsMangai() {
  const roots = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  ];
  return roots.some((registryRoot) => {
    const result = spawnSync(
      "reg.exe",
      ["query", registryRoot, "/s", "/f", "MANGAI Desktop", "/d"],
      { encoding: "utf8", windowsHide: true },
    );
    return result.status === 0 && result.stdout.includes("MANGAI Desktop");
  });
}

if (
  fs.existsSync(defaultInstallDirectory) ||
  fs.existsSync(desktopShortcut) ||
  fs.existsSync(startMenuShortcut) ||
  registryContainsMangai()
) {
  console.error(
    "既存のMANGAI Desktopインストールを検出したため、安全のため停止しました。",
  );
  process.exit(1);
}

const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "mangai-installer-e2e-"),
);
const installDirectory = path.join(temporaryRoot, "MANGAI Desktop");
let uninstallerPath;
let installed = false;
const failures = [];

function run(file, commandArgs) {
  return spawnSync(file, commandArgs, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
  });
}

function waitUntil(predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  return predicate();
}

try {
  const install = run(installerPath, [
    "/currentuser",
    "/S",
    `/D=${installDirectory}`,
  ]);
  if (install.status !== 0) {
    failures.push("silent installが失敗しました。");
  } else {
    installed = true;
    const executablePath = path.join(installDirectory, "MANGAI Desktop.exe");
    if (!fs.existsSync(executablePath)) {
      failures.push("インストール後の実行ファイルがありません。");
    } else if (!fs.statSync(executablePath).isFile()) {
      failures.push("インストール後の実行ファイルが不正です。");
    }
    if (!fs.existsSync(desktopShortcut))
      failures.push("Desktopショートカットが作成されませんでした。");
    if (!fs.existsSync(startMenuShortcut))
      failures.push("Start Menuショートカットが作成されませんでした。");
    if (!registryContainsMangai())
      failures.push("アンインストール情報が登録されませんでした。");

    if (fs.existsSync(installDirectory)) {
      uninstallerPath = fs
        .readdirSync(installDirectory)
        .find((name) => /^Uninstall.*\.exe$/i.test(name));
      if (uninstallerPath)
        uninstallerPath = path.join(installDirectory, uninstallerPath);
    }
    if (!uninstallerPath) failures.push("uninstallerがありません。");
  }

  if (uninstallerPath) {
    const uninstall = run(uninstallerPath, ["/currentuser", "/S"]);
    if (uninstall.status !== 0)
      failures.push("silent uninstallが失敗しました。");
    waitUntil(
      () =>
        !fs.existsSync(path.join(installDirectory, "MANGAI Desktop.exe")) &&
        !fs.existsSync(desktopShortcut) &&
        !fs.existsSync(startMenuShortcut) &&
        !registryContainsMangai(),
    );
    installed = uninstall.status !== 0;
  }

  if (fs.existsSync(path.join(installDirectory, "MANGAI Desktop.exe")))
    failures.push("uninstall後も実行ファイルが残っています。");
  if (fs.existsSync(desktopShortcut))
    failures.push("uninstall後もDesktopショートカットが残っています。");
  if (fs.existsSync(startMenuShortcut))
    failures.push("uninstall後もStart Menuショートカットが残っています。");
  if (registryContainsMangai())
    failures.push("uninstall後も登録情報が残っています。");
} finally {
  if (installed && uninstallerPath && fs.existsSync(uninstallerPath))
    run(uninstallerPath, ["/currentuser", "/S"]);
  for (const shortcut of [desktopShortcut, startMenuShortcut]) {
    if (fs.existsSync(shortcut)) fs.rmSync(shortcut, { force: true });
  }
  const temporaryBase = path.resolve(os.tmpdir()) + path.sep;
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  if (resolvedTemporaryRoot.startsWith(temporaryBase))
    fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
}

console.log("MANGAI Windows installer E2E");
console.log("  Silent install: checked");
console.log("  Installed files: checked");
console.log("  Shortcuts / registry: checked");
console.log("  Silent uninstall: checked");
console.log(`  Result: ${failures.length === 0 ? "PASSED" : "FAILED"}`);
for (const failure of failures) console.error(`  - ${failure}`);

if (failures.length > 0) process.exit(1);

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "build", "update-config.json");
const value = process.env.MANGAI_UPDATE_URL?.trim();
const publishToGitHub = process.env.MANGAI_PUBLISH_GITHUB === "1";
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const requestedChannel = process.env.MANGAI_RELEASE_CHANNEL?.trim();
const requestedOutput = process.env.MANGAI_RELEASE_OUTPUT?.trim();
const inferredChannel = /-beta(?:\.|$)/.test(packageJson.version)
  ? "beta"
  : "stable";
const releaseChannel = requestedChannel || inferredChannel;

if (releaseChannel !== "stable" && releaseChannel !== "beta") {
  console.error("MANGAI_RELEASE_CHANNELはstableまたはbetaで指定してください。");
  process.exit(1);
}
if (
  (releaseChannel === "stable" && packageJson.version.includes("-")) ||
  (releaseChannel === "beta" && !/-beta(?:\.|$)/.test(packageJson.version))
) {
  console.error(
    `version ${packageJson.version} と${releaseChannel}チャンネルが一致しません。`,
  );
  process.exit(1);
}
process.env.MANGAI_RELEASE_CHANNEL = releaseChannel;

if (!value) {
  console.error("MANGAI_UPDATE_URLを設定してください。");
  process.exit(1);
}
if (
  requestedOutput &&
  (!/^[a-zA-Z0-9._-]+$/.test(requestedOutput) ||
    requestedOutput === "." ||
    requestedOutput === "..")
) {
  console.error(
    "MANGAI_RELEASE_OUTPUTはDesktopフォルダ内の単一ディレクトリ名で指定してください。",
  );
  process.exit(1);
}

let url;
try {
  url = new URL(value);
} catch {
  console.error("MANGAI_UPDATE_URLが正しいURLではありません。");
  process.exit(1);
}
if (url.protocol !== "https:") {
  console.error("MANGAI_UPDATE_URLはHTTPSで指定してください。");
  process.exit(1);
}
if (publishToGitHub) {
  if (!/^[-\w.]+\/[-\w.]+$/.test(process.env.GITHUB_REPOSITORY ?? "")) {
    console.error(
      "GITHUB_REPOSITORYをowner/repository形式で設定してください。",
    );
    process.exit(1);
  }
  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.error("GH_TOKENまたはGITHUB_TOKENを設定してください。");
    process.exit(1);
  }
}

const original = fs.readFileSync(configPath, "utf8");
const npmCli = process.env.npm_execpath;
const builderCli = path.join(
  root,
  "node_modules",
  "electron-builder",
  "out",
  "cli",
  "cli.js",
);

if (!npmCli || !fs.existsSync(npmCli)) {
  console.error("npm run経由で実行してください。");
  process.exit(1);
}

try {
  const githubRepository = publishToGitHub
    ? process.env.GITHUB_REPOSITORY
    : undefined;
  fs.writeFileSync(
    configPath,
    `${JSON.stringify({ updateUrl: url.href, githubRepository }, null, 2)}\n`,
  );
  execFileSync(process.execPath, [npmCli, "run", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  const builderArguments = [
    builderCli,
    "--config",
    "electron-builder.update.cjs",
    "--win",
    "nsis",
    "--x64",
    "--publish",
    publishToGitHub ? "always" : "never",
  ];
  if (requestedOutput)
    builderArguments.push(`--config.directories.output=${requestedOutput}`);
  execFileSync(process.execPath, builderArguments, {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  fs.writeFileSync(configPath, original);
}

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWindowsSigningConfig } from "./windows-signing-config.mjs";

let signing;
try {
  signing = resolveWindowsSigningConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

execFileSync(process.execPath, [npmCli, "run", "build"], {
  cwd: root,
  stdio: "inherit",
});
execFileSync(
  process.execPath,
  [
    builderCli,
    "--win",
    "nsis",
    "--x64",
    "-c.forceCodeSigning=true",
    ...signing.builderArguments,
  ],
  { cwd: root, stdio: "inherit" },
);

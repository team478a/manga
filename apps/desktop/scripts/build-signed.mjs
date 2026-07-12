import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.WIN_CSC_LINK && !process.env.CSC_LINK) {
  console.error(
    "署名証明書が未設定です。WIN_CSC_LINK または CSC_LINK を設定してください。",
  );
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
  [builderCli, "--win", "nsis", "--x64", "-c.forceCodeSigning=true"],
  { cwd: root, stdio: "inherit" },
);

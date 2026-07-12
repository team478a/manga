import { execFileSync } from "node:child_process";

if (!process.env.WIN_CSC_LINK && !process.env.CSC_LINK) {
  console.error(
    "署名証明書が未設定です。WIN_CSC_LINK または CSC_LINK を設定してください。",
  );
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

execFileSync(npm, ["run", "build"], { stdio: "inherit" });
execFileSync(
  npx,
  ["electron-builder", "--win", "nsis", "--x64", "-c.forceCodeSigning=true"],
  { stdio: "inherit" },
);

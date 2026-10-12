import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const output = path.resolve("work/manga-visual-c3d");
const runtime = fs.mkdtempSync(path.join(output, "runtime-"));
fs.writeFileSync(path.join(runtime, "fixture-runtime.json"), JSON.stringify({ fixtureOnly: true }));
const appRoot = path.resolve("apps/desktop");
const env = { ...process.env, MANGAI_SMOKE_DOCUMENTS: path.join(runtime, "Documents"), MANGAI_TEST_USER_DATA: path.join(runtime, "UserData"), MANGAI_MANGA_VISUAL_OUTPUT: output, MANGAI_MANGA_VISUAL_PDF: path.resolve("output/pdf/mangai-c3d-desktop-fixture.pdf") };
delete env.ELECTRON_RUN_AS_NODE;
delete env.VITE_DEV_SERVER_URL;
const result = spawnSync(require("electron"), [appRoot, "--mangai-manga-visual-test", "--disable-gpu"], { cwd: appRoot, env, encoding: "utf8", timeout: 120000, windowsHide: true });
if (result.status !== 0) {
  console.error(result.stderr || result.error?.message || "fixture renderer failed");
  process.exitCode = result.status ?? 1;
} else console.log("Desktop fixed fixture: real UI repair/reload, PNG x4, product PDF exported; visual review pending.");

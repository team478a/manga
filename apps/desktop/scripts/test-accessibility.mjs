import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "mangai-accessibility-"),
);
const documents = path.join(temporaryRoot, "Documents");
const userData = path.join(temporaryRoot, "UserData");
const reportPath =
  process.env.MANGAI_A11Y_REPORT ??
  path.join(temporaryRoot, "accessibility-home.json");
const axePath = require.resolve("axe-core/axe.min.js");
const env = {
  ...process.env,
  MANGAI_SMOKE_DOCUMENTS: documents,
  MANGAI_TEST_USER_DATA: userData,
  MANGAI_AXE_PATH: axePath,
  MANGAI_A11Y_REPORT: path.resolve(reportPath),
};
delete env.ELECTRON_RUN_AS_NODE;

try {
  const result = spawnSync(
    electronPath,
    [appRoot, "--mangai-accessibility-test", "--disable-gpu"],
    {
      cwd: appRoot,
      env,
      encoding: "utf8",
      timeout: 60_000,
      windowsHide: true,
    },
  );
  const report = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
    : null;
  if (report) {
    const summary = {
      screens: report.screens.map((screen) => ({
        screen: screen.screen,
        passes: screen.passes,
        violations: screen.violations.map((item) => ({
          id: item.id,
          impact: item.impact,
          nodes: item.nodes.length,
        })),
        incomplete: screen.incomplete.map((item) => ({
          id: item.id,
          impact: item.impact,
          nodes: item.nodes.length,
        })),
      })),
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
  if (result.status !== 0) {
    if (result.error) process.stderr.write(`${result.error.stack}\n`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.status ?? 1;
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

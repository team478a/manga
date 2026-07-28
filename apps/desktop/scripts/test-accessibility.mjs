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
          // 修正対象を特定するため、失敗ノードのセレクタと概要のみ出力する
          // （画像・Prompt等の利用者コンテンツは含まれないaxeの構造情報のみ）。
          targets: item.nodes.map((node) => node.target),
          summaries: item.nodes.map((node) => node.failureSummary),
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
  const visualReportPath = path.join(
    path.dirname(reportPath),
    "command-palette-visual.json",
  );
  if (fs.existsSync(visualReportPath)) {
    const visualReport = JSON.parse(fs.readFileSync(visualReportPath, "utf8"));
    process.stdout.write(
      `${JSON.stringify({ commandPaletteVisual: visualReport }, null, 2)}\n`,
    );
    const screenshotDir = path.join(path.dirname(reportPath), "screenshots");
    if (fs.existsSync(screenshotDir)) {
      const files = fs.readdirSync(screenshotDir);
      process.stdout.write(
        `Command palette screenshots (${files.length}): ${files.join(", ")}\n`,
      );
    }
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

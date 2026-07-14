import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StructuredLogger } from "../dist-main/main/structured-logger.js";
import { DiagnosticsService } from "../dist-main/main/diagnostics.js";

const runtime = {
  appVersion: "0.1.0-test",
  platform: process.platform,
  arch: process.arch,
  electronVersion: "test",
};

test("構造化ログは秘密値を除外してローテーションする", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-log-"));
  try {
    const logger = new StructuredLogger(root, {
      maxBytes: 350,
      retainedFiles: 2,
    });
    logger.log("error", "secret_test", {
      api_token: "device-secret-value",
      message: "Authorization Bearer abcdefghijklmnopqrstuvwxyz",
      apiKey: "sk-test-secret-value",
      path: path.join(os.homedir(), "Documents", "MANGAI"),
    });
    for (let index = 0; index < 12; index += 1)
      logger.log("info", "rotation_test", {
        index,
        detail: "x".repeat(100),
      });
    const files = fs
      .readdirSync(root)
      .filter((name) => name.startsWith("desktop.jsonl"));
    assert.ok(files.includes("desktop.jsonl.1"));
    assert.ok(files.length <= 3);
    const combined = files
      .map((name) => fs.readFileSync(path.join(root, name), "utf8"))
      .join("\n");
    assert.doesNotMatch(combined, /device-secret-value|sk-test-secret-value/);
    assert.doesNotMatch(
      combined,
      new RegExp(os.homedir().replaceAll("\\", "\\\\"), "i"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("詳細クラッシュレポートは同意後だけ保存して削除できる", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-diagnostics-"));
  const paths = { root, logs: path.join(root, "logs") };
  try {
    const diagnostics = new DiagnosticsService(paths, runtime);
    assert.equal(diagnostics.state().detailedCrashReportsEnabled, false);
    assert.equal(
      diagnostics.captureCrash("test.disabled", new Error("not saved")),
      null,
    );
    assert.equal(diagnostics.state().crashReportCount, 0);

    diagnostics.updateConsent(true);
    const reportPath = diagnostics.captureCrash(
      "test.enabled",
      new Error("Bearer super-secret-token"),
      { authorization: "super-secret-token", password: "password-value" },
    );
    assert.ok(reportPath && fs.existsSync(reportPath));
    const report = fs.readFileSync(reportPath, "utf8");
    assert.doesNotMatch(report, /super-secret-token|password-value/);
    assert.match(report, /\[REDACTED\]/);

    const reopened = new DiagnosticsService(paths, runtime);
    assert.equal(reopened.state().detailedCrashReportsEnabled, true);
    assert.equal(reopened.state().crashReportCount, 1);
    assert.equal(reopened.clearCrashReports().crashReportCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

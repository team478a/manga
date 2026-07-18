import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StructuredLogger } from "../dist-main/main/structured-logger.js";
import {
  DiagnosticsService,
  safeDiagnosticsUploadEndpoint,
} from "../dist-main/main/diagnostics.js";

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
      new Error("private adult prompt: fictional adult secret fixture"),
      {
        authorization: "super-secret-token",
        password: "password-value",
        prompt: "private adult prompt fixture",
        negativePrompt: "private negative prompt fixture",
        inputImage: { bytes: "private-image-bytes" },
        mask_image: "private-mask-bytes",
      },
    );
    assert.ok(reportPath && fs.existsSync(reportPath));
    const report = fs.readFileSync(reportPath, "utf8");
    assert.doesNotMatch(report, /super-secret-token|password-value/);
    assert.doesNotMatch(
      report,
      /private adult|private negative|private-image|private-mask/,
    );
    assert.match(report, /\[REDACTED\]/);

    const reopened = new DiagnosticsService(paths, runtime);
    assert.equal(reopened.state().detailedCrashReportsEnabled, true);
    assert.equal(reopened.state().crashReportCount, 1);
    assert.equal(reopened.clearCrashReports().crashReportCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("外部送信はHTTPS送信先と別同意がなければ有効にできない", () => {
  assert.equal(safeDiagnosticsUploadEndpoint(null), null);
  assert.equal(
    safeDiagnosticsUploadEndpoint("https://diagnostics.example.com/v1/crashes"),
    "https://diagnostics.example.com/v1/crashes",
  );
  assert.throws(
    () => safeDiagnosticsUploadEndpoint("http://diagnostics.example.com"),
    /HTTPS/,
  );
  assert.throws(
    () => safeDiagnosticsUploadEndpoint("https://user:pass@example.com"),
    /認証情報/,
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-upload-off-"));
  try {
    const diagnostics = new DiagnosticsService(
      { root, logs: path.join(root, "logs") },
      runtime,
    );
    assert.equal(diagnostics.state().externalUploadAvailable, false);
    assert.throws(
      () => diagnostics.updateExternalUploadConsent(true),
      /送信先が設定されていません/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("詳細クラッシュレポートは確認操作後だけ送信して成功を記録する", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-upload-"));
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  };
  try {
    const diagnostics = new DiagnosticsService(
      { root, logs: path.join(root, "logs") },
      runtime,
      undefined,
      {
        endpoint: "https://diagnostics.example.com/v1/crashes",
        fetchImpl,
      },
    );
    assert.equal(diagnostics.state().externalUploadAvailable, true);
    assert.throws(
      () => diagnostics.updateExternalUploadConsent(true),
      /端末内保存へ同意/,
    );
    diagnostics.updateConsent(true);
    diagnostics.updateExternalUploadConsent(true);
    diagnostics.captureCrash("test.upload", new Error("Bearer secret-token"), {
      password: "password-value",
    });
    assert.equal(diagnostics.state().pendingUploadCount, 1);
    assert.equal(requests.length, 0);

    const state = await diagnostics.uploadPendingCrashReports();
    assert.equal(requests.length, 1);
    assert.equal(state.pendingUploadCount, 0);
    assert.ok(state.lastUploadAt);
    assert.equal(requests[0].url, "https://diagnostics.example.com/v1/crashes");
    assert.equal(requests[0].init.redirect, "error");
    assert.match(
      requests[0].init.headers["x-mangai-report-id"],
      /^[a-f0-9]{64}$/,
    );
    assert.doesNotMatch(
      String(requests[0].init.body),
      /secret-token|password-value/,
    );

    await diagnostics.uploadPendingCrashReports();
    assert.equal(requests.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

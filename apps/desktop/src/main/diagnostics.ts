import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  sanitizeDiagnosticValue,
  StructuredLogger,
  type LogLevel,
} from "./structured-logger.js";

const consentSchema = z.object({
  detailedCrashReportsEnabled: z.boolean().default(false),
  externalUploadEnabled: z.boolean().default(false),
  updatedAt: z.string(),
});
type Consent = z.infer<typeof consentSchema>;

const uploadLedgerSchema = z.object({
  uploaded: z.record(z.string(), z.string()).default({}),
  lastUploadAt: z.string().nullable().default(null),
});
type UploadLedger = z.infer<typeof uploadLedgerSchema>;

const crashUploadSchema = z.object({
  format: z.literal("mangai.desktop-crash"),
  version: z.literal(1),
  at: z.string().datetime(),
  source: z.string().max(120),
  runtime: z.object({
    appVersion: z.string().max(100),
    platform: z.string().max(100),
    arch: z.string().max(100),
    electronVersion: z.string().max(100),
  }),
  error: z.object({
    name: z.string().max(200),
    message: z.string().max(8_000),
    stack: z.string().max(8_000).optional(),
  }),
  context: z
    .record(
      z.string(),
      z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
    )
    .default({}),
});

export function safeDiagnosticsUploadEndpoint(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value);
  if (url.protocol !== "https:")
    throw new Error("診断レポート送信先はHTTPSである必要があります。");
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "診断レポート送信先に認証情報、query、fragmentは指定できません。",
    );
  return url.toString();
}

export type DiagnosticsState = {
  detailedCrashReportsEnabled: boolean;
  externalUploadEnabled: boolean;
  externalUploadAvailable: boolean;
  logDirectory: string;
  logFile: string;
  crashReportCount: number;
  pendingUploadCount: number;
  lastUploadAt: string | null;
  updatedAt: string | null;
};

export class DiagnosticsService {
  readonly logger: StructuredLogger;
  private readonly settingsPath: string;
  private readonly uploadLedgerPath: string;
  private readonly uploadEndpoint: string | null;
  private readonly fetchImpl: typeof fetch;
  private uploadRunning = false;

  constructor(
    private readonly paths: { root: string; logs: string },
    private readonly runtime: {
      appVersion: string;
      platform: string;
      arch: string;
      electronVersion: string;
    },
    loggerOptions?: ConstructorParameters<typeof StructuredLogger>[1],
    uploadOptions: {
      endpoint?: string | null;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    } = {},
  ) {
    this.settingsPath = path.join(paths.root, "settings", "diagnostics.json");
    this.uploadLedgerPath = path.join(
      paths.root,
      "settings",
      "diagnostics-upload-ledger.json",
    );
    this.uploadEndpoint = safeDiagnosticsUploadEndpoint(uploadOptions.endpoint);
    this.fetchImpl = uploadOptions.fetchImpl ?? fetch;
    this.uploadTimeoutMs = uploadOptions.timeoutMs ?? 10_000;
    this.logger = new StructuredLogger(paths.logs, loggerOptions);
  }

  private readonly uploadTimeoutMs: number;

  private consent(): Consent {
    if (!fs.existsSync(this.settingsPath))
      return {
        detailedCrashReportsEnabled: false,
        externalUploadEnabled: false,
        updatedAt: new Date(0).toISOString(),
      };
    try {
      return consentSchema.parse(
        JSON.parse(fs.readFileSync(this.settingsPath, "utf8")),
      );
    } catch {
      this.logger.log("warn", "diagnostics_settings_invalid");
      return {
        detailedCrashReportsEnabled: false,
        externalUploadEnabled: false,
        updatedAt: new Date(0).toISOString(),
      };
    }
  }

  private uploadLedger(): UploadLedger {
    if (!fs.existsSync(this.uploadLedgerPath))
      return { uploaded: {}, lastUploadAt: null };
    try {
      return uploadLedgerSchema.parse(
        JSON.parse(fs.readFileSync(this.uploadLedgerPath, "utf8")),
      );
    } catch {
      this.logger.log("warn", "diagnostics_upload_ledger_invalid");
      return { uploaded: {}, lastUploadAt: null };
    }
  }

  private writeUploadLedger(ledger: UploadLedger) {
    fs.mkdirSync(path.dirname(this.uploadLedgerPath), { recursive: true });
    fs.writeFileSync(this.uploadLedgerPath, JSON.stringify(ledger, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  private pendingUploadFiles() {
    const uploaded = this.uploadLedger().uploaded;
    return this.crashFiles().filter((fileName) => !uploaded[fileName]);
  }

  private crashFiles() {
    if (!fs.existsSync(this.paths.logs)) return [];
    return fs
      .readdirSync(this.paths.logs)
      .filter((name) => /^crash-\d{4}-\d{2}-\d{2}T.*\.json$/.test(name))
      .sort()
      .reverse();
  }

  state(): DiagnosticsState {
    const consent = this.consent();
    return {
      detailedCrashReportsEnabled: consent.detailedCrashReportsEnabled,
      externalUploadEnabled: consent.externalUploadEnabled,
      externalUploadAvailable: Boolean(this.uploadEndpoint),
      logDirectory: this.paths.logs,
      logFile: this.logger.filePath,
      crashReportCount: this.crashFiles().length,
      pendingUploadCount: this.pendingUploadFiles().length,
      lastUploadAt: this.uploadLedger().lastUploadAt,
      updatedAt:
        consent.updatedAt === new Date(0).toISOString()
          ? null
          : consent.updatedAt,
    };
  }

  updateConsent(enabled: boolean) {
    const consent = {
      detailedCrashReportsEnabled: enabled,
      externalUploadEnabled: enabled
        ? this.consent().externalUploadEnabled
        : false,
      updatedAt: new Date().toISOString(),
    } satisfies Consent;
    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    fs.writeFileSync(this.settingsPath, JSON.stringify(consent, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    this.logger.log("info", "diagnostics_consent_updated", { enabled });
    return this.state();
  }

  updateExternalUploadConsent(enabled: boolean) {
    if (enabled && !this.uploadEndpoint)
      throw new Error("診断レポートの送信先が設定されていません。");
    const current = this.consent();
    if (enabled && !current.detailedCrashReportsEnabled)
      throw new Error(
        "先に詳細クラッシュレポートの端末内保存へ同意してください。",
      );
    const consent = {
      detailedCrashReportsEnabled: current.detailedCrashReportsEnabled,
      externalUploadEnabled: enabled,
      updatedAt: new Date().toISOString(),
    } satisfies Consent;
    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    fs.writeFileSync(this.settingsPath, JSON.stringify(consent, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    this.logger.log("info", "diagnostics_upload_consent_updated", { enabled });
    return this.state();
  }

  async uploadPendingCrashReports() {
    if (this.uploadRunning)
      throw new Error("診断レポートを送信しています。完了までお待ちください。");
    const consent = this.consent();
    if (!consent.externalUploadEnabled)
      throw new Error("外部送信への同意が必要です。");
    if (!this.uploadEndpoint)
      throw new Error("診断レポートの送信先が設定されていません。");
    this.uploadRunning = true;
    try {
      const ledger = this.uploadLedger();
      for (const fileName of this.pendingUploadFiles()) {
        const filePath = path.join(this.paths.logs, fileName);
        const bytes = fs.readFileSync(filePath);
        if (bytes.byteLength > 256 * 1024)
          throw new Error("送信できる診断レポートの上限サイズを超えています。");
        const report = sanitizeDiagnosticValue(
          crashUploadSchema.parse(JSON.parse(bytes.toString("utf8"))),
        );
        const reportId = createHash("sha256").update(bytes).digest("hex");
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          this.uploadTimeoutMs,
        );
        try {
          const response = await this.fetchImpl(this.uploadEndpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-mangai-report-id": reportId,
            },
            body: JSON.stringify(report),
            redirect: "error",
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(
              `診断レポート送信に失敗しました（HTTP ${response.status}）。`,
            );
        } finally {
          clearTimeout(timer);
        }
        const uploadedAt = new Date().toISOString();
        ledger.uploaded[fileName] = uploadedAt;
        ledger.lastUploadAt = uploadedAt;
        this.writeUploadLedger(ledger);
        this.logger.log("info", "diagnostics_report_uploaded", { reportId });
      }
      return this.state();
    } finally {
      this.uploadRunning = false;
    }
  }

  log(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
    this.logger.log(level, event, context);
  }

  captureCrash(
    source: string,
    cause: unknown,
    context: Record<string, unknown> = {},
  ) {
    this.logger.log("error", "crash_detected", { source });
    if (!this.consent().detailedCrashReportsEnabled) return null;
    fs.mkdirSync(this.paths.logs, { recursive: true });
    const timestamp = new Date().toISOString();
    const fileName = `crash-${timestamp.replace(/:/g, "-")}-${randomUUID().slice(0, 8)}.json`;
    const filePath = path.join(this.paths.logs, fileName);
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        sanitizeDiagnosticValue({
          format: "mangai.desktop-crash",
          version: 1,
          at: timestamp,
          source,
          runtime: this.runtime,
          error: cause instanceof Error ? cause : new Error(String(cause)),
          context,
        }),
        null,
        2,
      ),
      { encoding: "utf8", mode: 0o600 },
    );
    for (const oldFile of this.crashFiles().slice(20))
      fs.rmSync(path.join(this.paths.logs, oldFile), { force: true });
    return filePath;
  }

  clearCrashReports() {
    for (const fileName of this.crashFiles())
      fs.rmSync(path.join(this.paths.logs, fileName), { force: true });
    fs.rmSync(this.uploadLedgerPath, { force: true });
    this.logger.log("info", "crash_reports_cleared");
    return this.state();
  }
}

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  sanitizeDiagnosticValue,
  StructuredLogger,
  type LogLevel,
} from "./structured-logger.js";

const consentSchema = z.object({
  detailedCrashReportsEnabled: z.boolean().default(false),
  updatedAt: z.string(),
});
type Consent = z.infer<typeof consentSchema>;

export type DiagnosticsState = {
  detailedCrashReportsEnabled: boolean;
  externalUploadEnabled: false;
  logDirectory: string;
  logFile: string;
  crashReportCount: number;
  updatedAt: string | null;
};

export class DiagnosticsService {
  readonly logger: StructuredLogger;
  private readonly settingsPath: string;

  constructor(
    private readonly paths: { root: string; logs: string },
    private readonly runtime: {
      appVersion: string;
      platform: string;
      arch: string;
      electronVersion: string;
    },
    loggerOptions?: ConstructorParameters<typeof StructuredLogger>[1],
  ) {
    this.settingsPath = path.join(paths.root, "settings", "diagnostics.json");
    this.logger = new StructuredLogger(paths.logs, loggerOptions);
  }

  private consent(): Consent {
    if (!fs.existsSync(this.settingsPath))
      return {
        detailedCrashReportsEnabled: false,
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
        updatedAt: new Date(0).toISOString(),
      };
    }
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
      externalUploadEnabled: false,
      logDirectory: this.paths.logs,
      logFile: this.logger.filePath,
      crashReportCount: this.crashFiles().length,
      updatedAt:
        consent.updatedAt === new Date(0).toISOString()
          ? null
          : consent.updatedAt,
    };
  }

  updateConsent(enabled: boolean) {
    const consent = {
      detailedCrashReportsEnabled: enabled,
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
    this.logger.log("info", "crash_reports_cleared");
    return this.state();
  }
}

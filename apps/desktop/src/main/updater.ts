import { app, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import fs from "node:fs";
import path from "node:path";

export type UpdateState = {
  status:
    | "disabled"
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message: string;
};

export class DesktopUpdater {
  private updater?: InstanceType<typeof electronUpdater.NsisUpdater>;
  private state: UpdateState;

  constructor() {
    const currentVersion = app.getVersion();
    this.state = {
      status: "disabled",
      currentVersion,
      message: app.isPackaged
        ? "更新配布先が未設定です。"
        : "開発版では自動更新を使用しません。",
    };
    if (!app.isPackaged) return;
    const value =
      process.env.MANGAI_UPDATE_URL?.trim() || this.packagedUpdateUrl();
    if (!value) return;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      this.fail("更新配布先URLが正しくありません。");
      return;
    }
    if (url.protocol !== "https:") {
      this.fail("更新配布先はHTTPSで指定してください。");
      return;
    }
    const { NsisUpdater } = electronUpdater;
    this.updater = new NsisUpdater({ provider: "generic", url: url.href });
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.bindEvents();
    this.setState({ status: "idle", message: "更新を確認できます。" });
  }

  private packagedUpdateUrl() {
    try {
      const config = JSON.parse(
        fs.readFileSync(
          path.join(process.resourcesPath, "update-config.json"),
          "utf8",
        ),
      ) as { updateUrl?: unknown };
      return typeof config.updateUrl === "string"
        ? config.updateUrl.trim()
        : "";
    } catch {
      return "";
    }
  }

  private bindEvents() {
    this.updater?.on("checking-for-update", () =>
      this.setState({ status: "checking", message: "更新を確認中です…" }),
    );
    this.updater?.on("update-available", (info) =>
      this.setState({
        status: "available",
        availableVersion: info.version,
        message: `バージョン ${info.version} を利用できます。`,
      }),
    );
    this.updater?.on("update-not-available", () =>
      this.setState({
        status: "not-available",
        availableVersion: undefined,
        message: "最新バージョンです。",
      }),
    );
    this.updater?.on("download-progress", (progress) =>
      this.setState({
        status: "downloading",
        percent: Math.max(0, Math.min(100, progress.percent)),
        message: `更新をダウンロード中です（${Math.round(progress.percent)}%）。`,
      }),
    );
    this.updater?.on("update-downloaded", (info) =>
      this.setState({
        status: "downloaded",
        availableVersion: info.version,
        percent: 100,
        message: "更新の準備ができました。再起動して適用できます。",
      }),
    );
    this.updater?.on("error", () =>
      this.fail("更新処理に失敗しました。時間をおいて再試行してください。"),
    );
  }

  private setState(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch };
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send("update:status", this.state);
  }

  private fail(message: string) {
    this.setState({ status: "error", message });
  }

  getState() {
    return this.state;
  }

  async check() {
    if (!this.updater) return this.state;
    try {
      await this.updater.checkForUpdates();
    } catch {
      this.fail("更新を確認できませんでした。ネットワークを確認してください。");
    }
    return this.state;
  }

  async download() {
    if (!this.updater || this.state.status !== "available") return this.state;
    this.setState({
      status: "downloading",
      percent: 0,
      message: "更新をダウンロード中です（0%）。",
    });
    try {
      await this.updater.downloadUpdate();
    } catch {
      this.fail("更新のダウンロードに失敗しました。");
    }
    return this.state;
  }

  install() {
    if (!this.updater || this.state.status !== "downloaded") return false;
    this.updater.quitAndInstall(false, true);
    return true;
  }
}

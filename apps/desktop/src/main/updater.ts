import { app, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import {
  resolveUpdateSource,
  UpdatePreferences,
  type UpdateChannel,
} from "./update-preferences.js";

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
  channel: UpdateChannel;
  availableVersion?: string;
  percent?: number;
  message: string;
};

export class DesktopUpdater {
  private updater?: InstanceType<typeof electronUpdater.NsisUpdater>;
  private state: UpdateState;
  private readonly preferences: UpdatePreferences;

  constructor(root: string) {
    const currentVersion = app.getVersion();
    this.preferences = new UpdatePreferences(root);
    const channel = this.preferences.read();
    this.state = {
      status: "disabled",
      currentVersion,
      channel,
      message: app.isPackaged
        ? "更新配布先が未設定です。"
        : "開発版では自動更新を使用しません。",
    };
    if (!app.isPackaged) return;
    try {
      const source = resolveUpdateSource(
        this.packagedUpdateConfig(),
        process.env.MANGAI_UPDATE_URL,
      );
      if (!source) return;
      const { NsisUpdater } = electronUpdater;
      this.updater = new NsisUpdater(source);
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : "更新設定が不正です。",
      );
      return;
    }
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.applyChannel(channel);
    this.bindEvents();
    this.setState({ status: "idle", message: "更新を確認できます。" });
  }

  private packagedUpdateConfig() {
    try {
      return JSON.parse(
        fs.readFileSync(
          path.join(process.resourcesPath, "update-config.json"),
          "utf8",
        ),
      ) as unknown;
    } catch {
      return null;
    }
  }

  private applyChannel(channel: UpdateChannel) {
    if (!this.updater) return;
    this.updater.channel = channel === "beta" ? "beta" : "latest";
    this.updater.allowPrerelease = channel === "beta";
    this.updater.allowDowngrade = true;
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

  setChannel(channel: UpdateChannel) {
    if (
      this.state.status === "checking" ||
      this.state.status === "downloading" ||
      this.state.status === "downloaded"
    )
      throw new Error("更新処理中はチャンネルを変更できません。");
    const value = this.preferences.write(channel);
    this.applyChannel(value);
    this.setState({
      status: this.updater ? "idle" : "disabled",
      channel: value,
      availableVersion: undefined,
      percent: undefined,
      message: this.updater
        ? `${value === "beta" ? "Beta" : "Stable"}チャンネルへ変更しました。更新を確認してください。`
        : this.state.message,
    });
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

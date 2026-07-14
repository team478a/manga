import React from "react";
import type { UpdateState } from "../../../preload/api";

const initialState: UpdateState = {
  status: "disabled",
  currentVersion: "",
  channel: "stable",
  message: "更新状態を確認しています。",
};

export function UpdateControl() {
  const [state, setState] = React.useState(initialState);

  React.useEffect(() => {
    void window.mangai.updater.getState().then(setState);
    return window.mangai.updater.onStatus(setState);
  }, []);

  const action = async () => {
    if (state.status === "available") {
      setState(await window.mangai.updater.download());
      return;
    }
    if (state.status === "downloaded") {
      if (confirm("MANGAI Desktopを再起動して更新を適用しますか？"))
        await window.mangai.updater.install();
      return;
    }
    setState(await window.mangai.updater.check());
  };

  const label =
    state.status === "checking"
      ? "更新確認中…"
      : state.status === "available"
        ? `v${state.availableVersion}を取得`
        : state.status === "downloading"
          ? `更新 ${Math.round(state.percent ?? 0)}%`
          : state.status === "downloaded"
            ? "再起動して更新"
            : "更新確認";

  const channelLocked =
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "downloaded";

  const changeChannel = async (channel: "stable" | "beta") => {
    try {
      setState(await window.mangai.updater.setChannel(channel));
    } catch {
      setState(await window.mangai.updater.getState());
      alert("更新チャンネルを保存できませんでした。");
    }
  };

  return (
    <span className="update-control">
      <label title="Stableは正式版のみ、Betaは正式公開前の更新も受け取ります。">
        <span className="sr-only">更新チャンネル</span>
        <select
          aria-label="更新チャンネル"
          value={state.channel}
          disabled={channelLocked}
          onChange={(event) =>
            void changeChannel(event.target.value as "stable" | "beta")
          }
        >
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
        </select>
      </label>
      <button
        className={
          state.status === "available" || state.status === "downloaded"
            ? "update-ready"
            : "secondary"
        }
        disabled={
          state.status === "disabled" ||
          state.status === "checking" ||
          state.status === "downloading"
        }
        title={`${state.message}${state.currentVersion ? ` 現在: v${state.currentVersion}` : ""}`}
        onClick={() => void action()}
      >
        {label}
      </button>
    </span>
  );
}

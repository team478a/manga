import React from "react";
import type { UpdateState } from "../../../preload/api";

const initialState: UpdateState = {
  status: "disabled",
  currentVersion: "",
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

  return (
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
  );
}

import React from "react";
import type { UpdateState } from "../../../preload/api";
import { useI18n } from "../../i18n";

const initialState: UpdateState = {
  status: "disabled",
  currentVersion: "",
  channel: "stable",
  message: "",
};

export function UpdateControl() {
  const { t, localizeMessage } = useI18n();
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
      if (confirm(t("updater.applyConfirm")))
        await window.mangai.updater.install();
      return;
    }
    setState(await window.mangai.updater.check());
  };

  const label =
    state.status === "checking"
      ? t("updater.checking")
      : state.status === "available"
        ? t("updater.download", {
            version: state.availableVersion ?? "",
          })
        : state.status === "downloading"
          ? t("updater.downloading", {
              percent: Math.round(state.percent ?? 0),
            })
          : state.status === "downloaded"
            ? t("updater.restart")
            : t("updater.check");

  const channelLocked =
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "downloaded";

  const changeChannel = async (channel: "stable" | "beta") => {
    try {
      setState(await window.mangai.updater.setChannel(channel));
    } catch {
      setState(await window.mangai.updater.getState());
      alert(t("updater.channelSaveFailed"));
    }
  };

  return (
    <span className="update-control">
      <label title={t("updater.channelHelp")}>
        <span className="sr-only">{t("updater.channel")}</span>
        <select
          aria-label={t("updater.channel")}
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
        title={`${state.status === "error" && state.message ? localizeMessage(state.message) : label}${
          state.currentVersion
            ? ` ${t("updater.currentVersion", {
                version: state.currentVersion,
              })}`
            : ""
        }`}
        aria-live="polite"
        onClick={() => void action()}
      >
        {label}
      </button>
    </span>
  );
}

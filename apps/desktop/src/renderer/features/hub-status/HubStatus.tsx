import React from "react";
import type {
  HubDeviceState,
  HubStatus as HubStatusResult,
} from "../../../preload/api";

const STORAGE_KEY = "mangai.hub-base-url";
const DEFAULT_HUB_URL = "http://localhost:3000";

function initialBaseUrl() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_HUB_URL;
  } catch {
    return DEFAULT_HUB_URL;
  }
}

export function HubStatus({
  projectId,
  projectTitle,
  onClose,
}: {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}) {
  const [baseUrl, setBaseUrl] = React.useState(initialBaseUrl);
  const [status, setStatus] = React.useState<HubStatusResult | null>(null);
  const [device, setDevice] = React.useState<HubDeviceState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const check = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await window.mangai.hubStatus(projectId, baseUrl);
      setStatus(result);
      try {
        localStorage.setItem(STORAGE_KEY, baseUrl.trim());
      } catch {
        // ローカル設定を保存できない環境でも照会は継続する。
      }
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [baseUrl, projectId]);

  React.useEffect(() => {
    void window.mangai
      .hubDeviceState()
      .then(setDevice)
      .then(() => check());
  }, []);

  React.useEffect(() => {
    if (device?.status !== "pending") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await window.mangai.pollHubDeviceAuthorization();
        setDevice(next);
        if (next.status === "approved") await check();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [device?.status, check]);

  const publicUrl =
    status?.linked === true && status.work.isPublic
      ? `${baseUrl.trim().replace(/\/+$/, "")}${status.work.path}`
      : "";
  const verificationUrl = device
    ? `${device.baseUrl.replace(/\/+$/, "")}${device.verificationPath}`
    : "";

  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>← ワークスペース</button>
        <h1>Hub連携</h1>
        <span>読み取り専用</span>
      </header>
      <div className="tool-content hub-content">
        <section className="panel-lite">
          <div className="setting-title">
            <div>
              <h2>公開状況を確認</h2>
              <p>{projectTitle}</p>
            </div>
            <span className="hub-readonly-badge">
              {device?.status === "approved" ? "端末認証済み" : "公開情報のみ"}
            </span>
          </div>
          <label>
            MANGAI Hub URL
            <div className="inline hub-url-row">
              <input
                type="url"
                spellCheck={false}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://hub.example.com"
              />
              <button disabled={busy || !baseUrl.trim()} onClick={check}>
                {busy ? "確認中…" : "再確認"}
              </button>
            </div>
          </label>
          <small className="hub-help">
            本番URLはHTTPSを指定してください。開発中はlocalhostを利用できます。
          </small>
        </section>

        <section className="panel-lite hub-device-card">
          <div className="setting-title">
            <div>
              <h2>Desktop端末認証</h2>
              <p>
                認証すると、自分の非公開下書きも読み取り専用で確認できます。
              </p>
            </div>
            {device?.status === "approved" ? (
              <button
                className="secondary"
                onClick={async () => {
                  await window.mangai.disconnectHubDevice();
                  setDevice(null);
                  await check();
                }}
              >
                認証を解除
              </button>
            ) : (
              <button
                disabled={busy || !baseUrl.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setDevice(
                      await window.mangai.startHubDeviceAuthorization(baseUrl),
                    );
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : String(cause),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                端末認証を開始
              </button>
            )}
          </div>
          {device?.status === "pending" && (
            <div className="hub-pairing">
              <p>Hubへログインし、次のコードを15分以内に承認してください。</p>
              <strong>{device.userCode}</strong>
              <code>{verificationUrl}</code>
              <button
                className="secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(verificationUrl)
                }
              >
                承認URLをコピー
              </button>
              <small>承認を待っています。確認は自動的に更新されます。</small>
            </div>
          )}
          {device?.status === "approved" && (
            <div className="notice">
              読み取り専用で認証済みです。有効期限:{" "}
              {device.tokenExpiresAt
                ? new Date(device.tokenExpiresAt).toLocaleString("ja-JP")
                : "確認中"}
            </div>
          )}
          {device &&
            ["denied", "expired", "revoked"].includes(device.status) && (
              <div className="error">
                認証は無効または期限切れです。もう一度開始してください。
              </div>
            )}
        </section>

        {error && <div className="error">{error}</div>}

        {!error && busy && !status && (
          <section className="panel-lite hub-state-card">
            <p>Hubの公開状況を確認しています…</p>
          </section>
        )}

        {!error && status?.linked === false && (
          <section className="panel-lite hub-state-card unpublished">
            <b>対応するHub作品を確認できません</b>
            <p>{status.message}</p>
            <small>
              Hubへ販売パッケージを取り込んでください。未認証の場合、非公開下書きはこの画面には表示されません。
            </small>
          </section>
        )}

        {status?.linked === true && (
          <section className="panel-lite hub-state-card published">
            <div className="hub-status-heading">
              <span>
                {status.work.isPublic
                  ? "公開中"
                  : status.work.status === "draft"
                    ? "非公開下書き"
                    : "非公開"}
              </span>
              <small>
                最終更新:{" "}
                {new Date(status.work.updatedAt).toLocaleString("ja-JP")}
              </small>
            </div>
            <h2>{status.work.title}</h2>
            <dl className="hub-status-grid">
              <div>
                <dt>作品状態</dt>
                <dd>{status.work.isPublic ? "公開" : "非公開"}</dd>
              </div>
              <div>
                <dt>販売中の商品</dt>
                <dd>{status.sales.activeProductCount}件</dd>
              </div>
              <div>
                <dt>停止中の商品</dt>
                <dd>{status.sales.pausedProductCount}件</dd>
              </div>
              <div>
                <dt>販売状態</dt>
                <dd>{status.sales.available ? "購入可能" : "販売準備中"}</dd>
              </div>
            </dl>
            {publicUrl && (
              <div className="hub-public-url">
                <code>{publicUrl}</code>
                <button
                  className="secondary"
                  onClick={() => void navigator.clipboard.writeText(publicUrl)}
                >
                  URLをコピー
                </button>
              </div>
            )}
          </section>
        )}

        <section className="panel-lite hub-security-note">
          <h2>安全な連携範囲</h2>
          <p>
            未認証時は公開情報だけを照会します。認証後のトークンはOS機能で暗号化し、編集・公開・決済には使用できません。Hubのログイン情報、Supabase
            Service Role Key、Stripe Secret KeyはDesktopへ保存しません。
          </p>
          <small>Project ID: {projectId}</small>
        </section>
      </div>
    </main>
  );
}

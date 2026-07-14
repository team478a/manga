import React from "react";
import type { HubStatus as HubStatusResult } from "../../../preload/api";

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
    void check();
  }, []);

  const publicUrl =
    status?.linked === true
      ? `${baseUrl.trim().replace(/\/+$/, "")}${status.work.path}`
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
            <span className="hub-readonly-badge">公開情報のみ</span>
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

        {error && <div className="error">{error}</div>}

        {!error && busy && !status && (
          <section className="panel-lite hub-state-card">
            <p>Hubの公開状況を確認しています…</p>
          </section>
        )}

        {!error && status?.linked === false && (
          <section className="panel-lite hub-state-card unpublished">
            <b>公開作品はまだ確認できません</b>
            <p>{status.message}</p>
            <small>
              Hubへ販売パッケージを取り込み、作品を公開した後に再確認してください。非公開下書きはこの画面には表示されません。
            </small>
          </section>
        )}

        {status?.linked === true && (
          <section className="panel-lite hub-state-card published">
            <div className="hub-status-heading">
              <span>公開中</span>
              <small>
                最終更新:{" "}
                {new Date(status.work.updatedAt).toLocaleString("ja-JP")}
              </small>
            </div>
            <h2>{status.work.title}</h2>
            <dl className="hub-status-grid">
              <div>
                <dt>公開作品</dt>
                <dd>1件</dd>
              </div>
              <div>
                <dt>販売中の商品</dt>
                <dd>{status.sales.activeProductCount}件</dd>
              </div>
              <div>
                <dt>販売状態</dt>
                <dd>{status.sales.available ? "購入可能" : "販売準備中"}</dd>
              </div>
            </dl>
            <div className="hub-public-url">
              <code>{publicUrl}</code>
              <button
                className="secondary"
                onClick={() => void navigator.clipboard.writeText(publicUrl)}
              >
                URLをコピー
              </button>
            </div>
          </section>
        )}

        <section className="panel-lite hub-security-note">
          <h2>安全な連携範囲</h2>
          <p>
            Desktopからは公開済み作品だけを照会します。Hubのログイン情報、Supabase
            Service Role Key、Stripe Secret KeyはDesktopへ保存しません。
          </p>
          <small>Project ID: {projectId}</small>
        </section>
      </div>
    </main>
  );
}

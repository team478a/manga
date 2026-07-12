import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import type { Project, ProjectBundle, Page, Asset } from "@mangai/project-core";

const emptyForm = {
  title: "",
  subtitle: "",
  description: "",
  genre: "",
  ageRating: "全年齢" as const,
  readingDirection: "rtl" as const,
  width: 1600,
  height: 2400,
  dpi: 300,
  storagePath: "",
};
function App() {
  const [projects, setProjects] = React.useState<Project[]>([]),
    [projectCovers, setProjectCovers] = React.useState<Record<string, string>>(
      {},
    ),
    [bundle, setBundle] = React.useState<ProjectBundle | null>(null),
    [selectedEpisode, setSelectedEpisode] = React.useState<string | null>(null),
    [selectedPage, setSelectedPage] = React.useState<string | null>(null),
    [selectedAsset, setSelectedAsset] = React.useState<string | null>(null),
    [form, setForm] = React.useState(emptyForm),
    [creating, setCreating] = React.useState(false),
    [error, setError] = React.useState(""),
    [saving, setSaving] = React.useState("保存済み"),
    [zoom, setZoom] = React.useState(70),
    [assetUrls, setAssetUrls] = React.useState<Record<string, string>>({});
  const showError = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  const refresh = () =>
    window.mangai.listProjects().then(async (items) => {
      setProjects(items);
      const covers = await Promise.all(
        items.map(
          async (project) =>
            [project.id, await window.mangai.projectCover(project.id)] as const,
        ),
      );
      setProjectCovers(
        Object.fromEntries(
          covers.filter(
            (entry): entry is readonly [string, string] => entry[1] !== null,
          ),
        ),
      );
    });
  React.useEffect(() => {
    void refresh();
  }, []);
  React.useEffect(() => {
    if (!bundle) return;
    Promise.all(
      bundle.assets.map(
        async (a) =>
          [a.id, await window.mangai.assetUrl(a.relativePath)] as const,
      ),
    )
      .then((xs) => setAssetUrls(Object.fromEntries(xs)))
      .catch(showError);
  }, [bundle?.assets]);
  const apply = (p: Promise<ProjectBundle>) =>
    p
      .then((b) => {
        setBundle(b);
        setSelectedEpisode((current) =>
          current && b.episodes.some((episode) => episode.id === current)
            ? current
            : (b.episodes[0]?.id ?? null),
        );
        setSelectedPage((x) =>
          x && b.pages.some((p) => p.id === x) ? x : (b.pages[0]?.id ?? null),
        );
        void refresh();
        setSaving("保存済み");
      })
      .catch(showError);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    await apply(
      window.mangai.createProject({
        ...form,
        storagePath: form.storagePath || undefined,
      }),
    );
    setCreating(false);
  };
  if (!bundle)
    return (
      <main className="home">
        <header>
          <div>
            <b>MANGAI Desktop</b>
            <span>漫画制作プロジェクト</span>
          </div>
          <button onClick={() => setCreating(true)}>＋ 新規プロジェクト</button>
        </header>
        {error && <div className="error">{error}</div>}
        {creating && (
          <form className="modal" onSubmit={create}>
            <h2>新規プロジェクト</h2>
            <label>
              タイトル
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              サブタイトル
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </label>
            <label>
              説明
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <div className="grid">
              <label>
                ジャンル
                <input
                  value={form.genre}
                  onChange={(e) => setForm({ ...form, genre: e.target.value })}
                />
              </label>
              <label>
                対象年齢
                <select
                  value={form.ageRating}
                  onChange={(e) =>
                    setForm({ ...form, ageRating: e.target.value as any })
                  }
                >
                  <option>全年齢</option>
                  <option>12歳以上</option>
                  <option>15歳以上</option>
                  <option>成人向け</option>
                </select>
              </label>
              <label>
                読み方向
                <select
                  value={form.readingDirection}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      readingDirection: e.target.value as any,
                    })
                  }
                >
                  <option value="rtl">右開き</option>
                  <option value="ltr">左開き</option>
                </select>
              </label>
              <label>
                幅
                <input
                  type="number"
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: +e.target.value })}
                />
              </label>
              <label>
                高さ
                <input
                  type="number"
                  value={form.height}
                  onChange={(e) =>
                    setForm({ ...form, height: +e.target.value })
                  }
                />
              </label>
              <label>
                DPI
                <input
                  type="number"
                  value={form.dpi}
                  onChange={(e) => setForm({ ...form, dpi: +e.target.value })}
                />
              </label>
            </div>
            <label>
              保存先（空欄でDocuments/MANGAI/projects）
              <input
                value={form.storagePath}
                onChange={(e) =>
                  setForm({ ...form, storagePath: e.target.value })
                }
              />
            </label>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setCreating(false)}
              >
                キャンセル
              </button>
              <button>作成</button>
            </footer>
          </form>
        )}
        <section className="projects">
          <h1>最近開いたプロジェクト</h1>
          {projects.length ? (
            projects.map((p) => (
              <article
                key={p.id}
                onClick={() => apply(window.mangai.openProject(p.id))}
              >
                <div className="cover">
                  {projectCovers[p.id] ? (
                    <img src={projectCovers[p.id]} alt="" />
                  ) : (
                    "M"
                  )}
                </div>
                <div>
                  <h2>{p.title}</h2>
                  <p>{p.subtitle || p.description || "説明なし"}</p>
                  <small>
                    更新: {new Date(p.updatedAt).toLocaleString("ja-JP")}
                  </small>
                </div>
                <div className="actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void apply(window.mangai.duplicateProject(p.id));
                    }}
                  >
                    複製
                  </button>
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`「${p.title}」をゴミ箱へ移動しますか？`))
                        window.mangai
                          .deleteProject(p.id)
                          .then(refresh)
                          .catch(showError);
                    }}
                  >
                    削除
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty">プロジェクトはまだありません。</div>
          )}
        </section>
      </main>
    );
  const episode =
      bundle.episodes.find((item) => item.id === selectedEpisode) ??
      bundle.episodes[0],
    pages = bundle.pages
      .filter((p) => p.episodeId === episode?.id)
      .sort((a, b) => a.orderIndex - b.orderIndex),
    page = pages.find((p) => p.id === selectedPage),
    asset = bundle.assets.find(
      (a) => a.id === (page?.imageAssetId || selectedAsset),
    );
  return (
    <main
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length)
          void apply(
            window.mangai.importDroppedAssets(bundle.project.id, [
              ...e.dataTransfer.files,
            ]),
          );
      }}
    >
      <header className="toolbar">
        <button className="secondary" onClick={() => setBundle(null)}>
          ← プロジェクト
        </button>
        <strong>{bundle.project.title}</strong>
        <span className="status">● {saving}</span>
        <span className="spacer" />
        <button disabled>元に戻す</button>
        <button disabled>やり直す</button>
        <button
          onClick={() => apply(window.mangai.pickAssets(bundle.project.id))}
        >
          インポート
        </button>
        <button
          onClick={async () => {
            try {
              setSaving("書き出し中…");
              const result = await window.mangai.exportProject(
                bundle.project.id,
              );
              setSaving("保存済み");
              alert(
                `書き出しました:\n${result.outputDir}${result.warnings.length ? `\n\n注意:\n${result.warnings.join("\n")}` : ""}`,
              );
            } catch (cause) {
              setSaving("書き出し失敗");
              showError(cause);
            }
          }}
        >
          書き出し
        </button>
        <button disabled>設定</button>
      </header>
      {error && (
        <div className="error floating" onClick={() => setError("")}>
          {error}
        </div>
      )}
      <div className="workspace">
        <aside className="left">
          <section>
            <h3>プロジェクト</h3>
            <button className="row active">{bundle.project.title}</button>
          </section>
          <section>
            <h3>
              エピソード{" "}
              <button
                onClick={() => {
                  const t = prompt("エピソード名", "新しいエピソード");
                  if (t)
                    void apply(
                      window.mangai.createEpisode(bundle.project.id, t),
                    );
                }}
              >
                ＋
              </button>
            </h3>
            {bundle.episodes.map((e) => (
              <button
                className={`row ${e.id === episode?.id ? "active" : ""}`}
                key={e.id}
                onClick={() => {
                  setSelectedEpisode(e.id);
                  const firstPage = bundle.pages
                    .filter((page) => page.episodeId === e.id)
                    .sort((a, b) => a.orderIndex - b.orderIndex)[0];
                  setSelectedPage(firstPage?.id ?? null);
                }}
              >
                {e.title}
              </button>
            ))}
          </section>
          <section className="grow">
            <h3>
              ページ{" "}
              <button
                onClick={() =>
                  episode && apply(window.mangai.addPage(episode.id))
                }
              >
                ＋
              </button>
            </h3>
            {pages.map((p, i) => (
              <div
                className={`page-row ${p.id === selectedPage ? "active" : ""}`}
                key={p.id}
                onClick={() => setSelectedPage(p.id)}
              >
                <span>
                  {assetUrls[p.imageAssetId || ""] ? (
                    <img src={assetUrls[p.imageAssetId || ""]} />
                  ) : (
                    "□"
                  )}
                </span>
                <b>{p.pageNumber}</b>
                <button
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = pages.map((x) => x.id);
                    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                    void apply(window.mangai.reorderPages(episode.id, ids));
                  }}
                >
                  ↑
                </button>
                <button
                  disabled={i === pages.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = pages.map((x) => x.id);
                    [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                    void apply(window.mangai.reorderPages(episode.id, ids));
                  }}
                >
                  ↓
                </button>
              </div>
            ))}
          </section>
          <section className="assets">
            <h3>素材 ({bundle.assets.length})</h3>
            <div className="asset-grid">
              {bundle.assets.map((a) => (
                <button
                  key={a.id}
                  title={a.fileName}
                  className={a.id === selectedAsset ? "active" : ""}
                  onClick={() => setSelectedAsset(a.id)}
                >
                  <img src={assetUrls[a.id]} />
                  <small>{a.fileName}</small>
                </button>
              ))}
            </div>
            {episode && bundle.assets.length > 0 && (
              <button
                className="wide"
                onClick={async () => {
                  let b = bundle;
                  for (const a of bundle.assets)
                    b = await window.mangai.addPage(episode.id, a.id);
                  setBundle(b);
                  setSelectedPage(b.pages.at(-1)?.id || null);
                }}
              >
                全素材を連続ページ化
              </button>
            )}
          </section>
        </aside>
        <section className="canvas">
          <div className="zoom">
            <button onClick={() => setZoom(Math.max(20, zoom - 10))}>−</button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom(Math.min(200, zoom + 10))}>
              ＋
            </button>
            <button onClick={() => setZoom(70)}>リセット</button>
          </div>
          {page ? (
            <div
              className="paper"
              style={{
                width: `${zoom}%`,
                aspectRatio: `${page.width}/${page.height}`,
                background: page.backgroundColor,
              }}
            >
              {asset && <img src={assetUrls[asset.id]} alt={asset.fileName} />}
            </div>
          ) : (
            <div className="empty">
              ページを追加してください。素材を選び「全素材を連続ページ化」も利用できます。
            </div>
          )}
        </section>
        <Inspector
          bundle={bundle}
          page={page}
          asset={asset}
          apply={apply}
          saving={setSaving}
        />
      </div>
    </main>
  );
}

function Inspector({
  bundle,
  page,
  asset,
  apply,
  saving,
}: {
  bundle: ProjectBundle;
  page?: Page;
  asset?: Asset;
  apply: (p: Promise<ProjectBundle>) => void;
  saving: (s: string) => void;
}) {
  const [promptText, setPrompt] = React.useState(page?.prompt || ""),
    [negative, setNegative] = React.useState(page?.negativePrompt || ""),
    [notes, setNotes] = React.useState(page?.notes || "");
  React.useEffect(() => {
    setPrompt(page?.prompt || "");
    setNegative(page?.negativePrompt || "");
    setNotes(page?.notes || "");
  }, [page?.id]);
  React.useEffect(() => {
    if (!page) return;
    const t = setTimeout(() => {
      saving("保存中…");
      apply(window.mangai.savePage(page.id, promptText, negative, notes));
    }, 700);
    return () => clearTimeout(t);
  }, [promptText, negative, notes]);
  return (
    <aside className="right">
      <section>
        <h3>プロジェクト情報</h3>
        <label>
          タイトル
          <input
            defaultValue={bundle.project.title}
            onBlur={(e) => {
              if (e.target.value !== bundle.project.title)
                apply(
                  window.mangai.renameProject(
                    bundle.project.id,
                    e.target.value,
                  ),
                );
            }}
          />
        </label>
        <p>
          {bundle.project.width} × {bundle.project.height}px /{" "}
          {bundle.project.dpi}dpi
        </p>
        <p>
          {bundle.project.readingDirection === "rtl" ? "右開き" : "左開き"}・
          {bundle.project.ageRating}
        </p>
      </section>
      {page && (
        <section>
          <h3>ページ情報</h3>
          <p>
            ページ {page.pageNumber} / {page.width} × {page.height}
          </p>
          <div className="inline">
            <button onClick={() => apply(window.mangai.duplicatePage(page.id))}>
              複製
            </button>
            <button
              className="danger"
              onClick={() =>
                confirm("ページを削除しますか？") &&
                apply(window.mangai.deletePage(page.id))
              }
            >
              削除
            </button>
          </div>
          <label>
            プロンプト
            <textarea
              value={promptText}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <label>
            ネガティブプロンプト
            <textarea
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
            />
          </label>
          <label>
            メモ
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </section>
      )}
      {asset && (
        <section>
          <h3>選択画像</h3>
          <img className="preview" src={asset && undefined} />
          <p title={asset.fileName}>{asset.fileName}</p>
          <p>
            {asset.width} × {asset.height}px
          </p>
          <p>{Math.round(asset.byteSize / 1024)} KB</p>
          <div className="inline">
            {page ? null : (
              <button
                onClick={() =>
                  bundle.episodes[0] &&
                  apply(window.mangai.addPage(bundle.episodes[0].id, asset.id))
                }
              >
                ページへ追加
              </button>
            )}
            <button
              className="danger"
              onClick={() =>
                confirm("素材をゴミ箱へ移動しますか？") &&
                apply(window.mangai.deleteAsset(asset.id))
              }
            >
              素材削除
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FilePlus2,
  PencilLine,
  Plus,
  ShoppingBag,
  Trash2,
  Users,
  WandSparkles,
} from "lucide-react";
import {
  addCloudChapterAction,
  addCloudEpisodeAction,
  addCloudPageAction,
  deleteCloudProjectAction,
  deleteCloudStructureAction,
  moveCloudStructureAction,
  renameCloudEpisodeAction,
  renameCloudProjectAction,
  setCloudProjectCoverAction,
  syncCloudMarketplaceDraftAction,
} from "@/app/creator/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { getCloudMarketplaceDraft } from "@/lib/cloud-marketplace";
import {
  getCloudProductionProgress,
  getCloudManuscriptPreflight,
  getCloudProjectCharacterSheet,
  getCloudProjectWorkspace,
  listCloudPageProductionStates,
  listCloudGenerationBatches,
  listCloudProjectCheckpoints,
} from "@/lib/cloud-creator-server";
import { getCloudGenerationBatchPreflight } from "@/modules/cloud-creator/generation/batch-preflight-service";
import { listCloudExportJobs } from "@/modules/cloud-creator/export/durable-export-service";
import { LongformPageManager } from "./LongformPageManager";
import { DurableExportPanel } from "./DurableExportPanel";
import { ProjectCheckpointPanel } from "./ProjectCheckpointPanel";
import { LongformReadinessPanel } from "./LongformReadinessPanel";
import { buildCloudLongformReadiness } from "@/lib/cloud-longform-readiness";
import { ResourceNotFoundError } from "@/lib/domain-errors";

export default async function CloudProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    message?: string;
    error?: string;
    productId?: string;
  }>;
}) {
  await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  let workspace: Awaited<ReturnType<typeof getCloudProjectWorkspace>>;
  try {
    workspace = await getCloudProjectWorkspace(projectId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  const generationBatches = workspace.longform.available
    ? await listCloudGenerationBatches(projectId).catch(() => [])
    : [];
  const { project, episodes, pages, longform } = workspace;
  const [marketplaceDraft, productionProgress, characters, exportReadiness, exportHistory, checkpointHistory] = await Promise.all([
    getCloudMarketplaceDraft(projectId).catch(() => null),
    getCloudProductionProgress(projectId).catch(() => null),
    getCloudProjectCharacterSheet(projectId).catch(() => []),
    getCloudManuscriptPreflight(projectId, { requireFinalizedPages: true }).catch(() => null),
    listCloudExportJobs(projectId).catch(() => ({ available: false, jobs: [] })),
    listCloudProjectCheckpoints(projectId).catch(() => ({ available: false, restoreAvailable: false, checkpoints: [] })),
  ]);
  const pageProductionStates = longform.available
    ? await listCloudPageProductionStates(projectId, pages).catch(() => [])
    : [];
  const generationBatchPreflight = longform.available
    ? await getCloudGenerationBatchPreflight(projectId).catch(() => null)
    : null;
  const manuscript = exportReadiness ?? productionProgress?.manuscript ?? null;
  const marketplaceIsCurrent = Boolean(
    marketplaceDraft?.product && marketplaceDraft.work?.current_publication_id,
  );
  const marketplaceReady = Boolean(exportReadiness?.ready);
  const releaseCheckpoints = checkpointHistory.checkpoints.filter((item) => item.kind === "release");
  const longformReadiness = buildCloudLongformReadiness({
    manuscriptAvailable: Boolean(exportReadiness),
    manuscriptReady: Boolean(exportReadiness?.ready),
    manuscriptErrorCount: exportReadiness?.errorCount ?? 0,
    checkpointAvailable: checkpointHistory.available,
    restoreAvailable: checkpointHistory.restoreAvailable,
    checkpointCount: checkpointHistory.checkpoints.length,
    releaseCount: checkpointHistory.checkpoints.filter((item) => item.kind === "release").length,
    exportAvailable: exportHistory.available,
    completedExportCount: exportHistory.jobs.filter((item) => item.status === "completed" && item.downloadable).length,
    activeExport: exportHistory.jobs.some((item) => ["queued", "running", "paused"].includes(item.status)),
  });
  return (
    <main className="page">
      <Link className="text-leaf underline" href="/creator">
        ← 作品一覧へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <p className="mt-2 text-stone-600">
            {project.width} × {project.height}px / {project.dpi}dpi・
            {project.reading_direction === "rtl" ? "右綴じ" : "左綴じ"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button-secondary" href={`/creator/${projectId}/preview`}><BookOpen className="h-4 w-4" />原稿プレビュー</Link>
          <span className="rounded-full bg-green-50 px-4 py-2 font-semibold text-green-800">一般向け・クラウド制作</span>
        </div>
      </div>
      {query.message ? (
        <div className="mt-5 rounded-md bg-green-50 p-4 text-green-800">
          <p>{query.message}</p>
          {query.productId ? (
            <Link
              className="mt-2 inline-block font-semibold underline"
              href={`/dashboard/products/${query.productId}/edit`}
            >
              商品下書きを確認
            </Link>
          ) : null}
        </div>
      ) : null}
      {query.error ? (
        <InlineErrorMessage>
          {query.error}
        </InlineErrorMessage>
      ) : null}
      <LongformReadinessPanel readiness={longformReadiness} />
      {manuscript ? (
        <section className="panel mt-6" aria-labelledby="manuscript-status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                className="flex items-center gap-2 text-xl font-bold"
                id="manuscript-status"
              >
                {manuscript.ready ? (
                  <CheckCircle2 className="h-6 w-6 text-green-700" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-700" />
                )}
                原稿チェック
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                表紙、ページ順、空コマ、画像解像度、文字の収まり、完成モードの目安、品質検査結果を確認します。
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1 text-sm font-bold ${
                manuscript.ready
                  ? "bg-green-50 text-green-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {manuscript.ready ? "書き出し準備完了" : "修正項目あり"}
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">8ページ基準</dt>
              <dd className="mt-1 text-xl font-bold">
                {manuscript.pageCount}/{manuscript.targetPageCount}
              </dd>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <dt className="text-xs text-stone-500">画像配置済みコマ</dt>
              <dd className="mt-1 text-xl font-bold">
                {manuscript.completedPanelCount}/{manuscript.totalPanelCount}
              </dd>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <dt className="text-xs text-red-700">要修正</dt>
              <dd className="mt-1 text-xl font-bold text-red-800">
                {manuscript.errorCount}
              </dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <dt className="text-xs text-amber-700">確認推奨</dt>
              <dd className="mt-1 text-xl font-bold text-amber-900">
                {manuscript.warningCount}
              </dd>
            </div>
          </dl>
          {manuscript.issues.length ? (
            <ul className="mt-5 space-y-2">
              {manuscript.issues.slice(0, 12).map((issue, index) => (
                <li
                  className={`rounded-lg border p-3 text-sm ${
                    issue.severity === "error"
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                  key={`${issue.code}-${issue.pageId ?? "project"}-${issue.panelId ?? index}`}
                >
                  {issue.pageId ? (
                    <Link
                      className="font-semibold underline"
                      href={`/creator/${projectId}/pages/${issue.pageId}`}
                    >
                      {issue.message}
                    </Link>
                  ) : (
                    <span className="font-semibold">{issue.message}</span>
                  )}
                </li>
              ))}
              {manuscript.issues.length > 12 ||
              manuscript.truncatedIssueCount > 0 ? (
                <li className="text-sm text-stone-600">
                  ほか
                  {Math.max(0, manuscript.issues.length - 12) +
                    manuscript.truncatedIssueCount}
                  件あります。上から順に修正してください。
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">
              原稿チェックで問題は見つかりませんでした。
            </p>
          )}
        </section>
      ) : null}
      {productionProgress ? (
        <section className="panel mt-6" aria-labelledby="production-progress">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold" id="production-progress">
                <WandSparkles className="h-6 w-6 text-violet-700" />
                作品全体の生成進捗
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                ページごとの画像配置と、実行中・失敗した画像生成をまとめて確認できます。販売原稿としての完成判定は原稿プレビューで確認してください。
              </p>
            </div>
            <span className="w-fit rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-800">
              画像配置完了 {productionProgress.imageReadyPageCount}/{productionProgress.pages.length}ページ
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {productionProgress.pages.map((page) => {
              const label =
                page.status === "images_ready"
                  ? "画像配置完了"
                  : page.status === "generating"
                    ? "生成中"
                    : page.status === "needs_attention"
                      ? "要確認"
                      : "未着手";
              const style =
                page.status === "images_ready"
                  ? "border-green-200 bg-green-50 text-green-900"
                  : page.status === "generating"
                    ? "border-violet-200 bg-violet-50 text-violet-900"
                    : page.status === "needs_attention"
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-stone-200 bg-stone-50 text-stone-800";
              return (
                <Link
                  className={`rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${style}`}
                  href={`/creator/${projectId}/pages/${page.pageId}`}
                  key={page.pageId}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{page.pageNumber}ページ</strong>
                    <span className="text-xs font-bold">{label}</span>
                  </div>
                  <p className="mt-2 text-sm">
                    画像配置 {page.completedPanelCount}/{page.totalPanelCount}コマ
                  </p>
                  {page.queuedPanelCount + page.runningPanelCount > 0 ? (
                    <p className="mt-1 text-xs">
                      待機 {page.queuedPanelCount}・処理中 {page.runningPanelCount}
                    </p>
                  ) : null}
                  {page.failedPanelCount > 0 ? (
                    <p className="mt-1 text-xs font-bold">
                      再実行が必要 {page.failedPanelCount}コマ
                    </p>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
      <DurableExportPanel
        available={exportHistory.available}
        jobs={exportHistory.jobs}
        projectId={projectId}
        ready={Boolean(exportReadiness?.ready)}
      />
      <ProjectCheckpointPanel
        available={checkpointHistory.available}
        checkpoints={checkpointHistory.checkpoints}
        projectId={projectId}
        releaseReady={Boolean(exportReadiness?.ready)}
        restoreAvailable={Boolean(checkpointHistory.restoreAvailable)}
      />
      <section className="panel mt-6" aria-labelledby="character-sheet">
        <h2 className="flex items-center gap-2 text-xl font-bold" id="character-sheet">
          <Users className="h-6 w-6 text-violet-700" />
          キャラクター設定表
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          採用したシナリオの人物設定です。画像生成時の人物一貫性にも利用します。
        </p>
        <Link className="button-secondary mt-4 inline-flex" href={`/creator/${projectId}/characters`}>
          外見・衣装の設定を編集
        </Link>
        <Link className="button-secondary mt-4 ml-3 inline-flex" href={`/creator/${projectId}/bible`}>
          画風・場所・小物を設定
        </Link>
        <Link className="button-secondary mt-4 ml-3 inline-flex" href={`/creator/${projectId}/references`}>
          参照画像とコマ割当
        </Link>
        <Link className="button-secondary mt-4 ml-3 inline-flex" href={`/creator/${projectId}/continuity`}>
          一貫性をチェック
        </Link>
        <Link className="button mt-4 ml-3 inline-flex" href={`/creator/${projectId}/cockpit`}>
          長編コックピット
        </Link>
        {characters.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {characters.map((character) => (
              <article className="rounded-lg border border-violet-100 bg-violet-50/50 p-4" key={character.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold">{character.name}</h3>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-800">
                    {character.role === "protagonist"
                      ? "主人公"
                      : character.role === "antagonist"
                        ? "対立人物"
                        : "登場人物"}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                  <div><dt className="font-semibold text-stone-500">望み</dt><dd>{character.desire}</dd></div>
                  <div><dt className="font-semibold text-stone-500">恐れ</dt><dd>{character.fear}</dd></div>
                  <div><dt className="font-semibold text-stone-500">葛藤</dt><dd>{character.conflict}</dd></div>
                  <div><dt className="font-semibold text-stone-500">物語での変化</dt><dd>{character.arc}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">
            この作品にはシナリオ由来のキャラクター設定がありません。AIシナリオから作品を作成すると、ここへ自動表示されます。
          </div>
        )}
      </section>
      <details className="panel mt-6">
        <summary className="cursor-pointer text-lg font-bold">
          <PencilLine className="mr-2 inline h-5 w-5" />
          作品情報を編集
        </summary>
        <form
          action={renameCloudProjectAction.bind(null, projectId)}
          className="mt-5 space-y-4"
        >
          <div>
            <label className="label" htmlFor="title">
              作品名
            </label>
            <input
              className="field"
              id="title"
              name="title"
              defaultValue={project.title}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              説明
            </label>
            <textarea
              className="field min-h-24"
              id="description"
              name="description"
              defaultValue={project.description}
              maxLength={5000}
            />
          </div>
          <PendingSubmitButton className="button" pendingLabel="更新中…">
            更新
          </PendingSubmitButton>
        </form>
      </details>
      <form
        action={deleteCloudProjectAction.bind(null, projectId)}
        className="mt-3 text-right"
      >
        <PendingSubmitButton
          className="button-secondary text-red-700"
          pendingLabel="移動中…"
        >
          <Trash2 className="mr-2 h-5 w-5" />
          作品をゴミ箱へ移動
        </PendingSubmitButton>
      </form>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          {longform.available ? (
            <LongformPageManager
              batches={generationBatches}
              batchPreflight={generationBatchPreflight}
              coverPageId={project.cover_page_id}
              episodes={episodes}
              pages={pages}
              productionStates={pageProductionStates}
              projectId={projectId}
              readingDirection={project.reading_direction}
              structure={longform}
            />
          ) : (
          <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            32ページ構成用migrationはまだ適用されていません。既存の話・ページ編集は継続できます。
          </div>
          {episodes.map((episode) => {
            const episodePages = pages.filter(
              (page) => page.episode_id === episode.id,
            );
            return (
              <article className="panel" key={episode.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <form
                    action={renameCloudEpisodeAction.bind(
                      null,
                      projectId,
                      episode.id,
                    )}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input
                      aria-label="話の名前"
                      className="field mt-0 font-bold"
                      name="title"
                      defaultValue={episode.title}
                      required
                      maxLength={200}
                    />
                    <PendingSubmitButton
                      className="button-secondary shrink-0"
                      pendingLabel="保存中…"
                    >
                      名前を保存
                    </PendingSubmitButton>
                  </form>
                  <div className="flex gap-1">
                    <form
                      action={moveCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                        -1,
                      )}
                    >
                      <PendingSubmitButton
                        aria-label="話を上へ"
                        className="button-secondary px-3"
                        pendingLabel="移動中…"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </PendingSubmitButton>
                    </form>
                    <form
                      action={moveCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                        1,
                      )}
                    >
                      <PendingSubmitButton
                        aria-label="話を下へ"
                        className="button-secondary px-3"
                        pendingLabel="移動中…"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </PendingSubmitButton>
                    </form>
                    <form
                      action={deleteCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                      )}
                    >
                      <PendingSubmitButton
                        aria-label="話を削除"
                        className="button-secondary px-3 text-red-700"
                        pendingLabel="削除中…"
                      >
                        <Trash2 className="h-4 w-4" />
                      </PendingSubmitButton>
                    </form>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {episodePages.map((page) => (
                    <div
                      className="rounded-lg border border-stone-200 bg-linen p-3"
                      key={page.id}
                    >
                      <Link
                        className="block transition hover:text-leaf"
                        href={`/creator/${projectId}/pages/${page.id}`}
                      >
                        <span className="text-sm text-stone-500">ページ</span>
                        <strong className="mt-1 block text-xl">
                          {page.page_number}ページ
                        </strong>
                        <span className="mt-2 block text-sm text-stone-600">
                          更新番号 {page.revision}
                        </span>
                      </Link>
                      <div className="mt-3 flex gap-1 border-t border-stone-200 pt-2">
                        <form
                          action={setCloudProjectCoverAction.bind(
                            null,
                            projectId,
                            page.id,
                          )}
                        >
                          <PendingSubmitButton
                            className={`button-secondary min-h-10 px-3 py-2 text-xs ${project.cover_page_id === page.id ? "border-leaf bg-green-50 text-green-800" : ""}`}
                            pendingLabel="設定中…"
                          >
                            {project.cover_page_id === page.id
                              ? "表紙"
                              : "表紙に設定"}
                          </PendingSubmitButton>
                        </form>
                        <form
                          action={moveCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                            -1,
                          )}
                        >
                          <PendingSubmitButton
                            aria-label="ページを前へ"
                            className="button-secondary min-h-10 px-3 py-2"
                            pendingLabel="移動中…"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </PendingSubmitButton>
                        </form>
                        <form
                          action={moveCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                            1,
                          )}
                        >
                          <PendingSubmitButton
                            aria-label="ページを後へ"
                            className="button-secondary min-h-10 px-3 py-2"
                            pendingLabel="移動中…"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </PendingSubmitButton>
                        </form>
                        <form
                          action={deleteCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                          )}
                        >
                          <PendingSubmitButton
                            aria-label="ページを削除"
                            className="button-secondary min-h-10 px-3 py-2 text-red-700"
                            pendingLabel="削除中…"
                          >
                            <Trash2 className="h-4 w-4" />
                          </PendingSubmitButton>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  action={addCloudPageAction.bind(null, projectId, episode.id)}
                  className="mt-4"
                >
                  <PendingSubmitButton
                    className="button-secondary w-full"
                    pendingLabel="追加中…"
                  >
                    <FilePlus2 className="mr-2 h-5 w-5" />
                    ページを追加
                  </PendingSubmitButton>
                </form>
              </article>
            );
          })}
          </>
          )}
        </section>
        <aside className="space-y-5">
          {longform.available ? (
          <form action={addCloudChapterAction.bind(null, projectId)} className="panel">
            <h2 className="text-xl font-bold">章を追加</h2>
            <label className="label mt-4 block" htmlFor="chapter-title">章の名前</label>
            <input className="field" id="chapter-title" name="title" placeholder="第2章" required maxLength={200} />
            <PendingSubmitButton className="button mt-4 w-full" pendingLabel="追加中…"><Plus className="mr-2 h-5 w-5" />追加</PendingSubmitButton>
          </form>
          ) : (
          <form
            action={addCloudEpisodeAction.bind(null, projectId)}
            className="panel"
          >
            <h2 className="text-xl font-bold">話を追加</h2>
            <label className="label mt-4 block" htmlFor="episode-title">
              話の名前
            </label>
            <input
              className="field"
              id="episode-title"
              name="title"
              placeholder="第2話"
              required
              maxLength={200}
            />
            <PendingSubmitButton
              className="button mt-4 w-full"
              pendingLabel="追加中…"
            >
              <Plus className="mr-2 h-5 w-5" />
              追加
            </PendingSubmitButton>
          </form>
          )}
          <section className="panel">
            <h2 className="font-bold">作品の状況</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-stone-500">話数</dt>
                <dd className="text-xl font-bold">{episodes.length}</dd>
              </div>
              <div>
                <dt className="text-stone-500">ページ数</dt>
                <dd className="text-xl font-bold">{pages.length}</dd>
              </div>
              <div>
                <dt className="text-stone-500">更新番号</dt>
                <dd className="text-xl font-bold">{project.revision}</dd>
              </div>
              <div>
                <dt className="text-stone-500">使用容量</dt>
                <dd className="text-xl font-bold">
                  {Math.ceil(project.storage_bytes / 1024)} KB
                </dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <h2 className="flex items-center text-xl font-bold">
              <ShoppingBag className="mr-2 h-5 w-5" />
              販売準備へ進む
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              全ページをPDFへ再生成し、非公開作品と停止中商品を作成・更新します。公開中・販売中のデータは上書きしません。
            </p>
            {!exportReadiness ? (
              <p
                className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                id="marketplace-readiness"
              >
                原稿の完成状況を確認できないため、販売下書きは作成できません。
              </p>
            ) : !marketplaceReady ? (
              <p
                className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                id="marketplace-readiness"
              >
                原稿チェックの要修正{exportReadiness.errorCount}件を解消し、すべてのページを確定すると作成できます。
                <a className="ml-1 font-semibold underline" href="#manuscript-status">
                  原稿チェックを確認
                </a>
              </p>
            ) : null}
            {marketplaceDraft?.product ? (
              <div className="mt-4 rounded-md bg-stone-50 p-3 text-sm">
                <p className="font-semibold">
                  {marketplaceIsCurrent ? `完成版 v${marketplaceDraft?.work?.published_version ?? 1} に固定済み` : "完成版は未固定"}
                </p>
                <Link
                  className="mt-1 inline-block text-leaf underline"
                  href={`/dashboard/products/${marketplaceDraft.product.id}/edit`}
                >
                  商品下書きを確認
                </Link>
              </div>
            ) : null}
            <form
              action={syncCloudMarketplaceDraftAction.bind(null, projectId)}
              className="mt-4"
            >
              <fieldset disabled={releaseCheckpoints.length === 0}>
              <label className="label mt-4" htmlFor="marketplace-checkpoint">
                販売に固定する完成版
              </label>
              <select className="field" id="marketplace-checkpoint" name="checkpointId" required>
                {releaseCheckpoints.map((checkpoint) => (
                  <option key={checkpoint.id} value={checkpoint.id}>
                    {checkpoint.label}・{checkpoint.pageCount}ページ・{new Date(checkpoint.createdAt).toLocaleString("ja-JP")}
                  </option>
                ))}
              </select>
              <label className="label mt-4" htmlFor="marketplace-price">
                販売価格（税込円）
              </label>
              <input
                className="field"
                id="marketplace-price"
                name="price"
                type="number"
                min="0"
                max="1000000"
                defaultValue={marketplaceDraft?.product?.price ?? 500}
                required
              />
              <PendingSubmitButton
                aria-describedby={
                  marketplaceReady ? undefined : "marketplace-readiness"
                }
                className="button mt-4 w-full"
                disabled={!marketplaceReady}
                pendingLabel="作成中…"
              >
                {marketplaceDraft?.product
                  ? "下書きを再生成"
                  : "販売下書きを作成"}
              </PendingSubmitButton>
              </fieldset>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

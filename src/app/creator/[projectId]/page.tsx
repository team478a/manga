import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  FilePlus2,
  PencilLine,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import {
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
import { FlashMessage } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { getCloudMarketplaceDraft } from "@/lib/cloud-marketplace";
import { getCloudProjectWorkspace } from "@/lib/cloud-creator-server";

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
  } catch {
    notFound();
  }
  const { project, episodes, pages } = workspace;
  const marketplaceDraft = await getCloudMarketplaceDraft(projectId).catch(
    () => null,
  );
  const marketplaceIsCurrent = Boolean(
    marketplaceDraft?.product &&
      new Date(marketplaceDraft.product.updated_at).getTime() >=
        new Date(project.updated_at).getTime(),
  );
  return (
    <main className="page">
      <PageHeader
        eyebrow="Cloud Creator"
        title={project.title}
        description={`${project.width} × ${project.height}px / ${project.dpi}dpi・${
          project.reading_direction === "rtl" ? "右綴じ" : "左綴じ"
        }`}
        actions={
          <>
            <StatusBadge className="justify-center" tone="info">
              一般向けCloud
            </StatusBadge>
            <ButtonLink href="/creator" variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Project一覧へ
            </ButtonLink>
          </>
        }
      />
      <FlashMessage
        className="mt-5"
        error={query.error}
        message={query.message}
      />
      {query.message && query.productId ? (
        <ButtonLink
          className="mt-3"
          href={`/dashboard/products/${query.productId}/edit`}
          size="sm"
          variant="secondary"
        >
          商品下書きを確認
        </ButtonLink>
      ) : null}
      <details className="ui-card ui-card-default mt-6 shadow-app">
        <summary className="cursor-pointer text-lg font-bold">
          <PencilLine className="mr-2 inline h-5 w-5" />
          Project情報を編集
        </summary>
        <form
          action={renameCloudProjectAction.bind(null, projectId)}
          className="mt-5 space-y-4"
        >
          <FormField id="title" label="Project名" required>
            <input
              className="ui-field"
              id="title"
              name="title"
              defaultValue={project.title}
              required
              maxLength={200}
            />
          </FormField>
          <FormField id="description" label="説明">
            <textarea
              className="ui-field min-h-24"
              id="description"
              name="description"
              defaultValue={project.description}
              maxLength={5000}
            />
          </FormField>
          <Button type="submit">
            更新
          </Button>
        </form>
      </details>
      <form
        action={deleteCloudProjectAction.bind(null, projectId)}
        className="mt-3 text-right"
      >
        <Button type="submit" variant="danger">
          <Trash2 className="mr-2 h-5 w-5" />
          Projectをゴミ箱へ移動
        </Button>
      </form>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          {episodes.map((episode) => {
            const episodePages = pages.filter(
              (page) => page.episode_id === episode.id,
            );
            return (
              <Card className="shadow-app" key={episode.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <form
                    action={renameCloudEpisodeAction.bind(
                      null,
                      projectId,
                      episode.id,
                    )}
                    className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
                  >
                    <input
                      aria-label="Episode名"
                      className="ui-field mt-0 font-bold"
                      name="title"
                      defaultValue={episode.title}
                      required
                      maxLength={200}
                    />
                    <Button className="shrink-0" type="submit" variant="secondary">
                      名前を保存
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-1">
                    <form
                      action={moveCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                        -1,
                      )}
                    >
                      <Button
                        aria-label="Episodeを上へ"
                        className="px-3"
                        type="submit"
                        variant="secondary"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
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
                      <Button
                        aria-label="Episodeを下へ"
                        className="px-3"
                        type="submit"
                        variant="secondary"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </form>
                    <form
                      action={deleteCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                      )}
                    >
                      <Button
                        aria-label="Episodeを削除"
                        className="px-3"
                        type="submit"
                        variant="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {episodePages.map((page) => (
                    <div
                      className="rounded-xl border border-border bg-surface-muted p-3 transition hover:border-brand-200 hover:bg-brand-50"
                      key={page.id}
                    >
                      <Link
                        className="block transition hover:text-brand-700"
                        href={`/creator/${projectId}/pages/${page.id}`}
                      >
                        <span className="text-sm font-semibold text-text-muted">
                          PAGE
                        </span>
                        <strong className="mt-1 block text-xl">
                          {page.page_number}ページ
                        </strong>
                        <span className="mt-2 block text-sm text-text-secondary">
                          revision {page.revision}
                        </span>
                      </Link>
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2">
                        <form
                          action={setCloudProjectCoverAction.bind(
                            null,
                            projectId,
                            page.id,
                          )}
                        >
                          <Button
                            className={
                              project.cover_page_id === page.id
                                ? "border-brand-300 bg-brand-100 px-3 text-brand-800"
                                : "px-3"
                            }
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            {project.cover_page_id === page.id
                              ? "表紙"
                              : "表紙に設定"}
                          </Button>
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
                          <Button
                            aria-label="Pageを前へ"
                            className="px-3"
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
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
                          <Button
                            aria-label="Pageを後へ"
                            className="px-3"
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </form>
                        <form
                          action={deleteCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                          )}
                        >
                          <Button
                            aria-label="Pageを削除"
                            className="px-3"
                            size="sm"
                            type="submit"
                            variant="danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  action={addCloudPageAction.bind(null, projectId, episode.id)}
                  className="mt-4"
                >
                  <Button className="w-full" type="submit" variant="secondary">
                    <FilePlus2 className="mr-2 h-5 w-5" />
                    Pageを追加
                  </Button>
                </form>
              </Card>
            );
          })}
        </section>
        <aside className="space-y-5">
          <Card className="shadow-app">
            <form action={addCloudEpisodeAction.bind(null, projectId)}>
            <h2 className="text-xl font-bold">Episodeを追加</h2>
            <FormField
              className="mt-4"
              id="episode-title"
              label="Episode名"
              required
            >
              <input
                className="ui-field"
                id="episode-title"
                name="title"
                placeholder="第2話"
                required
                maxLength={200}
              />
            </FormField>
            <Button className="mt-4 w-full" type="submit">
              <Plus className="mr-2 h-5 w-5" />
              追加
            </Button>
            </form>
          </Card>
          <Card className="shadow-app">
            <h2 className="font-bold">Project状況</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-text-muted">Episode</dt>
                <dd className="text-xl font-bold">{episodes.length}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Page</dt>
                <dd className="text-xl font-bold">{pages.length}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Revision</dt>
                <dd className="text-xl font-bold">{project.revision}</dd>
              </div>
              <div>
                <dt className="text-text-muted">使用容量</dt>
                <dd className="text-xl font-bold">
                  {Math.ceil(project.storage_bytes / 1024)} KB
                </dd>
              </div>
            </dl>
          </Card>
          <Card className="shadow-app">
            <h2 className="flex items-center text-xl font-bold">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Marketplaceへ受け渡す
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              全PageをPDFへ再生成し、非公開作品と停止中商品を作成・更新します。公開中・販売中のデータは上書きしません。
            </p>
            {marketplaceDraft?.product ? (
              <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-sm">
                <StatusBadge tone={marketplaceIsCurrent ? "success" : "warning"}>
                  {marketplaceIsCurrent
                    ? "同期済み"
                    : "Projectに未反映の変更あり"}
                </StatusBadge>
                <ButtonLink
                  className="mt-3"
                  href={`/dashboard/products/${marketplaceDraft.product.id}/edit`}
                  size="sm"
                  variant="secondary"
                >
                  商品下書きを確認
                </ButtonLink>
              </div>
            ) : null}
            <form
              action={syncCloudMarketplaceDraftAction.bind(null, projectId)}
              className="mt-4"
            >
              <FormField
                id="marketplace-price"
                label="販売価格（税込円）"
                required
              >
                <input
                  className="ui-field"
                  id="marketplace-price"
                  name="price"
                  type="number"
                  min="0"
                  max="1000000"
                  defaultValue={marketplaceDraft?.product?.price ?? 500}
                  required
                />
              </FormField>
              <Button className="mt-4 w-full" type="submit">
                {marketplaceDraft?.product
                  ? "下書きを再生成"
                  : "販売下書きを作成"}
              </Button>
            </form>
          </Card>
        </aside>
      </div>
    </main>
  );
}

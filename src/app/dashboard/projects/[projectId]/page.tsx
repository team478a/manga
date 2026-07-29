import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import {
  setCloudWorkManagementStatusAction,
  setCloudWorkPageReviewAction,
} from "@/app/dashboard/projects/actions";
import { requireProfile } from "@/lib/auth";
import {
  cloudWorkManagementFeatureEnabled,
  cloudWorkStatusLabel,
} from "@/lib/cloud-work-management";
import { getCloudWorkManagementDetail } from "@/lib/cloud-work-management-server";
import { cloudSalesPreparationFeatureEnabled } from "@/lib/cloud-sales-preparation";

export default async function CloudProjectManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  if (!cloudWorkManagementFeatureEnabled()) notFound();
  const detail = await getCloudWorkManagementDetail(
    profile.id,
    projectId,
  ).catch(() => null);
  if (!detail) notFound();
  const { project, state, pages, reviews, readiness } = detail;
  const reviewsByPage = new Map(
    reviews.map((review) => [review.page_id, review]),
  );
  const approvalIsCurrent =
    state.expected_project_revision === project.revision;
  const effectiveStatus = approvalIsCurrent ? state.status : "draft";
  const salesPreparationEnabled = cloudSalesPreparationFeatureEnabled();
  return (
    <main className="page max-w-7xl">
      <Link className="text-violet-700 underline" href="/dashboard/projects">
        ← 作品管理一覧へ
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">公開前作品管理</p>
          <h1 className="mt-2 text-3xl font-bold">{project.title}</h1>
          <p className="mt-2 text-stone-600">
            Project revision {project.revision}・{pages.length}Page
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-800">
          {cloudWorkStatusLabel(effectiveStatus)}
        </span>
      </div>
      {query.message ? (
        <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800">
          {query.message}
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {query.error}
        </p>
      ) : null}
      {!approvalIsCurrent && state.status !== "draft" ? (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900">
          承認後にProjectが更新されました。現行revisionを再確認してください。
        </p>
      ) : null}

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">Page確認</h2>
                <p className="mt-1 text-sm text-stone-600">
                  {readiness.reviewedPages}/{readiness.totalPages}Pageを現行revisionで確認済み
                </p>
              </div>
              <Link
                className="button-secondary"
                href={`/creator/${project.id}`}
              >
                Creatorで編集
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pages.map((page) => {
              const review = reviewsByPage.get(page.id);
              const reviewed = review?.page_revision === page.revision;
              return (
                <article className="panel" key={page.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-stone-400">PAGE</p>
                      <h3 className="mt-1 text-xl font-bold">
                        {page.page_number}ページ
                      </h3>
                      <p className="mt-1 text-sm text-stone-500">
                        revision {page.revision}
                      </p>
                    </div>
                    {reviewed ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-stone-300" />
                    )}
                  </div>
                  <form action={setCloudWorkPageReviewAction} className="mt-4">
                    <input name="projectId" type="hidden" value={project.id} />
                    <input name="pageId" type="hidden" value={page.id} />
                    <input
                      name="reviewed"
                      type="hidden"
                      value={reviewed ? "false" : "true"}
                    />
                    {!reviewed ? (
                      <>
                        <label className="label" htmlFor={`note-${page.id}`}>
                          確認メモ（任意）
                        </label>
                        <input
                          className="field"
                          id={`note-${page.id}`}
                          name="note"
                          maxLength={500}
                          defaultValue={review?.note ?? ""}
                          placeholder="修正点や確認内容"
                        />
                      </>
                    ) : (
                      <input name="note" type="hidden" value="" />
                    )}
                    <button
                      className="button-secondary mt-3 w-full"
                      type="submit"
                    >
                      {reviewed ? (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          確認を取り消す
                        </>
                      ) : (
                        "このPageを確認済みにする"
                      )}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="panel">
            <h2 className="text-xl font-bold">公開前チェック</h2>
            <ul className="mt-4 space-y-3">
              {readiness.checks.map((check) => (
                <li className="flex items-start gap-2 text-sm" key={check.key}>
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" />
                  )}
                  <span className={check.passed ? "" : "text-stone-500"}>
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <form action={setCloudWorkManagementStatusAction} className="panel">
            <input name="projectId" type="hidden" value={project.id} />
            <input
              name="expectedRevision"
              type="hidden"
              value={project.revision}
            />
            <label className="label" htmlFor="release-notes">
              販売準備への引継ぎメモ
            </label>
            <textarea
              className="field min-h-28"
              id="release-notes"
              name="releaseNotes"
              maxLength={5000}
              defaultValue={state.release_notes}
              placeholder="価格、紹介文、販売時の注意点など"
            />
            {effectiveStatus === "draft" ? (
              <button
                className="button mt-4 w-full"
                disabled={!readiness.ready}
                name="status"
                type="submit"
                value="review_ready"
              >
                公開前確認を完了
              </button>
            ) : effectiveStatus === "review_ready" ? (
              <>
                <button
                  className="button mt-4 w-full"
                  disabled={!readiness.ready}
                  name="status"
                  type="submit"
                  value="approved"
                >
                  販売準備へ進むことを承認
                </button>
                <button
                  className="button-secondary mt-3 w-full"
                  name="status"
                  type="submit"
                  value="draft"
                >
                  確認中へ戻す
                </button>
              </>
            ) : (
              <>
                <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
                  Release 6「販売準備」へ進める状態です。
                </div>
                <button
                  className="button-secondary mt-3 w-full"
                  name="status"
                  type="submit"
                  value="draft"
                >
                  確認中へ戻す
                </button>
              </>
            )}
            {!readiness.ready ? (
              <p className="mt-3 text-xs text-stone-500">
                未完了のチェックをすべて満たすと状態を進められます。
              </p>
            ) : null}
          </form>
          {effectiveStatus === "approved" ? (
            <div className="panel border-violet-200">
              <p className="text-sm font-bold text-violet-800">
                次工程の準備完了
              </p>
              <p className="mt-2 text-sm text-stone-600">
                Release 6ではPDF、表紙、作品・商品差分を確認して販売下書きを作成します。
              </p>
              {salesPreparationEnabled ? (
                <Link
                  className="button mt-4 w-full"
                  href={`/dashboard/sales-preparation/${project.id}`}
                >
                  販売準備へ進む
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              ) : (
                <span className="button-secondary mt-4 w-full text-stone-400">
                  販売準備は停止中
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

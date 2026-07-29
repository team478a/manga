import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  ImageIcon,
} from "lucide-react";
import { syncCloudSalesPreparationAction } from "@/app/dashboard/sales-preparation/actions";
import { requireProfile } from "@/lib/auth";
import { cloudSalesPreparationFeatureEnabled } from "@/lib/cloud-sales-preparation";
import { getCloudSalesPreparationDetail } from "@/lib/cloud-sales-preparation-server";
import { yen } from "@/lib/format";

export default async function CloudSalesPreparationDetailPage({
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
  const { profile } = await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  if (!cloudSalesPreparationFeatureEnabled()) notFound();
  const detail = await getCloudSalesPreparationDetail(
    profile.id,
    projectId,
  ).catch(() => null);
  if (!detail) notFound();
  const { project, approval, preparation, draft, status, eligible } = detail;
  return (
    <main className="page max-w-6xl">
      <Link
        className="text-violet-700 underline"
        href="/dashboard/sales-preparation"
      >
        ← 販売準備一覧へ
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">販売準備</p>
          <h1 className="mt-2 text-3xl font-bold">{project.title}</h1>
          <p className="mt-2 text-stone-600">
            Project revision {project.revision}・承認revision{" "}
            {approval.expected_project_revision ?? "なし"}
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-800">
          {status}
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

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <article className="panel">
            <h2 className="text-xl font-bold">同期内容</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-violet-50 p-4">
                <dt className="flex items-center gap-2 text-sm text-stone-600">
                  <ImageIcon className="h-4 w-4" />
                  作品表紙
                </dt>
                <dd className="mt-2 font-bold">表紙PageからPNG生成</dd>
              </div>
              <div className="rounded-lg bg-violet-50 p-4">
                <dt className="flex items-center gap-2 text-sm text-stone-600">
                  <FileText className="h-4 w-4" />
                  販売ファイル
                </dt>
                <dd className="mt-2 font-bold">全PageをPDF生成</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-lg border border-stone-200 p-4">
              <p className="text-sm font-bold">作品情報</p>
              <p className="mt-2 text-sm text-stone-600">
                {project.description}
              </p>
              <p className="mt-3 text-sm text-stone-500">
                同期後も作品は非公開、商品は販売停止中です。
              </p>
            </div>
          </article>
          <article className="panel">
            <h2 className="text-xl font-bold">既存下書きとの差分</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                {
                  label: "作品下書き",
                  value: draft.work
                    ? `${draft.work.is_public ? "公開" : "非公開"}・${draft.work.status}`
                    : "未作成",
                  passed:
                    !draft.work?.is_public &&
                    draft.work?.status !== "published",
                },
                {
                  label: "商品下書き",
                  value: draft.product
                    ? `${yen(draft.product.price)}・${draft.product.status}`
                    : "未作成",
                  passed: draft.product?.status !== "active",
                },
                {
                  label: "同期revision",
                  value: preparation
                    ? `${preparation.project_revision}`
                    : "未同期",
                  passed:
                    preparation?.project_revision === project.revision,
                },
              ].map((item) => (
                <li
                  className="flex items-start justify-between gap-4 border-b border-stone-100 pb-3"
                  key={item.label}
                >
                  <span className="flex items-center gap-2">
                    {item.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-stone-300" />
                    )}
                    {item.label}
                  </span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
            {draft.work ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="button-secondary"
                  href={`/dashboard/works/${draft.work.id}/edit`}
                >
                  作品を確認
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
                {draft.product ? (
                  <Link
                    className="button-secondary"
                    href={`/dashboard/products/${draft.product.id}/edit`}
                  >
                    商品を確認
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            ) : null}
          </article>
        </section>

        <aside className="space-y-5">
          <form action={syncCloudSalesPreparationAction} className="panel">
            <input name="projectId" type="hidden" value={project.id} />
            <input
              name="expectedRevision"
              type="hidden"
              value={project.revision}
            />
            <h2 className="text-xl font-bold">販売下書きを同期</h2>
            <label className="label mt-5 block" htmlFor="sales-price">
              販売価格（税込円）
            </label>
            <input
              className="field"
              id="sales-price"
              name="price"
              type="number"
              min="0"
              max="1000000"
              defaultValue={preparation?.price ?? draft.product?.price ?? 500}
              required
            />
            <button
              className="button mt-4 w-full"
              disabled={!eligible}
              type="submit"
            >
              {preparation ? "販売下書きを再同期" : "販売下書きを作成"}
            </button>
            {!eligible ? (
              <p className="mt-3 text-xs text-stone-500">
                現行revisionの承認、非公開作品、停止中商品が必要です。
              </p>
            ) : null}
          </form>
          <section className="panel">
            <h2 className="font-bold">Release 5承認</h2>
            <p className="mt-2 text-sm text-stone-600">
              {approval.release_notes || "引継ぎメモなし"}
            </p>
            <Link
              className="button-secondary mt-4 w-full"
              href={`/dashboard/projects/${project.id}`}
            >
              作品管理へ戻る
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}

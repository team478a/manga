import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireProfile } from "@/lib/auth";
import { cloudSalesPreparationFeatureEnabled } from "@/lib/cloud-sales-preparation";
import { listCloudSalesPreparations } from "@/lib/cloud-sales-preparation-server";

export default async function CloudSalesPreparationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile();
  const query = await searchParams;
  const enabled = cloudSalesPreparationFeatureEnabled();
  const rows = enabled ? await listCloudSalesPreparations(profile.id) : [];
  return (
    <main className="page max-w-7xl">
      <p className="text-sm font-bold text-violet-700">Release 6</p>
      <h1 className="mt-2 text-3xl font-bold">販売準備</h1>
      <p className="mt-2 text-stone-600">
        承認済み作品からPDFと表紙を生成し、非公開作品・停止中商品へ同期します。
      </p>
      {!enabled ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-900">
          販売準備Feature Flagは停止中です。
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
          {query.error}
        </p>
      ) : null}
      {rows.length ? (
        <div className="mt-7 grid gap-4">
          {rows.map(({ project, approval, preparation, current }) => (
            <article
              className="panel grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"
              key={project.id}
            >
              <div>
                <p className="text-xs font-bold text-violet-700">
                  PROJECT REVISION {project.revision}
                </p>
                <h2 className="mt-1 text-xl font-bold">{project.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-stone-600">
                  {approval.release_notes || "販売準備への引継ぎメモはありません。"}
                </p>
              </div>
              <span
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
                  current
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-violet-50 text-violet-800"
                }`}
              >
                {current ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {preparation
                  ? current
                    ? "同期済み"
                    : "要再同期"
                  : "未同期"}
              </span>
              <Link
                className="button-secondary"
                href={`/dashboard/sales-preparation/${project.id}`}
              >
                販売準備を確認
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      ) : enabled ? (
        <div className="mt-7">
          <EmptyState
            title="販売準備へ進める作品はありません"
            body="作品管理で全Pageを確認し、現行revisionを承認してください。"
            href="/dashboard/projects"
            action="作品管理を開く"
          />
        </div>
      ) : null}
    </main>
  );
}

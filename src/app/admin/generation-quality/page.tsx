import Link from "next/link";
import Image from "next/image";
import { AdminDataUnavailable } from "@/components/admin/AdminDataUnavailable";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { requireAdmin } from "@/lib/auth";
import {
  loadAdminGenerationQualityGallery,
  type AdminGenerationQualityItem,
} from "@/modules/manga-quality/infrastructure/admin-generation-quality-repository";
import { reviewAdminGenerationQualityAction } from "./actions";

type Search = {
  q?: string;
  review?: string;
  adoption?: string;
  inspection?: string;
  message?: string;
  error?: string;
};

const reviewLabel: Record<string, string> = {
  approved: "問題なし",
  needs_review: "要確認",
  quality_issue: "品質問題",
};

const adoptionLabel: Record<string, string> = {
  auto_placed: "自動採用",
  review_required: "採用確認待ち",
  placement_failed: "配置失敗",
  rejected: "却下",
};

function matches(item: AdminGenerationQualityItem, query: Search) {
  const q = query.q?.trim().toLocaleLowerCase("ja") ?? "";
  if (
    q &&
    ![
      item.projectTitle,
      item.ownerName,
      item.providerId,
      item.modelId,
      item.jobId,
    ].some((value) => value.toLocaleLowerCase("ja").includes(q))
  )
    return false;
  if (query.review === "unreviewed" && item.reviewStatus) return false;
  if (
    query.review &&
    query.review !== "all" &&
    query.review !== "unreviewed" &&
    item.reviewStatus !== query.review
  )
    return false;
  if (query.adoption === "pending" && item.adoptionStatus) return false;
  if (
    query.adoption &&
    !["all", "pending"].includes(query.adoption) &&
    item.adoptionStatus !== query.adoption
  )
    return false;
  if (query.inspection === "none" && item.inspectionStatus) return false;
  if (
    query.inspection &&
    !["all", "none"].includes(query.inspection) &&
    item.inspectionStatus !== query.inspection
  )
    return false;
  return true;
}

function QualityCard({ item }: { item: AdminGenerationQualityItem }) {
  return (
    <article className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <a
        className="block bg-stone-950"
        href={item.imageUrl}
        rel="noreferrer"
        target="_blank"
      >
        <Image
          alt={`${item.projectTitle} ${item.pageNumber ? `${item.pageNumber}ページ` : "ページ未指定"}の生成画像`}
          className="h-72 w-full object-contain"
          height={item.height}
          src={item.imageUrl}
          unoptimized
          width={item.width}
        />
      </a>
      <div className="space-y-4 p-5">
        <div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">
              {item.productionStatus ?? "制作途中"}
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">
              {item.adoptionStatus
                ? (adoptionLabel[item.adoptionStatus] ?? item.adoptionStatus)
                : "未採用候補"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${item.inspectionStatus === "FAIL" ? "bg-red-100 text-red-800" : item.inspectionStatus === "WARNING" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"}`}
            >
              自動検査 {item.inspectionStatus ?? "未実施"}
              {item.inspectionCount ? ` ${item.inspectionCount}件` : ""}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold">{item.projectTitle}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {item.ownerName}・
            {item.pageNumber ? `${item.pageNumber}ページ` : "ページ未指定"}・
            {item.projectVisibility}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3 text-sm">
          <div>
            <dt className="text-stone-500">Provider / model</dt>
            <dd className="break-all font-semibold">
              {item.providerId} / {item.modelId}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">種類・試行</dt>
            <dd className="font-semibold">
              {item.jobType}・{item.attemptCount}回
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">画像</dt>
            <dd className="font-semibold">
              {item.width}×{item.height}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">生成日時</dt>
            <dd className="font-semibold">
              {new Date(item.generatedAt).toLocaleString("ja-JP")}
            </dd>
          </div>
        </dl>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-stone-600">
            生成追跡情報
          </summary>
          <div className="mt-2 space-y-1 break-all font-mono text-xs text-stone-500">
            <p>Job: {item.jobId}</p>
            <p>Asset: {item.assetId}</p>
            {item.panelId ? <p>Panel: {item.panelId}</p> : null}
            {item.workflowVersion ? (
              <p>Workflow: {item.workflowVersion}</p>
            ) : null}
            {item.seed ? <p>Seed: {item.seed}</p> : null}
          </div>
        </details>
        <form
          action={reviewAdminGenerationQualityAction}
          className="space-y-3 border-t border-stone-200 pt-4"
        >
          <input name="jobId" type="hidden" value={item.jobId} />
          <label className="label block" htmlFor={`status-${item.jobId}`}>
            管理者判定
          </label>
          <select
            className="field"
            defaultValue={item.reviewStatus ?? "needs_review"}
            id={`status-${item.jobId}`}
            name="status"
          >
            <option value="approved">問題なし</option>
            <option value="needs_review">要確認</option>
            <option value="quality_issue">品質問題</option>
          </select>
          <label className="label block" htmlFor={`note-${item.jobId}`}>
            品質メモ（利用者には表示されません）
          </label>
          <textarea
            className="field min-h-20"
            defaultValue={item.reviewNote}
            id={`note-${item.jobId}`}
            maxLength={1000}
            name="note"
          />
          {item.reviewStatus ? (
            <p className="text-xs text-stone-500">
              現在: {reviewLabel[item.reviewStatus]}・
              {item.reviewerName ?? "管理者"}
              {item.reviewedAt
                ? `・${new Date(item.reviewedAt).toLocaleString("ja-JP")}`
                : ""}
            </p>
          ) : null}
          <PendingSubmitButton
            className="button w-full"
            pendingLabel="判定を保存中…"
          >
            判定を保存
          </PendingSubmitButton>
        </form>
      </div>
    </article>
  );
}

export default async function AdminGenerationQualityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const loaded = await safelyLoadAdminData(
    "generation-quality",
    loadAdminGenerationQualityGallery,
  );
  if (!loaded.ok) return <AdminDataUnavailable title="生成品質ギャラリー" />;
  const visible = loaded.value.items.filter((item) => matches(item, query));
  const unreviewed = loaded.value.items.filter(
    (item) => !item.reviewStatus,
  ).length;
  const issues = loaded.value.items.filter(
    (item) =>
      item.reviewStatus === "quality_issue" || item.inspectionStatus === "FAIL",
  ).length;
  return (
    <main className="page max-w-7xl">
      <Link className="text-leaf underline" href="/admin">
        ← 管理者ダッシュボード
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">一般向けCloud AI</p>
          <h1 className="mt-1 text-3xl font-bold">生成品質ギャラリー</h1>
          <p className="mt-2 text-stone-600">
            完成・公開状態に関係なく、AIが生成した画像候補を読み取り専用で確認します。利用者の参照画像は表示しません。
          </p>
        </div>
      </div>
      {query.message ? (
        <p
          className="mt-5 rounded-lg bg-green-50 p-4 text-green-800"
          role="status"
        >
          {query.message}
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-800" role="alert">
          {query.error}
        </p>
      ) : null}
      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-violet-50 p-4">
          <p className="text-sm text-stone-600">生成画像</p>
          <p className="mt-1 text-3xl font-bold text-violet-800">
            {loaded.value.items.length}
          </p>
          <p className="text-xs text-stone-500">直近最大120件</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <p className="text-sm text-stone-600">未確認</p>
          <p className="mt-1 text-3xl font-bold text-blue-800">{unreviewed}</p>
        </div>
        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-sm text-stone-600">品質問題・自動FAIL</p>
          <p className="mt-1 text-3xl font-bold text-red-800">{issues}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-sm text-stone-600">24時間以内の画像生成失敗</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">
            {loaded.value.failedLast24Hours}
          </p>
        </div>
      </section>
      <form className="panel mt-6 grid gap-4 md:grid-cols-4" method="get">
        <label className="label">
          作品・利用者・Provider
          <input
            className="field mt-1"
            defaultValue={query.q}
            name="q"
            placeholder="検索"
          />
        </label>
        <label className="label">
          管理者判定
          <select
            className="field mt-1"
            defaultValue={query.review ?? "all"}
            name="review"
          >
            <option value="all">すべて</option>
            <option value="unreviewed">未確認</option>
            <option value="approved">問題なし</option>
            <option value="needs_review">要確認</option>
            <option value="quality_issue">品質問題</option>
          </select>
        </label>
        <label className="label">
          採用状態
          <select
            className="field mt-1"
            defaultValue={query.adoption ?? "all"}
            name="adoption"
          >
            <option value="all">すべて</option>
            <option value="pending">未採用候補</option>
            <option value="auto_placed">自動採用</option>
            <option value="review_required">採用確認待ち</option>
            <option value="placement_failed">配置失敗</option>
            <option value="rejected">却下</option>
          </select>
        </label>
        <label className="label">
          自動検査
          <select
            className="field mt-1"
            defaultValue={query.inspection ?? "all"}
            name="inspection"
          >
            <option value="all">すべて</option>
            <option value="none">未実施</option>
            <option value="PASS">PASS</option>
            <option value="WARNING">WARNING</option>
            <option value="FAIL">FAIL</option>
            <option value="NOT_EVALUATED">NOT_EVALUATED</option>
          </select>
        </label>
        <button className="button md:col-span-4" type="submit">
          絞り込む
        </button>
      </form>
      <p className="mt-5 text-sm text-stone-600">{visible.length}件を表示</p>
      <section className="mt-4 grid gap-6 lg:grid-cols-2">
        {visible.map((item) => (
          <QualityCard item={item} key={item.jobId} />
        ))}
      </section>
      {!visible.length ? (
        <div className="panel mt-4 text-stone-600">
          条件に一致する生成画像はありません。
        </div>
      ) : null}
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  cloudAdultPlanningFeatureEnabled,
  getCloudAdultPlanningAccess,
  getCloudAdultPlanningBrief,
} from "@/lib/cloud-adult-planning";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { CloudDataNotice } from "@/components/CloudDataNotice";
import { safelyLoadCloudData } from "@/lib/cloud-runtime-resilience";

const rows = [
  ["企画コンセプト", "concept"],
  ["主人公", "protagonist"],
  ["主人公の目的", "protagonistGoal"],
  ["中心となる対立", "centralConflict"],
  ["読者への約束", "readerPromise"],
  ["トーン・雰囲気", "tone"],
  ["差別化ポイント", "differentiation"],
  ["結末の方向性", "endingDirection"],
  ["制作メモ", "notes"],
] as const;

export default async function AdultPlanningBriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string; briefId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  if (
    !cloudResearchFeatureEnabled() ||
    !cloudAdultPlanningFeatureEnabled()
  )
    redirect("/dashboard/research");
  const { profile } = await requireProfile();
  const { reportId, briefId } = await params;
  const { message } = await searchParams;
  const report = await getCloudResearchReport(profile.id, reportId).catch(
    (error) => {
      if (error instanceof ResourceNotFoundError) notFound();
      throw error;
    },
  );
  if (report.input.contentClass !== "adult") notFound();
  const accessLoad = await safelyLoadCloudData(
    "adult-proposal-brief/access",
    () => getCloudAdultPlanningAccess(profile.id),
    {
      allowed: false as const,
      reason: "configuration_unavailable" as const,
      grant: null,
    },
  );
  const access = accessLoad.value;
  if (!accessLoad.ok) return <main className="page max-w-3xl"><h1 className="text-3xl font-bold">成人向け企画ブリーフ</h1><CloudDataNotice className="mt-6">利用許可を一時的に確認できません。安全のため内容表示を停止しています。</CloudDataNotice><Link className="button-secondary mt-5" href={`/dashboard/research/${report.id}/proposal`}>企画ブリーフ一覧へ戻る</Link></main>;
  if (!access.allowed) notFound();
  const brief = await getCloudAdultPlanningBrief(
    profile.id,
    report.id,
    briefId,
  ).catch((error) => {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  });

  return (
    <main className="page max-w-3xl">
      <Link
        className="text-violet-700 underline"
        href={`/dashboard/research/${report.id}/proposal`}
      >
        ← 企画ブリーフ一覧へ
      </Link>
      <p className="mt-5 text-sm font-bold text-violet-700">
        成人向け企画ブリーフ
      </p>
      <h1 className="mt-2 text-3xl font-bold">{brief.workingTitle}</h1>
      <p className="mt-3 text-stone-600">
        {brief.status === "ready" ? "企画条件確定" : "下書き"}・
        {new Date(brief.createdAt).toLocaleString("ja-JP")}
      </p>
      {message ? (
        <p
          className="mt-5 rounded-lg bg-green-50 p-4 text-green-800"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <section className="panel mt-6 space-y-5">
        {rows.map(([label, key]) => (
          <div key={key}>
            <h2 className="text-sm font-bold text-stone-500">{label}</h2>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">
              {brief[key] || "未入力"}
            </p>
          </div>
        ))}
      </section>
      <p className="mt-5 rounded-lg bg-violet-50 p-4 text-sm text-violet-950">
        このブリーフは利用者が入力した制作条件です。外部AIによる生成結果ではありません。
      </p>
    </main>
  );
}

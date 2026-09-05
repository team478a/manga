import Link from "next/link";
import type { ReactNode } from "react";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment, isCloudGeneralMonitorActive } from "@/lib/cloud-general-monitor";
import { monitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import { loadMonitorQualityReviewWorkspace } from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";
import { MonitorQualityReviewClient } from "./MonitorQualityReviewClient";

export default async function MonitorQualityReviewPage() {
  const { profile } = await requireProfile();
  const enrollment = await getCloudGeneralMonitorEnrollment(profile.id);
  let content: ReactNode;
  if (!monitorQualityReviewEnabled()) {
    content = <p className="panel mt-6 text-stone-700">画像品質の確認は現在準備中です。</p>;
  } else if (!isCloudGeneralMonitorActive(enrollment)) {
    content = <p className="panel mt-6 text-stone-700">この画面は購入者向け先行利用が有効なアカウントだけが使用できます。</p>;
  } else {
    let workspace = null;
    try {
      workspace = await loadMonitorQualityReviewWorkspace(profile.id);
    } catch {
      workspace = null;
    }
    content = !workspace ? (
      <p className="panel mt-6 text-stone-700">品質確認の情報を読み込めませんでした。時間をおいて再度お試しください。</p>
    ) : !workspace.configured ? (
      <p className="panel mt-6 text-stone-700">品質確認用の準備が完了していません。</p>
    ) : !workspace.assignment ? (
      <p className="panel mt-6 text-stone-700">現在、このアカウントに割り当てられた画像はありません。</p>
    ) : (
      <MonitorQualityReviewClient assignmentId={workspace.assignment.id} cases={workspace.cases} initialConsented={Boolean(workspace.assignment.consented_at)} initialSubmitted={workspace.assignment.status === "submitted"} responses={workspace.responses} />
    );
  }
  return (
    <main className="page max-w-6xl">
      <p className="font-semibold text-violet-700">先行販売購入者向け・招待制</p>
      <h1 className="mt-1 text-3xl font-bold">漫画画像の品質確認</h1>
      <p className="mt-3 max-w-3xl text-stone-600">1枚ずつ画像を見て、崩れや不自然な点がないか確認します。スマートフォンから途中保存して再開できます。</p>
      {content}
      <Link className="button-secondary mt-6" href="/dashboard/monitor">先行利用の状況へ戻る</Link>
    </main>
  );
}

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { requireCloudAdultMonitor } from "@/lib/cloud-adult-monitor";
import { completeAdultMonitorOnboardingAction } from "./actions";

export default async function AdultMonitorWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile();
  const enrollment = await requireCloudAdultMonitor(profile.id);
  const { error } = await searchParams;
  return (
    <main className="page max-w-3xl">
      <p className="font-semibold text-violet-700">18歳以上・許可制・非公開</p>
      <h1 className="mt-2 text-3xl font-bold">成人向けモニターを始める前に</h1>
      <p className="mt-3 text-stone-600">市場分析から非公開作品管理までを順番にお試しいただけます。</p>
      {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">今回の利用条件</h2>
        <ul className="mt-4 space-y-3">
          {[
            "利用者本人が18歳以上であることを確認してください",
            `AI利用上限は全工程合計${enrollment.ai_request_limit}回です`,
            `利用期限は${new Date(enrollment.expires_at).toLocaleDateString("ja-JP")}です`,
            "生成物と作品は非公開で管理し、公開・販売しないでください",
            "成人向け画像生成は今回の対象外です",
            "違法、非同意、未成年を含む内容は入力しないでください",
            "困った画面や結果はフィードバックからお知らせください",
          ].map((item) => (
            <li className="flex gap-3" key={item}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <form action={completeAdultMonitorOnboardingAction} className="mt-6">
        <PendingSubmitButton className="button w-full bg-violet-700 hover:bg-violet-800" pendingLabel="開始準備中…">
          条件を確認して成人向けモニターを開始
        </PendingSubmitButton>
      </form>
      <Link className="button-secondary mt-3 w-full" href="/dashboard/adult-monitor/guide">Webマニュアルを見る</Link>
    </main>
  );
}

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { completeGeneralMonitorOnboardingAction } from "./actions";

export default async function GeneralMonitorWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile();
  const enrollment = await requireCloudGeneralMonitor(profile.id);
  const { error } = await searchParams;
  return (
    <main className="page max-w-3xl">
      <p className="font-semibold text-violet-700">一般向け・招待制モニター</p>
      <h1 className="mt-2 text-3xl font-bold">最初にご確認ください</h1>
      <p className="mt-3 text-stone-600">
        専門知識は不要です。市場分析から順番に進み、実際に漫画制作が進められるかをお試しください。
      </p>
      {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">モニター条件</h2>
        <ul className="mt-4 space-y-3">
          {[
            `AI利用上限は合計${enrollment.ai_request_limit}回です`,
            `利用期限は${new Date(enrollment.expires_at).toLocaleDateString("ja-JP")}です`,
            "一般向け作品だけを対象にしてください",
            "困った点や止まった画面は「状況・ご意見」から送信してください",
            "APIキー、パスワード、個人情報は入力しないでください",
          ].map((item) => (
            <li className="flex gap-3" key={item}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <form action={completeGeneralMonitorOnboardingAction} className="mt-6">
        <button className="button w-full bg-violet-700 hover:bg-violet-800" type="submit">
          内容を確認してモニターを開始
        </button>
      </form>
      <Link className="button-secondary mt-3 w-full" href="/dashboard/monitor/guide">詳しい使い方を見る</Link>
    </main>
  );
}

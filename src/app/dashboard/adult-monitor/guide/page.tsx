import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { requireCloudAdultMonitor } from "@/lib/cloud-adult-monitor";

export default async function AdultMonitorGuidePage() {
  const { profile } = await requireProfile();
  await requireCloudAdultMonitor(profile.id);
  const steps = [
    ["1. 市場分析", "ジャンルなどを選び、成人向け区分で分析します。最初に年齢確認と利用条件への同意が必要です。", "/dashboard/research/new"],
    ["2. AI企画", "保存した分析結果から3案を生成し、制作する1案を採用します。", "/dashboard/research"],
    ["3. シナリオ", "採用企画から初稿を作り、必要なら修正して採用します。", "/dashboard/research"],
    ["4. ネーム", "採用シナリオからページ・コマ構成を作り、確認後に採用します。", "/dashboard/research"],
    ["5. 非公開作品管理", "採用ネームをCanvas下書きへ変換し、非公開のまま整理します。", "/dashboard/adult-works"],
  ] as const;
  return (
    <main className="page max-w-4xl">
      <p className="font-semibold text-violet-700">成人向け限定モニター</p>
      <h1 className="mt-1 text-3xl font-bold">使い方ガイド</h1>
      <p className="mt-3 text-stone-600">専門知識は不要です。上から順番に進めてください。</p>
      <div className="mt-7 space-y-4">
        {steps.map(([title, detail, href]) => (
          <section className="panel" key={title}>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-2 text-stone-600">{detail}</p>
            <Link className="button-secondary mt-4" href={href}>この工程を開く</Link>
          </section>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h2 className="font-bold">今回できないこと</h2>
        <p className="mt-2">成人向け画像生成、作品公開、販売、外部共有はモニター対象外です。入力・結果に個人情報を含めないでください。</p>
      </section>
      <Link className="button mt-6 bg-violet-700 hover:bg-violet-800" href="/dashboard/adult-monitor">状況・フィードバックへ</Link>
    </main>
  );
}

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdultMonitorStaffGuidePage() {
  await requireAdmin();
  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/admin/adult-monitors">← モニター管理</Link>
      <h1 className="mt-5 text-3xl font-bold">成人向けモニター運用手順</h1>
      <ol className="mt-7 space-y-4">
        {[
          "公開前チェックをすべて準備完了にする",
          "18歳以上で利用意思を確認したスタッフ1名を選ぶ",
          "ユーザー詳細で期限・AI上限・許可理由を設定して招待する",
          "受信メールから初回案内、年齢確認、同意を完了する",
          "市場分析→企画→シナリオ→ネーム→非公開作品管理を完走する",
          "停止操作後に全成人向け工程へ入れないことを確認する",
          "問題がなければ2〜3名ずつ段階的に招待する",
        ].map((step, index) => <li className="panel flex gap-4" key={step}><span className="font-bold text-violet-700">{index + 1}</span><span>{step}</span></li>)}
      </ol>
      <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-950">成人向け画像生成、作品公開、販売は許可しません。緊急時はDB Kill Switchと環境Feature Flagの両方を停止します。</p>
    </main>
  );
}

import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  ImageIcon,
  Lightbulb,
  MessageSquare,
  PanelsTopLeft,
  TriangleAlert,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";

const steps = [
  {
    number: 1,
    title: "AI市場分析",
    icon: BarChart3,
    body: "ジャンルとテーマを選びます。迷った項目は「AIにおまかせ」で構いません。出典URLや市場データの手入力は不要です。",
    action: "どんな作品が売れやすいか調べる",
  },
  {
    number: 2,
    title: "AI企画提案",
    icon: Lightbulb,
    body: "本命案・差別化案・小さく試す案を比較し、売れやすさ、作りやすさ、買われる理由を確認して1案を選びます。",
    action: "AI企画を3案作成",
  },
  {
    number: 3,
    title: "シナリオ生成",
    icon: FileText,
    body: "採用企画から人物、三幕構成、シーン、ページ配分を作ります。必要なら修正版を作ってから採用します。",
    action: "AIで初稿シナリオを作る",
  },
  {
    number: 4,
    title: "AIネーム",
    icon: PanelsTopLeft,
    body: "採用シナリオをページ、コマ割り、構図、セリフへ具体化します。内容を確認し、使用するネームを採用します。",
    action: "AIで初稿ネームを作る",
  },
  {
    number: 5,
    title: "Canvas・コマ画像",
    icon: ImageIcon,
    body: "採用ネームからCanvas下書きを作り、コマ枠、吹き出し、テキストを調整します。必要なコマだけ画像生成します。",
    action: "Canvas下書きを作成",
  },
] as const;

export default async function GeneralMonitorGuidePage() {
  const { profile } = await requireProfile();
  const enrollment = await getCloudGeneralMonitorEnrollment(profile.id);

  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/dashboard/monitor">
        ← モニター状況へ
      </Link>
      <div className="mt-5 flex items-start gap-4">
        <span className="rounded-2xl bg-violet-100 p-3 text-violet-700">
          <BookOpenCheck className="h-7 w-7" />
        </span>
        <div>
          <p className="text-sm font-bold text-violet-700">一般向け・招待制</p>
          <h1 className="mt-1 text-3xl font-bold">モニターご利用ガイド</h1>
          <p className="mt-2 text-stone-600">
            専門知識なしで、市場分析から漫画の下書きまで順番に進められます。
          </p>
        </div>
      </div>

      <section className="panel mt-7 border-violet-200 bg-violet-50">
        <h2 className="text-xl font-bold">最初に確認</h2>
        <ul className="mt-4 space-y-3 text-sm text-violet-950">
          {[
            "招待されたメールアドレスでログインする",
            "一般向け漫画だけを入力する",
            "生成中は同じボタンを続けて押さない",
            "保存表示を確認してから次の画面へ進む",
          ].map((item) => (
            <li className="flex gap-2" key={item}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {enrollment ? (
          <dl className="mt-5 grid gap-3 border-t border-violet-200 pt-5 sm:grid-cols-3">
            <div><dt className="text-sm text-stone-500">状態</dt><dd className="font-bold">{enrollment.status}</dd></div>
            <div><dt className="text-sm text-stone-500">AI利用数</dt><dd className="font-bold">{enrollment.ai_requests_used} / {enrollment.ai_request_limit}</dd></div>
            <div><dt className="text-sm text-stone-500">期限</dt><dd className="font-bold">{new Date(enrollment.expires_at).toLocaleDateString("ja-JP")}</dd></div>
          </dl>
        ) : (
          <p className="mt-5 rounded-lg bg-white p-3 text-sm text-stone-700">
            利用開始には管理者からのモニター招待が必要です。
          </p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="workflow-guide-title">
        <h2 className="text-2xl font-bold" id="workflow-guide-title">制作の進め方</h2>
        <div className="mt-5 space-y-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="panel min-w-0" key={step.number}>
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700">
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 shrink-0 text-violet-700" />
                      <h3 className="text-xl font-bold">{step.title}</h3>
                    </div>
                    <p className="mt-2 break-words leading-relaxed text-stone-600">{step.body}</p>
                    <p className="mt-3 text-sm font-bold text-violet-800">
                      目印のボタン：{step.action}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-violet-700" />
            <h2 className="text-xl font-bold">感想を送る</h2>
          </div>
          <p className="mt-3 text-stone-600">
            迷った場所、期待と違った結果、進めなかった工程、良かった点をお知らせください。
            パスワードや個人情報は入力しないでください。
          </p>
          <Link className="button-secondary mt-5 w-full" href="/dashboard/monitor">
            状況・ご意見を開く
          </Link>
        </section>
        <section className="panel border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-950">
            <TriangleAlert className="h-5 w-5" />
            <h2 className="text-xl font-bold">困ったとき</h2>
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-950">
            <li>「招待が必要です」：招待されたアカウントか確認</li>
            <li>「現在停止中」：運営側の再開を待つ</li>
            <li>生成が終わらない：連打せず、少し待って一度だけ再試行</li>
            <li>表示が崩れる：再読み込み後、端末情報と画面を報告</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link className="button bg-violet-700 hover:bg-violet-800" href="/dashboard/research/new">
          市場分析を開始
        </Link>
        <Link className="button-secondary" href="/dashboard">
          ダッシュボードへ戻る
        </Link>
      </div>
    </main>
  );
}

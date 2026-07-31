import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  FilePenLine,
  Images,
  Lightbulb,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";

const sections = [
  { href: "#quick-start", label: "最初の5分" },
  { href: "#workflow", label: "制作手順" },
  { href: "#mobile", label: "スマートフォン" },
  { href: "#feedback", label: "感想の送り方" },
  { href: "#troubleshooting", label: "困ったとき" },
  { href: "#safety", label: "安全上の注意" },
] as const;

const steps = [
  {
    number: 1,
    title: "市場分析",
    icon: BarChart3,
    before: "ジャンル、読者、テーマを選びます。迷う項目は「AIにおまかせ」で構いません。",
    action: "「どんな作品が売れやすいか調べる」を1回押します。",
    result: "売れやすい方向、想定読者、価格、販売先、注意点が表示されます。",
    href: "/dashboard/research",
    linkLabel: "市場分析を開始",
    availability: "available",
  },
  {
    number: 2,
    title: "AI企画提案",
    icon: Lightbulb,
    before: "保存した市場分析から「AI企画提案の準備へ」を選びます。",
    action: "「AI企画を3案作成」を押し、本命案・差別化案・小さく試す案を比較します。",
    result: "売れやすさ、作りやすさ、買われる理由を見て、制作する1案を採用します。",
    href: "/dashboard/workflow/proposal",
    linkLabel: "AI企画提案を開く",
    availability: "available",
  },
  {
    number: 3,
    title: "シナリオ作成",
    icon: FileText,
    before: "採用した企画から「シナリオ生成へ進む」を選びます。",
    action: "初稿を作り、人物、三幕構成、シーン、ページ配分を確認します。",
    result: "必要なら修正版を作り、使用するシナリオを採用します。",
    href: "/dashboard/workflow/scenario",
    linkLabel: "シナリオ作成を開く",
    availability: "available",
  },
  {
    number: 4,
    title: "ネーム作成",
    icon: Sparkles,
    before: "採用シナリオから「AIネーム生成へ進む」を選びます。",
    action: "初稿を作り、ページ、コマ割り、構図、セリフを確認します。",
    result: "必要なら修正版を作り、使用するネームを採用します。",
    href: "/dashboard/workflow/storyboard",
    linkLabel: "ネーム作成を開く",
    availability: "available",
  },
  {
    number: 5,
    title: "原稿編集",
    icon: FilePenLine,
    before: "採用ネームからCanvas下書きを作成します。",
    action: "コマ枠、吹き出し、テキストを調整し、必要なコマだけ画像生成します。",
    result: "保存表示を確認すると、次回も続きから編集できます。",
    href: "/creator",
    linkLabel: "原稿編集を開く",
    availability: "available",
  },
  {
    number: 6,
    title: "作品管理",
    icon: Images,
    before: "作成した作品の状態や公開準備状況を一覧で確認します。",
    action: "確認したい作品を選び、作品情報や現在の状態を確認します。",
    result: "制作した作品を一覧から再表示できます。",
    href: "/dashboard/works",
    linkLabel: "作品管理を開く",
    availability: "available",
  },
  {
    number: 7,
    title: "販売準備",
    icon: ShoppingBag,
    before: "作品情報、販売形式、価格などを整える工程です。",
    action: "現在はモニターテスト対象外です。操作は必要ありません。",
    result: "今後の更新で利用可能になる予定です。",
    href: null,
    linkLabel: null,
    availability: "coming-soon",
  },
  {
    number: 8,
    title: "収益管理",
    icon: ReceiptText,
    before: "販売後の売上や作品ごとの状況を確認する工程です。",
    action: "現在はモニターテスト対象外です。操作は必要ありません。",
    result: "今後の更新で利用可能になる予定です。",
    href: null,
    linkLabel: null,
    availability: "coming-soon",
  },
] as const;

const troubleItems = [
  {
    title: "招待が必要と表示される",
    answer: "招待メールを受け取ったメールアドレスでログインしているか確認してください。",
  },
  {
    title: "現在停止中と表示される",
    answer: "運営側で一時停止しています。操作を繰り返さず、スタッフへご連絡ください。",
  },
  {
    title: "AI利用上限に達した",
    answer: "追加実行はできません。状況・ご意見から必要な工程をスタッフへお知らせください。",
  },
  {
    title: "生成が終わらない・エラーになった",
    answer: "同じボタンを連打せず、少し待って画面を再読み込みし、一度だけ再試行してください。",
  },
  {
    title: "スマートフォンで表示が崩れる",
    answer: "画面を再読み込みしてください。直らない場合は画面名、端末、ブラウザ、スクリーンショットを送ってください。",
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
      <header className="mt-5 flex items-start gap-4">
        <span className="rounded-2xl bg-violet-100 p-3 text-violet-700">
          <BookOpenCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-700">一般向け・招待制</p>
          <h1 className="mt-1 text-3xl font-bold">MANGAI Web使い方マニュアル</h1>
          <p className="mt-2 leading-relaxed text-stone-600">
            市場やAIの専門知識は必要ありません。上から順番に操作すると、
            市場分析から原稿編集・作品管理まで、8工程の順番に進められます。
            現在準備中の工程も、このページで確認できます。
          </p>
        </div>
      </header>

      <nav
        aria-label="マニュアル内メニュー"
        className="mt-6 flex max-w-full gap-2 overflow-x-auto pb-2"
      >
        {sections.map((section) => (
          <a
            className="shrink-0 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-bold text-violet-800"
            href={section.href}
            key={section.href}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <section className="panel mt-5 border-violet-200 bg-violet-50">
        <h2 className="text-xl font-bold">あなたの利用状況</h2>
        {enrollment ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-stone-500">状態</dt>
              <dd className="font-bold">{enrollment.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">AI利用数</dt>
              <dd className="font-bold">
                {enrollment.ai_requests_used} / {enrollment.ai_request_limit}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">期限</dt>
              <dd className="font-bold">
                {new Date(enrollment.expires_at).toLocaleDateString("ja-JP")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 rounded-lg bg-white p-3 text-sm text-stone-700">
            利用開始には管理者からのモニター招待が必要です。
          </p>
        )}
      </section>

      <section className="mt-9 scroll-mt-6" id="quick-start">
        <h2 className="text-2xl font-bold">最初の5分で行うこと</h2>
        <ol className="panel mt-4 space-y-4">
          {[
            "招待メールを受け取ったメールアドレスでログインする",
            "モニター状況で利用期限とAI利用上限を確認する",
            "このマニュアルを一度最後まで確認する",
            "サイドバーの「市場分析」から分析を1件作成する",
            "迷った場所や結果の感想を送る",
          ].map((item, index) => (
            <li className="flex gap-3" key={item}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                {index + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="workflow-guide-title"
        className="mt-9 scroll-mt-6"
        id="workflow"
      >
        <h2 className="text-2xl font-bold" id="workflow-guide-title">
          制作の進め方
        </h2>
        <p className="mt-2 text-stone-600">
          各工程で結果を保存・採用すると、次の工程へ進むボタンが表示されます。
        </p>
        <div className="mt-5 space-y-5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="panel min-w-0" key={step.number}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700">
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-5 w-5 shrink-0 text-violet-700"
                        aria-hidden="true"
                      />
                      <h3 className="text-xl font-bold">{step.title}</h3>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-xl bg-stone-50 p-3">
                        <dt className="font-bold text-stone-900">入力・準備</dt>
                        <dd className="mt-1 leading-relaxed text-stone-600">
                          {step.before}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-violet-50 p-3">
                        <dt className="font-bold text-violet-900">操作</dt>
                        <dd className="mt-1 leading-relaxed text-violet-950">
                          {step.action}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <dt className="font-bold text-emerald-900">完了の目印</dt>
                        <dd className="mt-1 leading-relaxed text-emerald-950">
                          {step.result}
                        </dd>
                      </div>
                    </dl>
                    {step.availability === "coming-soon" ? (
                      <span className="mt-4 inline-flex rounded-full bg-stone-100 px-3 py-1.5 text-sm font-bold text-stone-500">
                        準備中
                      </span>
                    ) : step.href && step.linkLabel ? (
                      <Link
                        className="button-secondary mt-4 w-full sm:w-auto"
                        href={step.href}
                      >
                        {step.linkLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-9 scroll-mt-6" id="mobile">
        <div className="panel border-violet-200 bg-violet-50">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-violet-700" aria-hidden="true" />
            <h2 className="text-2xl font-bold">スマートフォンで操作する方へ</h2>
          </div>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-stone-700">
            <li>制作工程のメニューは、横へ指で動かすと続きの工程を確認できます。</li>
            <li>ボタンは1回だけ押し、「処理中」の表示が消えるまで待ってください。</li>
            <li>入力中はブラウザの戻る操作を避け、保存完了を確認してから移動してください。</li>
            <li>古い表示が残る場合は、画面を下へ引いて再読み込みしてください。</li>
            <li>不具合報告では、端末名・ブラウザ名・画面名とスクリーンショットを添えてください。</li>
          </ul>
        </div>
      </section>

      <section className="mt-9 scroll-mt-6" id="feedback">
        <div className="panel">
          <div className="flex items-center gap-2">
            <MessageSquare
              className="h-5 w-5 text-violet-700"
              aria-hidden="true"
            />
            <h2 className="text-2xl font-bold">感想・不具合の送り方</h2>
          </div>
          <p className="mt-3 leading-relaxed text-stone-600">
            正常に完了した場合も、迷った場合も送信してください。スタッフが約10名分を
            整理できるよう、次の4点を短く入力してください。
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "どの工程・画面だったか",
              "何をしようとしたか",
              "実際にどうなったか",
              "期待していた結果",
            ].map((item) => (
              <li className="flex gap-2 rounded-xl bg-stone-50 p-3" key={item}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            className="button bg-violet-700 mt-5 w-full hover:bg-violet-800 sm:w-auto"
            href="/dashboard/monitor"
          >
            状況・ご意見を開く
          </Link>
        </div>
      </section>

      <section className="mt-9 scroll-mt-6" id="troubleshooting">
        <div className="flex items-center gap-2 text-amber-950">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
          <h2 className="text-2xl font-bold">困ったとき</h2>
        </div>
        <div className="mt-4 space-y-3">
          {troubleItems.map((item) => (
            <details className="panel group" key={item.title}>
              <summary className="cursor-pointer font-bold">
                {item.title}
              </summary>
              <p className="mt-3 leading-relaxed text-stone-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>「停止中」は故障ではありません。</strong>
          運営が安全確認や利用範囲の調整のために工程を止めている状態です。
          何度も操作せず、モニター状況からスタッフへご連絡ください。
        </div>
      </section>

      <section
        className="panel mt-9 scroll-mt-6 border-amber-200 bg-amber-50"
        id="safety"
      >
        <div className="flex items-center gap-2 text-amber-950">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          <h2 className="text-2xl font-bold">安全上の注意</h2>
        </div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-amber-950">
          <li>今回のテストは一般向け漫画だけが対象です。</li>
          <li>パスワード、APIキー、住所、電話番号などを入力しないでください。</li>
          <li>第三者の個人情報や、公開許可のない原稿・画像を入力しないでください。</li>
          <li>AIの結果は必ず内容を確認し、そのまま公開・販売しないでください。</li>
          <li>生成ボタンを連打するとAI利用回数を余分に消費する場合があります。</li>
        </ul>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          className="button bg-violet-700 hover:bg-violet-800"
          href="/dashboard/research/new"
        >
          市場分析を開始
        </Link>
        <Link className="button-secondary" href="/dashboard">
          ダッシュボードへ戻る
        </Link>
      </div>
    </main>
  );
}

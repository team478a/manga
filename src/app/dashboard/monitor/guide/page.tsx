import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  FilePenLine,
  FileCheck2,
  GitBranch,
  Images,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Palette,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Smartphone,
  TriangleAlert,
  Users,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";

const sections = [
  { href: "#quick-start", label: "最初の5分" },
  { href: "#workflow", label: "制作手順" },
  { href: "#manga-production", label: "漫画原稿の作り方" },
  { href: "#mobile", label: "スマートフォン" },
  { href: "#feedback", label: "感想の送り方" },
  { href: "#troubleshooting", label: "困ったとき" },
  { href: "#safety", label: "安全上の注意" },
] as const;

const mangaProductionSteps = [
  {
    number: 1,
    title: "最初は4〜8ページで試す",
    icon: BookOpenCheck,
    description:
      "「原稿編集」から作品を作り、まず短いページ数で保存・画像生成・確定まで試します。操作に慣れてから32〜100ページへ広げてください。",
  },
  {
    number: 2,
    title: "人物・画風・世界観を固定する",
    icon: Palette,
    description:
      "作品画面の「外見・衣装の設定を編集」と「画風・場所・小物を設定」から、ページをまたいで変えたくない特徴を先に保存します。",
  },
  {
    number: 3,
    title: "章・話・シーン・ページを並べる",
    icon: GitBranch,
    description:
      "作品画面で章を追加し、各章の話・シーン・ページを順番に整理します。ページを開く前に全体の流れを大まかに決めます。",
  },
  {
    number: 4,
    title: "参照画像を登録してコマへ割り当てる",
    icon: Users,
    description:
      "キャラクター、画風、場所、小物の見本画像を保存します。必要な人物・場所・小物を各コマへ割り当てると、画像生成条件として優先されます。",
  },
  {
    number: 5,
    title: "コマ画像を生成・比較・採用する",
    icon: Sparkles,
    description:
      "ページを開き、対象コマと生成するレイヤーを選びます。候補を比較して使用する画像だけを採用し、保存完了を確認します。",
  },
  {
    number: 6,
    title: "4〜8ページずつ制作状態を進める",
    icon: Images,
    description:
      "作品画面で4〜8ページを選んで一括生成できます。生成後は「要確認」から、直す場合は「要修正」、完成した場合は「確定」へ進めます。",
  },
  {
    number: 7,
    title: "連続性と章の予定を確認する",
    icon: LayoutDashboard,
    description:
      "「一貫性をチェック」で人物・衣装・場所・伏線を確認し、「長編コックピット」で進捗、期限、次に着手する章を確認します。",
  },
  {
    number: 8,
    title: "全ページを確定してPDFを書き出す",
    icon: FileCheck2,
    description:
      "原稿チェックの修正項目を解消し、全ページを「確定」にします。「PDF書き出しを開始」を押し、完了後にPDFをダウンロードします。",
  },
] as const;

const steps = [
  {
    number: 1,
    title: "市場分析",
    icon: BarChart3,
    before: "ジャンル、読者、テーマを選びます。迷う項目は「AIにおまかせ」で構いません。",
    action: "「どんな作品が売れやすいか調べる」を1回押します。",
    result: "売れやすい方向、想定読者、価格、販売先、注意点が表示されます。",
    href: "/dashboard/research/new",
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
    title: "PDF書き出しを開始できない",
    answer: "原稿チェックの修正項目を解消し、すべてのページを「確定」にしてください。生成中のページがある場合は、完了してから再確認してください。",
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
        ← 先行利用の状況へ
      </Link>
      <header className="mt-5 flex items-start gap-4">
        <span className="rounded-2xl bg-violet-100 p-3 text-violet-700">
          <BookOpenCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-700">先行販売購入者向け・招待制</p>
          <h1 className="mt-1 text-3xl font-bold">MANGAI Web使い方マニュアル</h1>
          <p className="mt-2 leading-relaxed text-stone-600">
            市場やAIの専門知識は必要ありません。上から順番に操作すると、
            市場分析から原稿編集・作品管理まで順番に進められます。
            原稿編集では、短い試作から最大100ページの作品とPDF書き出しまで確認できます。
          </p>
        </div>
      </header>

      <section className="panel mt-5 border-violet-200 bg-violet-50">
        <h2 className="text-xl font-bold text-violet-950">購入者向けの先行提供です</h2>
        <p className="mt-2 leading-relaxed text-violet-950">
          この利用枠は、MANGAIを先行販売でご購入いただいたお客様への先行提供です。無料参加をお願いする一般的なモニター募集ではありません。正式リリース前の機能を段階的にご利用いただき、ご意見を伺いますが、購入者としての権利や正式リリース後の利用資格は失われません。
        </p>
      </section>

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
            利用開始には管理者からの購入者向け先行利用の招待が必要です。
          </p>
        )}
      </section>

      <section className="mt-9 scroll-mt-6" id="quick-start">
        <h2 className="text-2xl font-bold">最初の5分で行うこと</h2>
        <ol className="panel mt-4 space-y-4">
          {[
            "招待メールを受け取ったメールアドレスでログインする",
            "先行利用の状況で利用期限とAI利用上限を確認する",
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

      <section className="mt-9 scroll-mt-6" id="manga-production">
        <h2 className="text-2xl font-bold">漫画原稿を完成させる手順</h2>
        <p className="mt-2 leading-relaxed text-stone-600">
          いきなり100ページを生成せず、最初は4〜8ページで一巡してください。
          人物や画風を先に固定すると、ページを増やしたときの見た目の変化を減らせます。
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {mangaProductionSteps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="panel min-w-0" key={step.number}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700">
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 shrink-0 text-violet-700" aria-hidden="true" />
                      <h3 className="font-bold">{step.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="panel mt-5 border-emerald-200 bg-emerald-50">
          <h3 className="font-bold text-emerald-950">完成の目印</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-emerald-950">
            <li>人物・画風・場所・小物の固定設定が保存されている</li>
            <li>必要なコマへ画像が採用され、保存完了が表示されている</li>
            <li>連続性の警告と原稿チェックの修正項目を確認している</li>
            <li>全ページが「確定」になり、完成原稿PDFをダウンロードできる</li>
          </ul>
        </div>
        <Link className="button mt-5 w-full sm:w-auto" href="/creator">
          原稿編集を開く
        </Link>
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
          何度も操作せず、先行利用の状況からスタッフへご連絡ください。
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

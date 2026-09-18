import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
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
import { CloudCreatorOperationVideo } from "./CloudCreatorOperationVideo";

const sections = [
  { href: "#quick-start", label: "最初の5分" },
  { href: "#visual-guide", label: "画面で確認" },
  { href: "#creator-operation-video", label: "原稿編集の操作デモ" },
  { href: "#workflow", label: "制作手順" },
  { href: "#manga-production", label: "漫画原稿の作り方" },
  { href: "#sales-listing", label: "出品・収益化" },
  { href: "#mobile", label: "スマートフォン" },
  { href: "#feedback", label: "感想の送り方" },
  { href: "#troubleshooting", label: "困ったとき" },
  { href: "#safety", label: "安全上の注意" },
] as const;

const visualGuide = [
  {
    number: 1,
    title: "ダッシュボードから市場分析を始める",
    description:
      "左側の制作ワークフローで現在の工程を確認し、画面中央の紫色のボタンから市場分析を始めます。",
    image: "/manual/cloud/01-dashboard.svg",
    alt: "MANGAI Cloudダッシュボードで制作ワークフローと市場分析開始ボタンを確認する画面例",
  },
  {
    number: 2,
    title: "企画・シナリオ・ネームを順番に採用する",
    description:
      "各工程の結果を保存・採用すると次の工程へ進めます。生成ボタンは1回だけ押し、完了表示を確認します。",
    image: "/manual/cloud/02-workflow.svg",
    alt: "市場分析、AI企画提案、シナリオ作成、ネーム作成の順序を示す画面例",
  },
  {
    number: 3,
    title: "原稿編集で人物・画風・参照画像を固定する",
    description:
      "画像生成前に、人物の外見・衣装、作品画風、場所・小物、参照画像とコマ割当を保存します。",
    image: "/manual/cloud/03-creator-project.svg",
    alt: "原稿編集の作品画面で完成ガイド、原稿チェック、画像生成前設定を確認する画面例",
  },
  {
    number: 4,
    title: "ページを選び、見積りと停止理由を確認する",
    description:
      "最初は連続2ページを選び、必要credit、残り利用枠、人物・画風、停止理由を確認してから開始します。",
    image: "/manual/cloud/04-generation-preflight.svg",
    alt: "ページ一括生成の開始前見積りと安全確認項目を示す画面例",
  },
  {
    number: 5,
    title: "全ページを確定し、完成原稿PDFを書き出す",
    description:
      "原稿チェックを解消して全ページを確定し、完成版を固定してからPDFを開始します。",
    image: "/manual/cloud/05-export.svg",
    alt: "原稿チェックから完成版固定、PDF書き出し、ダウンロードまでを示す画面例",
  },
  {
    number: 6,
    title: "完成原稿を外部販売用の一式へまとめる",
    description:
      "完成原稿、表紙・商品画像、作品情報、権利・AI利用表示をそろえ、外部販売サイトへ手動で登録します。",
    image: "/manual/cloud/08-sales-package.svg",
    alt: "完成原稿PDF、表紙画像、作品情報、権利確認を外部販売用の一式へまとめる画面例",
  },
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
    before:
      "ジャンル、読者、テーマを選びます。迷う項目は「AIにおまかせ」で構いません。",
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
    action:
      "「AI企画を3案作成」を押し、本命案・差別化案・小さく試す案を比較します。",
    result:
      "売れやすさ、作りやすさ、買われる理由を見て、制作する1案を採用します。",
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
    action:
      "コマ枠、吹き出し、テキストを調整し、必要なコマだけ画像生成します。",
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
    action:
      "MANGAI内の販売機能は準備中です。完成PDFを外部販売サイトへ手動出品する手順は、このページの「出品・収益化」で確認できます。",
    result: "MANGAI内の販売機能は今後の更新で利用可能になる予定です。",
    href: null,
    linkLabel: null,
    availability: "coming-soon",
  },
  {
    number: 8,
    title: "収益管理",
    icon: ReceiptText,
    before: "販売後の売上や作品ごとの状況を確認する工程です。",
    action:
      "MANGAI内の収益管理は準備中です。外部販売サイトの売上画面とご自身の帳簿で管理してください。",
    result: "MANGAI内の収益管理は今後の更新で利用可能になる予定です。",
    href: null,
    linkLabel: null,
    availability: "coming-soon",
  },
] as const;

const troubleItems = [
  {
    title: "招待が必要と表示される",
    answer:
      "招待メールを受け取ったメールアドレスでログインしているか確認してください。",
  },
  {
    title: "現在停止中と表示される",
    answer:
      "運営側で一時停止しています。操作を繰り返さず、スタッフへご連絡ください。",
  },
  {
    title: "AI利用上限に達した",
    answer:
      "追加実行はできません。状況・ご意見から必要な工程をスタッフへお知らせください。",
  },
  {
    title: "生成が終わらない・エラーになった",
    answer:
      "同じボタンを連打せず、少し待って画面を再読み込みし、一度だけ再試行してください。",
  },
  {
    title: "PDF書き出しを開始できない",
    answer:
      "原稿チェックの修正項目を解消し、すべてのページを「確定」にしてください。生成中のページがある場合は、完了してから再確認してください。",
  },
  {
    title: "スマートフォンで表示が崩れる",
    answer:
      "画面を再読み込みしてください。直らない場合は画面名、端末、ブラウザ、スクリーンショットを送ってください。",
  },
] as const;

const listingChecklist = [
  "全ページを確定し、ダウンロードしたPDFを最初から最後まで開いて確認した",
  "表紙・商品画像にタイトルと作者名を入れ、縮小表示でも読めることを確認した",
  "タイトル、作者名、紹介文、ジャンル、タグ、価格、対象年齢を決めた",
  "第三者の著作物・商標・肖像・個人情報を無断で使用していない",
  "利用する販売サイトのAI生成コンテンツ申告、規約、手数料を出品直前に確認した",
  "原稿、表紙、紹介文、公開日、販売URLを手元にも保存する準備をした",
] as const;

const externalListingSteps = [
  {
    number: 1,
    title: "販売用ファイルを準備する",
    description:
      "MANGAIから完成原稿PDFを保存し、表紙画像と商品紹介用画像を別に用意します。元の編集データも残してください。",
  },
  {
    number: 2,
    title: "商品情報を下書きする",
    description:
      "タイトル、作者名、短い紹介、詳しい紹介、ジャンル・タグ、対象年齢、価格、権利・AI利用に関する表示をメモします。",
  },
  {
    number: 3,
    title: "外部販売サイトへ手動登録する",
    description:
      "販売サイトのご自身のアカウントで、商品情報、表紙、原稿を登録します。本人確認、口座、税務情報は販売サイト上で本人が入力します。",
  },
  {
    number: 4,
    title: "プレビューして公開する",
    description:
      "ページ順、見開き、文字の読みやすさ、表紙、価格、公開範囲を確認します。問題がなければ公開または審査提出します。",
  },
  {
    number: 5,
    title: "販売後の記録を残す",
    description:
      "販売URL、公開日、原稿版、価格、売上、手数料、入金を記録します。修正版を出すときは購入者への案内方法も確認します。",
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
          <p className="text-sm font-bold text-violet-700">
            先行販売購入者向け・招待制
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            MANGAI Web使い方マニュアル
          </h1>
          <p className="mt-2 leading-relaxed text-stone-600">
            市場やAIの専門知識は必要ありません。上から順番に操作すると、
            市場分析から原稿編集・作品管理・外部販売サイトへの出品準備まで順番に進められます。
            原稿編集では、短い試作から最大100ページの作品とPDF書き出しまで確認できます。
          </p>
        </div>
      </header>

      <section className="panel mt-5 border-violet-200 bg-violet-50">
        <h2 className="text-xl font-bold text-violet-950">
          購入者向けの先行提供です
        </h2>
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
        aria-labelledby="visual-guide-title"
        className="mt-9 scroll-mt-6"
        id="visual-guide"
      >
        <h2 className="text-2xl font-bold" id="visual-guide-title">
          画面を見ながら漫画を完成させる
        </h2>
        <p className="mt-2 leading-relaxed text-stone-600">
          実際の画面を基に、個人名・作品内容・利用枠を含まない画面例にしています。
          表示される件数や料金はアカウントごとに異なるため、操作時の画面で必ず確認してください。
        </p>
        <div className="mt-5 space-y-6">
          {visualGuide.map((item) => (
            <figure className="panel overflow-hidden p-0" key={item.number}>
              <Image
                alt={item.alt}
                className="h-auto w-full border-b border-stone-200"
                height={675}
                priority={item.number === 1}
                src={item.image}
                width={1200}
              />
              <figcaption className="p-4 sm:p-5">
                <p className="text-sm font-bold text-violet-700">
                  画面 {item.number}
                </p>
                <h3 className="mt-1 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {item.description}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="creator-operation-video-title"
        className="mt-9 scroll-mt-6"
        id="creator-operation-video"
      >
        <p className="text-sm font-bold text-violet-700">音声なし・字幕付き</p>
        <h2
          className="mt-1 text-2xl font-bold"
          id="creator-operation-video-title"
        >
          原稿編集からPDF完成までの操作デモ
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-stone-600">
          人物・画風の固定から、2ページ生成、候補採用、吹き出し修正、全ページ確定、PDF保存までを約1分で確認できます。
          一時停止しながら、表示された順番でご自身の作品を操作してください。
        </p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          画面例は匿名化した説明用表示です。実際の作品名、画像、利用枠、料金は含みません。生成開始前には、必ずご自身の画面に表示される必要creditと最大予約費用を確認してください。
        </div>
        <CloudCreatorOperationVideo />
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
                        <dt className="font-bold text-emerald-900">
                          完了の目印
                        </dt>
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
                      <Icon
                        className="h-5 w-5 shrink-0 text-violet-700"
                        aria-hidden="true"
                      />
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

      <section
        aria-labelledby="sales-listing-title"
        className="mt-9 scroll-mt-6"
        id="sales-listing"
      >
        <p className="text-sm font-bold text-violet-700">
          一般向け漫画・外部販売サイト
        </p>
        <h2 className="mt-1 text-2xl font-bold" id="sales-listing-title">
          完成した漫画を出品する
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-stone-600">
          現在のMANGAI Cloudでは一般向け漫画を完成原稿PDFまで作成できます。
          出品は、ダウンロードした原稿をKindle Direct
          Publishing（KDP）やBOOTHなどの
          外部販売サイトへご自身で登録してください。
        </p>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>MANGAI内の販売申請・決済・収益管理は準備中です。</strong>
          この章は外部販売サイトへの手動出品を案内するもので、売上を保証するものではありません。
          成人向け作品は、この一般向けCloudマニュアルの対象外です。
        </div>

        <figure className="panel mt-5 overflow-hidden p-0">
          <Image
            alt="MANGAIで完成した漫画を外部販売サイトへ手動出品し販売記録を残す流れの画面例"
            className="h-auto w-full border-b border-stone-200"
            height={675}
            src="/manual/cloud/09-external-listing.svg"
            width={1200}
          />
          <figcaption className="p-4 text-sm leading-relaxed text-stone-600 sm:p-5">
            MANGAIは完成原稿の作成までを支援します。外部サイトのアカウント作成、本人確認、
            振込先・税務情報、公開操作は必ずご本人が販売サイト上で行ってください。
          </figcaption>
        </figure>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {externalListingSteps.map((step) => (
            <article className="panel min-w-0" key={step.number}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    {step.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="panel mt-5 border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2 text-emerald-950">
            <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-lg font-bold">出品前チェック</h3>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-emerald-950">
            {listingChecklist.map((item) => (
              <li className="flex gap-2" key={item}>
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="panel">
            <p className="text-sm font-bold text-violet-700">
              Kindle Direct Publishing
            </p>
            <h3 className="mt-1 text-xl font-bold">KDPへ電子漫画を出品する</h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
              <li>ページ順が分かる連番のPDFまたはPNG/JPEGを準備します。</li>
              <li>
                Kindle Createへ原稿を取り込み、漫画用のKPFを書き出します。
              </li>
              <li>編集用のKCBプロジェクトも、更新に備えて手元へ保存します。</li>
              <li>
                Kindle Previewerでページ順、文字、見開き、表紙を確認します。
              </li>
              <li>
                KDPで書誌情報、権利、販売地域、価格、表紙、KPFを登録します。
              </li>
              <li>
                AI生成画像を含む場合は、KDPの質問へ正確に申告して提出します。
              </li>
            </ol>
            <div className="mt-4 flex flex-col gap-2">
              <a
                className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 underline"
                href="https://kdp.amazon.co.jp/ja_JP/help/topic/GJMRD9F78MS9F43R"
                rel="noreferrer"
                target="_blank"
              >
                Kindle Createでのマンガ準備（公式）
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 underline"
                href="https://kdp.amazon.com/en_US/help/topic/G200672390"
                rel="noreferrer"
                target="_blank"
              >
                AI生成コンテンツの申告を含むKDP規約（公式・英語）
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm font-bold text-violet-700">
              ダウンロード販売
            </p>
            <h3 className="mt-1 text-xl font-bold">
              BOOTHへ電子漫画を出品する
            </h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
              <li>
                BOOTHでショップ名、紹介文、オーナー情報、振込先を設定します。
              </li>
              <li>商品種別で「ダウンロード商品」を選びます。</li>
              <li>商品名、商品画像、カテゴリ、紹介文、価格を入力します。</li>
              <li>
                完成原稿PDFをアップロードし、内容と規約を再確認して公開します。
              </li>
              <li>
                公開後に商品ページを開き、画像、説明、価格、販売ファイルを確認します。
              </li>
              <li>
                差し替え時は、先に新しいファイルを追加し、購入者への案内を検討します。
              </li>
            </ol>
            <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm leading-relaxed text-stone-600">
              ファイル容量、サービス利用料、禁止商品、公開範囲は変更される場合があります。
              出品時にBOOTHの最新画面と公式ヘルプを確認してください。
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 underline"
                href="https://booth.pm/guide"
                rel="noreferrer"
                target="_blank"
              >
                BOOTHで作品を売る手順（公式）
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 underline"
                href="https://booth.pixiv.help/hc/ja/sections/115000543514-%E3%83%80%E3%82%A6%E3%83%B3%E3%83%AD%E3%83%BC%E3%83%89%E8%B2%A9%E5%A3%B2%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6"
                rel="noreferrer"
                target="_blank"
              >
                ダウンロード販売ヘルプ（公式）
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>

        <div className="panel mt-5">
          <h3 className="text-lg font-bold">商品情報の下書きテンプレート</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["基本情報", "タイトル／作者名／巻数／言語／対象年齢"],
              ["紹介文", "一文紹介／詳しい紹介／ページ数／ファイル形式"],
              ["検索情報", "ジャンル／カテゴリ／タグ／読者に伝える特徴"],
              ["販売条件", "価格／販売地域／公開日／改訂版の扱い"],
              ["権利確認", "使用素材／フォント／参照画像／第三者権利"],
              ["AI利用表示", "各販売サイトの質問と規約に従った正確な申告"],
            ].map(([term, description]) => (
              <div className="rounded-xl bg-stone-50 p-3" key={term}>
                <dt className="font-bold text-stone-900">{term}</dt>
                <dd className="mt-1 leading-relaxed text-stone-600">
                  {description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-9 scroll-mt-6" id="mobile">
        <div className="panel border-violet-200 bg-violet-50">
          <div className="flex items-center gap-2">
            <Smartphone
              className="h-6 w-6 text-violet-700"
              aria-hidden="true"
            />
            <h2 className="text-2xl font-bold">スマートフォンで操作する方へ</h2>
          </div>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-stone-700">
            <li>
              制作工程のメニューは、横へ指で動かすと続きの工程を確認できます。
            </li>
            <li>
              ボタンは1回だけ押し、「処理中」の表示が消えるまで待ってください。
            </li>
            <li>
              入力中はブラウザの戻る操作を避け、保存完了を確認してから移動してください。
            </li>
            <li>
              古い表示が残る場合は、画面を下へ引いて再読み込みしてください。
            </li>
            <li>
              不具合報告では、端末名・ブラウザ名・画面名とスクリーンショットを添えてください。
            </li>
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
          <li>
            パスワード、APIキー、住所、電話番号などを入力しないでください。
          </li>
          <li>
            第三者の個人情報や、公開許可のない原稿・画像を入力しないでください。
          </li>
          <li>
            AIの結果は必ず内容を確認し、そのまま公開・販売しないでください。
          </li>
          <li>
            生成ボタンを連打するとAI利用回数を余分に消費する場合があります。
          </li>
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

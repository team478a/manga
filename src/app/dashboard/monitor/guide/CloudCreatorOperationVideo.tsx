import { Download, PlayCircle } from "lucide-react";

const manuals = [
  {
    number: 1,
    id: "01-market-analysis-guide",
    title: "市場分析",
    duration: "約25秒",
    description: "ダッシュボードから分析を開始し、条件を選んで結果を保存します。",
    actions: [
      "ダッシュボードの「市場分析を開始」を押す",
      "ジャンル・テーマ・ページ数を選ぶ",
      "分析結果を確認して保存する",
    ],
  },
  {
    number: 2,
    id: "02-proposal-guide",
    title: "AI企画提案",
    duration: "約25秒",
    description: "市場分析から3案を作り、内容を比較して制作する企画を採用します。",
    actions: [
      "保存した市場分析から企画提案へ進む",
      "本命案・差別化案・小さく試す案を比較する",
      "詳しい内容を確認して1案を採用する",
    ],
  },
  {
    number: 3,
    id: "03-scenario-guide",
    title: "シナリオ作成",
    duration: "約25秒",
    description: "採用企画から初稿を作り、人物・構成・シーンを確認して採用します。",
    actions: [
      "採用企画から初稿シナリオを作る",
      "登場人物・三幕構成・ページ配分を確認する",
      "必要なら修正し、使用する版を採用する",
    ],
  },
  {
    number: 4,
    id: "04-storyboard-guide",
    title: "ネーム作成",
    duration: "約25秒",
    description: "採用シナリオをページ・コマ・構図・セリフへ変換します。",
    actions: [
      "初稿ネームを作る",
      "ページ、コマ割り、構図、セリフを確認する",
      "ネームを採用してCanvas下書きを作る",
    ],
  },
  {
    number: 5,
    id: "cloud-creator-operation-guide",
    title: "原稿編集",
    duration: "約1分",
    description: "人物・画風を固定し、画像候補の採用、文字調整、PDF完成まで進めます。",
    actions: [
      "人物・衣装・画風・参照画像を保存する",
      "連続2ページで生成候補を確認して採用する",
      "文字を調整し、全ページ確定・完成版固定・PDF保存へ進む",
    ],
  },
  {
    number: 6,
    id: "06-work-management-guide",
    title: "作品管理",
    duration: "約25秒",
    description: "作品一覧から制作状態を確認し、編集再開または販売準備へ進みます。",
    actions: [
      "作品一覧から対象作品を開く",
      "原稿・完成版・PDFの状態を確認する",
      "原稿編集を続けるか販売準備へ進む",
    ],
  },
  {
    number: 7,
    id: "07-sales-preparation-guide",
    title: "販売準備",
    duration: "約25秒",
    description: "固定した完成版から販売下書きを作り、公開と販売開始を順番に行います。",
    actions: [
      "完成版・作品情報・税込価格を確認する",
      "非公開・販売停止中の下書きを作る",
      "作品公開後、商品情報を再確認して販売を開始する",
    ],
  },
  {
    number: 8,
    id: "08-sales-management-guide",
    title: "収益管理",
    duration: "約25秒",
    description: "注文区分、金額、支払い・返金状態を作品ごとに確認します。",
    actions: [
      "売上サマリーと注文一覧を確認する",
      "本番注文とテスト注文を区別する",
      "作品ごとの販売数・金額・状態を確認する",
    ],
  },
] as const;

export function CloudCreatorOperationVideo() {
  return (
    <div className="mt-5 space-y-4">
      {manuals.map((manual) => {
        const basePath = `/manual/cloud/${manual.id}`;
        return (
          <details
            className="panel overflow-hidden border-violet-200 p-0"
            id={`video-step-${manual.number}`}
            key={manual.id}
            open={manual.number === 1}
          >
            <summary className="cursor-pointer list-none p-4 marker:hidden sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-800">
                  {manual.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-violet-700">
                    STEP {manual.number} / 8
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-stone-900">
                    {manual.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {manual.description}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                  {manual.duration}
                </span>
              </div>
            </summary>

            <div className="border-t border-violet-100">
              <video
                aria-label={`ステップ${manual.number} ${manual.title}の動画マニュアル`}
                className="aspect-video h-auto w-full bg-stone-950"
                controls
                playsInline
                poster={`${basePath}-poster.webp`}
                preload="metadata"
              >
                <source src={`${basePath}.mp4`} type="video/mp4" />
                <track
                  default
                  kind="captions"
                  label="日本語字幕"
                  src={`${basePath}.vtt`}
                  srcLang="ja"
                />
                お使いのブラウザでは動画を再生できません。下の文字版手順をご利用ください。
              </video>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <p className="flex items-center gap-2 text-sm font-bold text-stone-800">
                    <PlayCircle className="h-5 w-5 text-violet-700" aria-hidden="true" />
                    音声なし・日本語字幕付き・実画面に沿った匿名化表示
                  </p>
                  <a
                    className="button-secondary shrink-0"
                    download={`MANGAI-STEP${manual.number}-${manual.title}.mp4`}
                    href={`${basePath}.mp4`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    この動画を保存
                  </a>
                </div>
                <ol className="grid gap-2 sm:grid-cols-3">
                  {manual.actions.map((action, index) => (
                    <li className="rounded-xl bg-violet-50 p-3 text-sm leading-relaxed text-violet-950" key={action}>
                      <span className="font-bold text-violet-700">{index + 1}. </span>
                      {action}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

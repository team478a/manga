import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  MailCheck,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";

const dailyChecks = [
  "停止・期限切れ・AI上限到達の利用者がいないか",
  "未対応フィードバック、とくに評価1・途中で進めなかった報告がないか",
  "同じ画面や工程で複数人が止まっていないか",
  "AI利用数が短時間に急増していないか",
] as const;

export default async function GeneralMonitorStaffGuidePage() {
  await requireAdmin();

  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/admin/general-monitors">
        ← モニター管理へ
      </Link>
      <header className="mt-5">
        <p className="text-sm font-bold text-violet-700">運営スタッフ専用</p>
        <h1 className="mt-1 text-3xl font-bold">10名モニターテスト運用マニュアル</h1>
        <p className="mt-2 leading-relaxed text-stone-600">
          招待から日次確認、問い合わせ、停止までを同じ手順で運用するための
          Webマニュアルです。
        </p>
      </header>

      <section className="panel mt-7 border-violet-200 bg-violet-50">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-violet-700" />
          <h2 className="text-xl font-bold">開始前チェック</h2>
        </div>
        <ul className="mt-4 space-y-3">
          {[
            "Preview Supabaseへ指定された3つのmigrationを順番に適用した",
            "一般向けFeature Flagだけを対象Previewブランチで有効にした",
            "成人向け、Stripe、販売、Marketplaceは停止している",
            "招待メール設定でResend APIキーと認証済み送信元を保存した",
            "スタッフ1名で招待メールから市場分析まで事前確認した",
          ].map((item) => (
            <li className="flex gap-2" key={item}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <UsersRound className="h-6 w-6 text-violet-700" />
          <h2 className="text-2xl font-bold">10名を招待する手順</h2>
        </div>
        <ol className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            {
              title: "1. アカウントを確認",
              body: "対象者が登録済みで、表示名とメールアドレスが正しいことを確認します。",
            },
            {
              title: "2. 共通のコホート名を設定",
              body: "例として「general-monitor-2026-08」のように、10名を同じ名前でまとめます。",
            },
            {
              title: "3. 期限とAI上限を設定",
              body: "全員に同じ基準を使います。変更する場合は管理メモへ理由を残します。",
            },
            {
              title: "4. 1名ずつ招待",
              body: "ユーザー詳細から招待し、メール送信成功の案内を確認します。",
            },
            {
              title: "5. 送信失敗だけ再送",
              body: "招待登録済みか確認してから再送します。重複して招待し直さないでください。",
            },
            {
              title: "6. 初回確認を追跡",
              body: "モニター一覧で、利用開始・AI利用数・フィードバックを確認します。",
            },
          ].map((step) => (
            <article className="panel" key={step.title}>
              <h3 className="font-bold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-stone-600">{step.body}</p>
            </article>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link className="button-secondary" href="/admin/users">
            ユーザー管理を開く
          </Link>
          <Link
            className="button-secondary"
            href="/admin/general-monitors/email"
          >
            招待メール設定を開く
          </Link>
        </div>
      </section>

      <section className="panel mt-8">
        <h2 className="text-2xl font-bold">スタッフの日次確認</h2>
        <p className="mt-2 text-stone-600">
          1日1回、同じ担当者が確認し、問い合わせの重複対応を防ぎます。
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {dailyChecks.map((item) => (
            <li className="rounded-xl bg-stone-50 p-4" key={item}>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link className="button bg-violet-700 hover:bg-violet-800" href="/admin/general-monitors">
            利用状況・感想を確認
          </Link>
          <Link className="button-secondary" href="/admin/general-monitors/export">
            CSVを出力
          </Link>
        </div>
      </section>

      <section className="panel mt-8">
        <div className="flex items-center gap-2">
          <MailCheck className="h-6 w-6 text-violet-700" />
          <h2 className="text-2xl font-bold">問い合わせ対応ルール</h2>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-stone-700">
          <li>対象ユーザー、画面、工程、発生時刻を確認する。</li>
          <li>パスワードやAPIキーを送らないよう案内する。</li>
          <li>管理画面で状態、期限、AI残数を確認する。</li>
          <li>再現しない場合は端末、ブラウザ、スクリーンショットを受け取る。</li>
          <li>フィードバックを「対応中」にし、管理メモへ対応内容を残す。</li>
          <li>解決後に「対応済み」へ変更する。</li>
        </ol>
      </section>

      <section className="panel mt-8 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-900">
          <ShieldAlert className="h-6 w-6" />
          <h2 className="text-2xl font-bold">停止判断</h2>
        </div>
        <p className="mt-3 leading-relaxed text-red-900">
          誤操作の反復、個人情報の入力、一般向け範囲外の利用、費用の異常増加がある場合は
          対象者を一時停止します。複数人で同じ重大障害が発生した場合は、全体の
          Feature Flagを停止して再デプロイし、原因確認まで再開しません。
        </p>
      </section>

      <section className="panel mt-8">
        <h2 className="text-2xl font-bold">テスト完了の目安</h2>
        <ul className="mt-4 space-y-2 text-stone-700">
          <li>・10名全員がログインと初回案内を完了した</li>
          <li>・市場分析を保存し、履歴から再表示できた</li>
          <li>・少なくとも数名が企画以降の工程へ進めた</li>
          <li>・スマートフォンとPCの両方で操作結果が集まった</li>
          <li>・重大な権限漏れ、秘密情報露出、横スクロールがない</li>
          <li>・未対応の重大フィードバックがない</li>
        </ul>
      </section>
    </main>
  );
}

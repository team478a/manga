import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Rocket,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCloudGeneralMonitorReadiness } from "@/lib/cloud-general-monitor-readiness";

function numberLabel(value: number | null) {
  return value === null ? "確認不可" : `${value}名`;
}

export default async function GeneralMonitorReadinessPage() {
  await requireAdmin();
  const readiness = await getCloudGeneralMonitorReadiness();

  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/admin/general-monitors">
        ← モニター管理へ
      </Link>
      <header className="mt-5">
        <p className="text-sm font-bold text-violet-700">秘密値を表示しない事前確認</p>
        <h1 className="mt-1 text-3xl font-bold">テスト公開チェック</h1>
        <p className="mt-2 leading-relaxed text-stone-600">
          本番環境で約10名を招待する前に、一般向けモニターの実行条件をまとめて確認します。
          APIキー本体や内部エラーは表示しません。
        </p>
      </header>

      <section
        className={`mt-7 rounded-2xl border p-5 ${
          readiness.ready
            ? "border-green-200 bg-green-50 text-green-950"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
        role="status"
      >
        <div className="flex items-start gap-3">
          {readiness.ready ? (
            <Rocket className="mt-0.5 h-6 w-6 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
          )}
          <div>
            <h2 className="text-xl font-bold">
              {readiness.ready
                ? "システム設定はテスト公開可能です"
                : "招待前に確認が必要な項目があります"}
            </h2>
            <p className="mt-1 text-sm">
              {readiness.ready
                ? "最初にスタッフ1名で動作確認し、その後モニターを段階的に招待してください。"
                : "下の「要確認」を解消し、画面を再読み込みしてください。"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {readiness.checks.map((check) => (
          <article className="panel min-w-0" key={check.key}>
            <div className="flex items-center gap-2">
              {check.ready ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <CircleDashed className="h-5 w-5 shrink-0 text-amber-600" />
              )}
              <p className="text-sm font-bold text-stone-500">
                {check.ready ? "準備完了" : "要確認"}
              </p>
            </div>
            <h2 className="mt-3 text-lg font-bold">{check.label}</h2>
            <p className="mt-2 break-words text-sm leading-relaxed text-stone-600">
              {check.detail}
            </p>
            {!check.ready && check.nextSteps?.length ? (
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
                {check.nextSteps.map((step) => (
                  <li className="break-words" key={step}>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            {check.href ? (
              <Link className="mt-4 inline-block text-sm font-bold text-violet-700 underline" href={check.href}>
                設定画面を開く
              </Link>
            ) : null}
          </article>
        ))}
      </section>

      <section className="panel mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-violet-700">一般向け画像生成</p>
            <h2 className="mt-1 text-2xl font-bold">1コマ受入れチェック</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              有料APIを誤って連続実行しないよう、スタッフ用作品の1コマだけで順番に確認します。
            </p>
          </div>
          <Link className="button-secondary whitespace-nowrap" href="/admin/cloud-ai">
            画像生成AI管理
          </Link>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["処理待ち", readiness.stats.imageQueued],
            ["実行中", readiness.stats.imageRunning],
            ["24時間以内の失敗", readiness.stats.imageFailedLast24Hours],
          ].map(([label, value]) => (
            <div className="rounded-xl bg-stone-50 p-4" key={label}>
              <dt className="text-sm text-stone-500">{label}</dt>
              <dd className="mt-1 text-2xl font-bold">
                {value === null ? "確認不可" : `${value}件`}
              </dd>
            </div>
          ))}
        </dl>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li>上の公開条件をすべて「準備完了」にする。</li>
          <li>スタッフ用の一般向け作品を開き、1コマだけ画像生成を依頼する。</li>
          <li>処理待ちになったことを確認し、Workerを1回実行する。</li>
          <li>候補画像を比較し、採用・再生成・元に戻す操作を確認する。</li>
          <li>ページを保存し、PDFとPNGに採用画像が反映されることを確認する。</li>
        </ol>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link className="button bg-violet-700 hover:bg-violet-800" href="/creator">
            スタッフ用作品を開く
          </Link>
          <Link className="button-secondary" href="/admin/cloud-ai">
            QueueとWorkerを確認
          </Link>
        </div>
      </section>

      <section className="panel mt-8">
        <h2 className="text-2xl font-bold">現在のテスト状況</h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["登録済み", numberLabel(readiness.stats.enrolled)],
            ["利用中", numberLabel(readiness.stats.active)],
            ["初回確認済み", numberLabel(readiness.stats.onboarded)],
            [
              "未完了の声",
              readiness.stats.openFeedback === null
                ? "確認不可"
                : `${readiness.stats.openFeedback}件`,
            ],
          ].map(([label, value]) => (
            <div className="rounded-xl bg-stone-50 p-4" key={label}>
              <dt className="text-sm text-stone-500">{label}</dt>
              <dd className="mt-1 text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel mt-8">
        <h2 className="text-2xl font-bold">公開開始の順番</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-stone-700">
          <li>この画面をすべて「準備完了」にする。</li>
          <li>スタッフ1名を招待し、メール受信・ログイン・市場分析保存まで確認する。</li>
          <li>問題がなければ2〜3名へ広げ、1日確認する。</li>
          <li>重大な問題がなければ残りのモニターを招待する。</li>
          <li>毎日、利用数と未完了フィードバックを確認する。</li>
        </ol>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link className="button bg-violet-700 hover:bg-violet-800" href="/admin/users">
            ユーザー管理へ
          </Link>
          <Link className="button-secondary" href="/admin/general-monitors/guide">
            スタッフマニュアル
          </Link>
        </div>
      </section>
    </main>
  );
}

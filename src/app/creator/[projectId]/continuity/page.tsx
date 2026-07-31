import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info, ScanSearch } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import {
  getCloudContinuityReview,
  getCloudProjectWorkspace,
} from "@/lib/cloud-creator-server";

export default async function CloudContinuityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireProfile();
  const { projectId } = await params;
  const [workspace, result] = await Promise.all([
    getCloudProjectWorkspace(projectId).catch(() => null),
    getCloudContinuityReview(projectId).catch(() => null),
  ]);
  if (!workspace) notFound();

  return (
    <main className="page">
      <Link className="text-violet-700 underline" href={`/creator/${projectId}`}>
        ← 作品詳細へ
      </Link>
      <div className="mt-4 flex items-start gap-3">
        <ScanSearch className="mt-1 h-8 w-8 text-violet-700" />
        <div>
          <h1 className="text-3xl font-bold">一貫性チェック</h1>
          <p className="mt-2 text-stone-600">{workspace.project.title}</p>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
        採用画像の生成履歴から、人物・衣装・場所・小物・画風に使った設定版と参照画像を確認します。
        画像の見た目そのものを判定する機能ではありません。
      </div>

      {!result ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">チェック結果を読み込めませんでした</h2>
          <p className="mt-2 text-stone-600">
            時間をおいて再度確認してください。作品データや外部サービスの内部情報は表示していません。
          </p>
        </section>
      ) : !result.available ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">チェックを利用できません</h2>
          <p className="mt-2 text-stone-600">
            参照画像機能を含む最新のデータベース構成を適用してから再度確認してください。
          </p>
        </section>
      ) : result.review.generatedPanelCount === 0 ? (
        <section className="panel mt-6 text-center">
          <Info className="mx-auto h-9 w-9 text-violet-700" />
          <h2 className="mt-3 text-xl font-bold">チェック対象の生成画像はありません</h2>
          <p className="mt-2 text-stone-600">
            ページ編集画面で生成候補をコマへ採用すると、ここで設定の一貫性を確認できます。
          </p>
          <Link className="button-primary mt-5 inline-flex" href={`/creator/${projectId}`}>
            ページを選ぶ
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="panel">
              <p className="text-sm text-stone-500">採用済み生成画像</p>
              <p className="mt-1 text-3xl font-bold">{result.review.generatedPanelCount}</p>
            </div>
            <div className="panel">
              <p className="text-sm text-stone-500">履歴確認済み</p>
              <p className="mt-1 text-3xl font-bold">{result.review.reviewedPanelCount}</p>
            </div>
            <div className="panel">
              <p className="text-sm text-stone-500">要確認</p>
              <p className="mt-1 text-3xl font-bold text-amber-800">
                {result.review.warningCount}
              </p>
            </div>
          </section>

          <section className="panel mt-6">
            <div className="flex items-center gap-2">
              {result.review.warningCount === 0 ? (
                <CheckCircle2 className="h-6 w-6 text-green-700" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-700" />
              )}
              <h2 className="text-xl font-bold">
                {result.review.warningCount === 0
                  ? "設定の一貫性を確認できました"
                  : "確認が必要な項目があります"}
              </h2>
            </div>
            {result.review.issues.length ? (
              <ul className="mt-5 space-y-3">
                {result.review.issues.map((issue, index) => (
                  <li
                    className={`rounded-lg border p-4 text-sm ${
                      issue.severity === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : "border-blue-200 bg-blue-50 text-blue-950"
                    }`}
                    key={`${issue.code}-${issue.pageId ?? "project"}-${issue.panelId ?? index}`}
                  >
                    <p className="font-semibold">{issue.message}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {issue.pageId ? (
                        <Link
                          className="underline"
                          href={`/creator/${projectId}/pages/${issue.pageId}`}
                        >
                          ページを開く
                        </Link>
                      ) : null}
                      <Link
                        className="underline"
                        href={`/creator/${projectId}/references`}
                      >
                        参照画像と割当を確認
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-stone-600">
                採用済み生成画像は、現在の固定設定と同じ版を使用しています。
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

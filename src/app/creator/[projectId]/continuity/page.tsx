import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info, ListPlus, ScanSearch, Trash2 } from "lucide-react";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import {
  getCloudContinuityReview,
  getCloudContinuitySuggestions,
  getCloudNarrativeContinuity,
  getCloudProjectWorkspace,
} from "@/lib/cloud-creator-server";
import {
  deleteContinuityFactAction,
  deletePlotThreadAction,
  saveContinuityFactAction,
  savePlotThreadAction,
} from "./actions";

const factKindLabels = { appearance:"外見・衣装",location:"場所",relationship:"人物関係",timeline:"時系列",prop:"小物",speech:"口調・呼称" } as const;
const threadStatusLabels = { planned:"予定",planted:"提示済み",resolved:"回収済み",dropped:"不採用" } as const;

export default async function CloudContinuityPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  const [workspace, result, narrative, candidateResult] = await Promise.all([
    getCloudProjectWorkspace(projectId).catch(() => null),
    getCloudContinuityReview(projectId).catch(() => null),
    getCloudNarrativeContinuity(projectId).catch(() => null),
    getCloudContinuitySuggestions(projectId).catch(() => null),
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
        作品内の事実と伏線を記録し、ページ範囲が重なる矛盾を自動検出します。採用画像については、
        人物・衣装・場所・小物・画風に使った設定版と参照画像も確認します。画像の見た目そのものを判定する機能ではありません。
      </div>

      {query.message ? <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{query.message}</div> : null}
      {query.error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error}</div> : null}

      {!narrative ? (
        <section className="panel mt-6"><h2 className="text-xl font-bold">物語設定を読み込めませんでした</h2><p className="mt-2 text-stone-600">時間をおいて再度確認してください。</p></section>
      ) : !narrative.available ? (
        <section className="panel mt-6"><h2 className="text-xl font-bold">物語の連続性台帳は準備中です</h2><p className="mt-2 text-stone-600">最新のデータベース構成を適用すると、事実と伏線を保存できます。従来の画像設定チェックは引き続き利用できます。</p></section>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="panel"><p className="text-sm text-stone-500">登録した事実</p><p className="mt-1 text-3xl font-bold">{narrative.review.factCount}</p></div>
            <div className="panel"><p className="text-sm text-stone-500">伏線</p><p className="mt-1 text-3xl font-bold">{narrative.review.threadCount}</p></div>
            <div className="panel"><p className="text-sm text-stone-500">未回収</p><p className="mt-1 text-3xl font-bold">{narrative.review.openThreadCount}</p></div>
            <div className="panel"><p className="text-sm text-stone-500">物語の要確認</p><p className="mt-1 text-3xl font-bold text-amber-800">{narrative.review.warningCount}</p></div>
          </section>

          <section className="panel mt-6">
            <div className="flex items-start gap-3">
              <ListPlus className="mt-1 h-6 w-6 text-violet-700" />
              <div>
                <h2 className="text-xl font-bold">確定済み設定から見つかった候補</h2>
                <p className="mt-2 text-sm text-stone-600">
                  キャラクター、場所・小物、ページに割り当てたシーン構成だけを読み取っています。内容を確認して登録した候補だけが正式な事実になります。
                </p>
              </div>
            </div>
            {!candidateResult ? (
              <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-600">候補を読み込めませんでした。手動登録は引き続き利用できます。</p>
            ) : !candidateResult.available ? (
              <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-600">設定候補の抽出は準備中です。キャラクター・作品設定機能を適用後に利用できます。</p>
            ) : candidateResult.suggestions.length ? (
              <ul className="mt-5 grid gap-3 lg:grid-cols-2">
                {candidateResult.suggestions.slice(0, 24).map((candidate) => (
                  <li className="rounded-lg border border-violet-100 bg-violet-50/40 p-4" key={candidate.id}>
                    <p className="text-xs font-semibold text-violet-700">{candidate.sourceLabel}</p>
                    <p className="mt-1 font-bold">{candidate.subject}・{candidate.attribute}</p>
                    <p className="mt-1 break-words text-sm text-stone-700">{candidate.factValue}</p>
                    <p className="mt-2 text-xs text-stone-500">{candidate.startPage}〜{candidate.endPage}ページの候補</p>
                    <form action={saveContinuityFactAction.bind(null, projectId)} className="mt-3">
                      <input name="factKind" type="hidden" value={candidate.factKind} />
                      <input name="subject" type="hidden" value={candidate.subject} />
                      <input name="attribute" type="hidden" value={candidate.attribute} />
                      <input name="factValue" type="hidden" value={candidate.factValue} />
                      <input name="startPage" type="hidden" value={candidate.startPage} />
                      <input name="endPage" type="hidden" value={candidate.endPage} />
                      <input name="sourcePage" type="hidden" value={candidate.sourcePage ?? ""} />
                      <input name="notes" type="hidden" value={candidate.notes} />
                      <PendingSubmitButton className="button-secondary" pendingLabel="登録中…">確認して台帳へ登録</PendingSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-900">新しい候補はありません。設定を追加・更新すると、未登録の候補がここに表示されます。</p>
            )}
            {candidateResult && candidateResult.suggestions.length > 24 ? <p className="mt-3 text-xs text-stone-500">候補が多いため先頭24件を表示しています。登録後に残りの候補が表示されます。</p> : null}
          </section>

          {narrative.review.issues.length ? <section className="panel mt-6"><h2 className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="h-6 w-6 text-amber-700" />物語設定の確認項目</h2><ul className="mt-4 space-y-3">{narrative.review.issues.map((issue,index)=><li className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" key={`${issue.code}-${issue.threadId ?? index}`}>{issue.message}</li>)}</ul></section> : null}

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="panel">
              <h2 className="text-xl font-bold">事実を登録</h2><p className="mt-2 text-sm text-stone-600">衣装、居場所、関係、時系列、所持品、呼び方を有効なページ範囲と一緒に記録します。</p>
              <form action={saveContinuityFactAction.bind(null,projectId)} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label><span className="label">種類</span><select className="field" name="factKind" defaultValue="appearance">{Object.entries(factKindLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
                <label><span className="label">対象</span><input className="field" name="subject" required maxLength={100} placeholder="例：主人公" /></label>
                <label><span className="label">項目</span><input className="field" name="attribute" required maxLength={100} placeholder="例：上着" /></label>
                <label><span className="label">設定内容</span><input className="field" name="factValue" required maxLength={500} placeholder="例：青いコート" /></label>
                <label><span className="label">開始ページ</span><input className="field" name="startPage" type="number" min={1} max={1000} defaultValue={1} required /></label>
                <label><span className="label">終了ページ</span><input className="field" name="endPage" type="number" min={1} max={1000} defaultValue={Math.max(workspace.pages.length,1)} required /></label>
                <label><span className="label">確認元ページ（任意）</span><input className="field" name="sourcePage" type="number" min={1} max={1000} /></label>
                <label><span className="label">メモ（任意）</span><input className="field" name="notes" maxLength={1000} /></label>
                <PendingSubmitButton className="button-primary sm:col-span-2" pendingLabel="保存中…">事実を保存</PendingSubmitButton>
              </form>
            </div>
            <div className="panel">
              <h2 className="text-xl font-bold">伏線を登録</h2><p className="mt-2 text-sm text-stone-600">提示ページと回収予定を記録すると、回収漏れを警告します。</p>
              <form action={savePlotThreadAction.bind(null,projectId)} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="label">伏線</span><input className="field" name="title" required maxLength={150} placeholder="例：壊れた懐中時計の持ち主" /></label>
                <label><span className="label">提示ページ</span><input className="field" name="setupPage" type="number" min={1} max={1000} defaultValue={1} required /></label>
                <label><span className="label">回収予定ページ</span><input className="field" name="targetPayoffPage" type="number" min={1} max={1000} /></label>
                <label><span className="label">状態</span><select className="field" name="status" defaultValue="planned">{Object.entries(threadStatusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
                <label><span className="label">回収ページ（回収済み時）</span><input className="field" name="payoffPage" type="number" min={1} max={1000} /></label>
                <label className="sm:col-span-2"><span className="label">メモ（任意）</span><input className="field" name="notes" maxLength={1000} /></label>
                <PendingSubmitButton className="button-primary sm:col-span-2" pendingLabel="保存中…">伏線を保存</PendingSubmitButton>
              </form>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="panel"><h2 className="text-xl font-bold">事実台帳</h2>{narrative.facts.length ? <ul className="mt-4 space-y-3">{narrative.facts.map((fact)=><li className="rounded-lg border border-stone-200 p-4" key={fact.id}><div className="flex justify-between gap-3"><div><p className="font-bold">{fact.subject}・{fact.attribute}</p><p className="mt-1 text-stone-700">{fact.fact_value}</p><p className="mt-2 text-xs text-stone-500">{factKindLabels[fact.fact_kind]}／{fact.start_page}〜{fact.end_page}ページ</p></div><form action={deleteContinuityFactAction.bind(null,projectId,fact.id)}><PendingSubmitButton className="button-secondary" aria-label="事実を削除" pendingLabel="削除中…"><Trash2 className="h-4 w-4" /></PendingSubmitButton></form></div></li>)}</ul> : <p className="mt-3 text-stone-600">まだ事実はありません。</p>}</div>
            <div className="panel"><h2 className="text-xl font-bold">伏線台帳</h2>{narrative.threads.length ? <ul className="mt-4 space-y-3">{narrative.threads.map((thread)=><li className="rounded-lg border border-stone-200 p-4" key={thread.id}><div className="flex justify-between gap-3"><div><p className="font-bold">{thread.title}</p><p className="mt-2 text-xs text-stone-500">{threadStatusLabels[thread.status]}／提示 {thread.setup_page}ページ{thread.target_payoff_page ? `／回収予定 ${thread.target_payoff_page}ページ` : ""}{thread.payoff_page ? `／回収 ${thread.payoff_page}ページ` : ""}</p></div><form action={deletePlotThreadAction.bind(null,projectId,thread.id)}><PendingSubmitButton className="button-secondary" aria-label="伏線を削除" pendingLabel="削除中…"><Trash2 className="h-4 w-4" /></PendingSubmitButton></form></div><form action={savePlotThreadAction.bind(null,projectId)} className="mt-3 flex flex-wrap items-end gap-2"><input name="threadId" type="hidden" value={thread.id} /><input name="title" type="hidden" value={thread.title} /><input name="setupPage" type="hidden" value={thread.setup_page} /><input name="targetPayoffPage" type="hidden" value={thread.target_payoff_page ?? ""} /><input name="notes" type="hidden" value={thread.notes} /><label><span className="label">状態を更新</span><select className="field" name="status" defaultValue={thread.status}>{Object.entries(threadStatusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label><span className="label">回収ページ</span><input className="field w-32" name="payoffPage" type="number" min={thread.setup_page} max={1000} defaultValue={thread.payoff_page ?? ""} /></label><PendingSubmitButton className="button-secondary" pendingLabel="更新中…">更新</PendingSubmitButton></form></li>)}</ul> : <p className="mt-3 text-stone-600">まだ伏線はありません。</p>}</div>
          </section>
        </>
      )}

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

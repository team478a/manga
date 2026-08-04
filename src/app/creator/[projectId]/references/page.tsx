/* eslint-disable @next/next/no-img-element -- Private short-lived signed URLs are used. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageCanvasSchema } from "@mangai/canvas-core";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { CloudDataNotice } from "@/components/CloudDataNotice";
import { requireProfile } from "@/lib/auth";
import {
  getCloudPageSnapshot,
  getCloudProjectWorkspace,
  getCloudVisualReferenceWorkspace,
  getCloudWorldBible,
  listCloudCharacterProfiles,
} from "@/lib/cloud-creator-server";
import { safelyLoadCloudData } from "@/lib/cloud-runtime-resilience";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import {
  assignPanelSubjectAction,
  deletePanelAssignmentAction,
  deleteVisualReferenceAction,
  uploadVisualReferenceAction,
} from "./actions";

const kindLabel = {
  character: "キャラクター",
  style: "画風",
  location: "場所",
  prop: "小物",
} as const;

export default async function VisualReferencesPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  const workspaceLoad = await safelyLoadCloudData(
    "creator/references/workspace",
    () => getCloudProjectWorkspace(projectId),
    null,
    { shouldRethrow: (error) => error instanceof ResourceNotFoundError },
  ).catch(() => notFound());
  if (!workspaceLoad.ok || !workspaceLoad.value) return <main className="page"><h1 className="text-3xl font-bold">参照画像とコマ割当</h1><CloudDataNotice className="mt-6">作品情報を一時的に読み込めません。時間をおいて再読み込みしてください。</CloudDataNotice><Link className="button-secondary mt-5" href="/creator">作品一覧へ戻る</Link></main>;
  const workspace = workspaceLoad.value;
  const [charactersLoad, worldLoad, referenceLoad] = await Promise.all([
    safelyLoadCloudData(
      "creator/references/characters",
      () => listCloudCharacterProfiles(projectId),
      { available: false, profiles: [] },
    ),
    safelyLoadCloudData(
      "creator/references/world",
      () => getCloudWorldBible(projectId),
      { available: false, styleBible: null, profiles: [] },
    ),
    safelyLoadCloudData(
      "creator/references/assets",
      () => getCloudVisualReferenceWorkspace(projectId),
      { available: false, references: [], assignments: [] },
    ),
  ]);
  const characters = charactersLoad.value;
  const world = worldLoad.value;
  const referenceWorkspace = referenceLoad.value;
  const subjects = [
    ...characters.profiles.map((item) => ({ kind: "character" as const, id: item.id, name: item.name })),
    ...(world.styleBible ? [{ kind: "style" as const, id: world.styleBible.id, name: "作品全体の画風" }] : []),
    ...world.profiles.map((item) => ({ kind: item.kind, id: item.id, name: item.name })),
  ];
  const panelLoads = await Promise.allSettled(workspace.pages.map(async (page) => {
    const snapshot = await getCloudPageSnapshot(page.id);
    const canvas = pageCanvasSchema.parse(snapshot.canvas);
    return canvas.panels.map((panel, index) => ({
      pageId: page.id,
      panelId: panel.id,
      label: `${page.page_number}ページ・${index + 1}コマ`,
    }));
  }));
  const panels = panelLoads.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const panelsUnavailable = panelLoads.some((result) => result.status === "rejected");
  const subjectSettingsUnavailable = !charactersLoad.ok || !worldLoad.ok;
  const subjectName = new Map(subjects.map((item) => [`${item.kind}:${item.id}`, item.name]));
  const panelName = new Map(panels.map((item) => [`${item.pageId}:${item.panelId}`, item.label]));

  return <main className="page">
    <Link className="text-violet-700 underline" href={`/creator/${projectId}`}>← {workspace.project.title}へ戻る</Link>
    <h1 className="mt-4 text-3xl font-bold">参照画像とコマ割当</h1>
    <p className="mt-2 text-stone-600">顔・衣装・画風・場所・小物の見本を保存し、必要な設定をコマへ明示的に割り当てます。</p>
    {query.message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800">{query.message}</p> : null}
    {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{query.error}</p> : null}
    {subjectSettingsUnavailable ? <CloudDataNotice className="mt-6">キャラクターまたは世界観設定を一時的に読み込めません。既存の参照画像は確認できますが、新しい関連付けを停止しています。</CloudDataNotice> : null}
    {panelsUnavailable ? <CloudDataNotice className="mt-5">一部ページのコマ情報を読み込めません。そのページへの割当だけを一時的に停止しています。</CloudDataNotice> : null}
    {!referenceLoad.ok ? <CloudDataNotice className="mt-6">参照画像と割当を一時的に読み込めません。作品データや保存済み画像は削除されていません。</CloudDataNotice> : !referenceWorkspace.available ? <section className="panel mt-6"><h2 className="text-xl font-bold">準備が必要です</h2><p className="mt-2">参照画像migrationを適用すると利用できます。</p></section> : <>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">参照画像を追加</h2>
        {subjectSettingsUnavailable ? <p className="mt-3 text-sm text-stone-600">設定対象を再確認できるまで追加を停止しています。</p> : <form action={uploadVisualReferenceAction.bind(null, projectId)} className="mt-4 grid gap-4 md:grid-cols-2">
          <label><span className="label">設定対象</span><select className="field" name="subject" required><option value="">選択してください</option>{subjects.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{kindLabel[item.kind]}：{item.name}</option>)}</select></label>
          <label><span className="label">画像</span><input className="field" name="file" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
          <label className="md:col-span-2"><span className="label">用途メモ</span><input className="field" name="label" maxLength={120} placeholder="正面の顔、基本衣装、背景の外観など" /></label>
          <div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">参照画像を保存</PendingSubmitButton></div>
        </form>}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">設定をコマへ割り当て</h2>
        <p className="mt-2 text-sm text-stone-600">ネーム上の名前が一致しない場合でも、この割当を生成条件として優先します。</p>
        {subjectSettingsUnavailable || !panels.length ? <p className="mt-3 text-sm text-stone-600">設定対象とコマ情報を確認できるまで割当を停止しています。</p> : <form action={assignPanelSubjectAction.bind(null, projectId)} className="mt-4 grid gap-4 md:grid-cols-2">
          <label><span className="label">キャラクター・場所・小物</span><select className="field" name="subject" required><option value="">選択してください</option>{subjects.filter((item) => item.kind !== "style").map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{kindLabel[item.kind]}：{item.name}</option>)}</select></label>
          <label><span className="label">割当先</span><select className="field" name="panel" required><option value="">選択してください</option>{panels.map((item) => <option key={`${item.pageId}:${item.panelId}`} value={`${item.pageId}:${item.panelId}`}>{item.label}</option>)}</select></label>
          <div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="割当中…">コマへ割り当て</PendingSubmitButton></div>
        </form>}
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="参照画像">
        {referenceWorkspace.references.map((reference) => <article className="panel" key={reference.id}>
          <img alt={reference.label || "参照画像"} className="h-48 w-full rounded-lg bg-stone-100 object-contain" src={reference.url} />
          <p className="mt-3 font-bold">{kindLabel[reference.subject_kind]}：{subjectName.get(`${reference.subject_kind}:${reference.subject_id}`) ?? "設定"}</p>
          {reference.label ? <p className="text-sm text-stone-600">{reference.label}</p> : null}
          <form action={deleteVisualReferenceAction.bind(null, projectId, reference.id)} className="mt-3"><PendingSubmitButton className="button-secondary text-red-700" pendingLabel="解除中…">関連付けを解除</PendingSubmitButton></form>
        </article>)}
        {!referenceWorkspace.references.length ? <div className="panel text-center text-stone-600 md:col-span-2">参照画像はまだありません。</div> : null}
      </section>
      <section className="panel mt-6"><h2 className="text-xl font-bold">コマへの割当一覧</h2><div className="mt-4 space-y-3">{referenceWorkspace.assignments.map((assignment) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={assignment.id}><span>{panelName.get(`${assignment.page_id}:${assignment.panel_id}`) ?? "コマ"}：{kindLabel[assignment.subject_kind]}「{subjectName.get(`${assignment.subject_kind}:${assignment.subject_id}`) ?? "設定"}」</span><form action={deletePanelAssignmentAction.bind(null, projectId, assignment.id)}><PendingSubmitButton className="button-secondary" pendingLabel="解除中…">解除</PendingSubmitButton></form></div>)}{!referenceWorkspace.assignments.length ? <p className="text-stone-600">明示割当はまだありません。</p> : null}</div></section>
    </>}
  </main>;
}

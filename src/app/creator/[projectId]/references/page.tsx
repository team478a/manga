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
  listCloudAssets,
  listCloudCharacterProfiles,
} from "@/lib/cloud-creator-server";
import { safelyLoadCloudData } from "@/lib/cloud-runtime-resilience";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import {
  assignPanelSubjectAction,
  deleteCharacterReferenceBindingAction,deleteCharacterStateAssignmentAction,
  deletePanelContinuityStateAction,
  deletePanelAssignmentAction,
  deleteVisualReferenceAction,
  linkExistingVisualReferenceAction,
  uploadVisualReferenceAction,
  saveCharacterReferenceBindingAction,saveCharacterStateAssignmentAction,saveGenerationReadinessPolicyAction,
  savePanelContinuityStateAction,
} from "./actions";

const kindLabel = {
  character: "キャラクター",
  style: "画風",
  location: "場所",
  prop: "小物",
} as const;
const roleLabel={front:"正面",side:"側面",back:"背面",face:"顔アップ",full_body:"全身",expression:"表情",costume_detail:"衣装詳細"}as const;

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
  const [charactersLoad, worldLoad, referenceLoad, assetsLoad] = await Promise.all([
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
      { available: false, references: [], assignments: [],p1Available:false,characterVersions:[],bindings:[],stateAssignments:[],readinessPolicy:"block" as const,continuityAvailable:false,continuityStates:[] },
    ),
    safelyLoadCloudData(
      "creator/references/project-assets",
      () => listCloudAssets(projectId),
      [],
    ),
  ]);
  const characters = charactersLoad.value;
  const world = worldLoad.value;
  const referenceWorkspace = referenceLoad.value;
  const reusableAssets = assetsLoad.value.slice(0, 60);
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
  const characterName=new Map(characters.profiles.map(item=>[item.id,item.name]));
  const characterVersionOptions=referenceWorkspace.characterVersions.map(version=>({value:`${version.profile_id}:${version.id}`,label:`${characterName.get(version.profile_id)??"人物"}・v${version.version_number}`,current:characters.profiles.some(profile=>profile.id===version.profile_id&&profile.current_version===version.version_number)}));
  const referenceName=new Map(referenceWorkspace.references.map(item=>[item.asset_id,item.label||`${kindLabel[item.subject_kind]}参照`]));

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
        <h2 className="text-xl font-bold">既存の画像素材から追加</h2>
        <p className="mt-2 text-sm text-stone-600">この作品に保存済みの画像を再アップロードせず、そのまま参照画像として利用します。</p>
        {!assetsLoad.ok ? <CloudDataNotice className="mt-4">画像素材を一時的に読み込めません。時間をおいて再読み込みしてください。</CloudDataNotice> : subjectSettingsUnavailable ? <p className="mt-4 text-sm text-stone-600">設定対象を再確認できるまで追加を停止しています。</p> : reusableAssets.length ? <form action={linkExistingVisualReferenceAction.bind(null, projectId)} className="mt-4 space-y-4">
          <label><span className="label">設定対象</span><select className="field" name="subject" required><option value="">選択してください</option>{subjects.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{kindLabel[item.kind]}：{item.name}</option>)}</select></label>
          <fieldset>
            <legend className="label">画像素材</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reusableAssets.map((asset) => <label className="cursor-pointer rounded-lg border p-2 transition has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50" key={asset.id}>
                <input className="sr-only" name="asset" required type="radio" value={asset.id} />
                <img alt={asset.file_name} className="h-40 w-full rounded bg-stone-100 object-contain" src={asset.url} />
                <span className="mt-2 block truncate text-xs text-stone-600">{asset.file_name}</span>
              </label>)}
            </div>
          </fieldset>
          <label><span className="label">用途メモ</span><input className="field" name="label" maxLength={120} placeholder="作品全体の線・陰影の基準など" /></label>
          <PendingSubmitButton className="button" pendingLabel="設定中…">選択した画像を参照に追加</PendingSubmitButton>
        </form> : <p className="mt-4 text-sm text-stone-600">利用できる画像素材はまだありません。</p>}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">生成準備方針</h2><p className="mt-2 text-sm text-stone-600">主要人物に承認済みの正面または顔参照がない場合の動作です。</p>
        {!referenceWorkspace.p1Available?<p className="mt-3 text-sm text-stone-600">P1 migration適用後に利用できます。</p>:<form action={saveGenerationReadinessPolicyAction.bind(null,projectId)} className="mt-4 flex flex-wrap items-end gap-3"><label><span className="label">参照不足時</span><select className="field" name="policy" defaultValue={referenceWorkspace.readinessPolicy}><option value="block">生成を停止</option><option value="warn">警告して続行可能</option></select></label><PendingSubmitButton className="button" pendingLabel="保存中…">方針を保存</PendingSubmitButton></form>}
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">人物versionへ参照roleを設定</h2><p className="mt-2 text-sm text-stone-600">既存参照画像を人物の特定versionへ結び付けます。生成に使うには承認済みにしてください。</p>
        {!referenceWorkspace.p1Available||!characterVersionOptions.length?<p className="mt-3 text-sm text-stone-600">人物versionとP1 migrationを確認してください。</p>:<form action={saveCharacterReferenceBindingAction.bind(null,projectId)} className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="label">人物version</span><select className="field" name="characterVersion" required>{characterVersionOptions.map(item=><option key={item.value} value={item.value}>{item.label}{item.current?"（現在）":""}</option>)}</select></label><label><span className="label">参照画像</span><select className="field" name="assetId" required>{referenceWorkspace.references.filter(item=>item.subject_kind==="character").map(item=><option key={item.id} value={item.asset_id}>{characterName.get(item.subject_id)??"人物"}：{item.label||"参照画像"}</option>)}</select></label><label><span className="label">role</span><select className="field" name="role">{Object.entries(roleLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label><span className="label">表情名（表情roleのみ）</span><input className="field" name="expressionKey" maxLength={80}/></label><label><span className="label">優先度 0〜100</span><input className="field" name="priority" type="number" min="0" max="100" defaultValue="50"/></label><label><span className="label">確認状態</span><select className="field" name="reviewStatus"><option value="draft">下書き</option><option value="approved">承認済み</option><option value="rejected">不採用</option></select></label><div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">versionへ設定</PendingSubmitButton></div></form>}
        <div className="mt-4 space-y-2">{referenceWorkspace.bindings.map(binding=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={binding.id}><span>{characterName.get(binding.character_profile_id)??"人物"}・{roleLabel[binding.reference_role as keyof typeof roleLabel]}・{binding.review_status}・優先度{binding.priority}（{referenceName.get(binding.asset_id)??"画像"}）</span><form action={deleteCharacterReferenceBindingAction.bind(null,projectId,binding.id)}><PendingSubmitButton className="button-secondary" pendingLabel="解除中…">解除</PendingSubmitButton></form></div>)}</div>
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">衣装・状態の適用範囲</h2><p className="mt-2 text-sm text-stone-600">同じ人物version内で、衣装や負傷などを適用するページ範囲を重複なしで保存します。</p>
        {!referenceWorkspace.p1Available||!characterVersionOptions.length?<p className="mt-3 text-sm text-stone-600">人物versionとP1 migrationを確認してください。</p>:<form action={saveCharacterStateAssignmentAction.bind(null,projectId)} className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="label">人物version</span><select className="field" name="characterVersion">{characterVersionOptions.map(item=><option key={item.value} value={item.value}>{item.label}{item.current?"（現在）":""}</option>)}</select></label><label><span className="label">範囲名</span><input className="field" name="assignmentLabel" required maxLength={120} placeholder="第1章・制服"/></label><label><span className="label">開始ページ</span><input className="field" name="startPage" type="number" min="1" required/></label><label><span className="label">終了ページ</span><input className="field" name="endPage" type="number" min="1" required/></label><label><span className="label">scene key（任意）</span><input className="field" name="sceneKey" maxLength={120}/></label><label><span className="label">優先度</span><input className="field" name="priority" type="number" min="0" max="100" defaultValue="0"/></label><label><span className="label">衣装</span><textarea className="field min-h-20" name="costumeOverride" maxLength={500}/></label><label><span className="label">状態</span><textarea className="field min-h-20" name="stateNote" maxLength={500}/></label><div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">適用範囲を保存</PendingSubmitButton></div></form>}
        <div className="mt-4 space-y-2">{referenceWorkspace.stateAssignments.map(item=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={item.id}><span>{characterName.get(item.character_profile_id)??"人物"}：{item.start_page}〜{item.end_page}ページ「{item.assignment_label}」{item.costume_override?`・衣装 ${item.costume_override}`:""}</span><form action={deleteCharacterStateAssignmentAction.bind(null,projectId,item.id)}><PendingSubmitButton className="button-secondary" pendingLabel="解除中…">解除</PendingSubmitButton></form></div>)}</div>
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">コマの連続状態</h2><p className="mt-2 text-sm text-stone-600">時間帯・天候・状態・持ち手・画面上の左右・視線と、前コマからの継続を構造化して保存します。</p>
        {!referenceWorkspace.continuityAvailable||!panels.length?<p className="mt-3 text-sm text-stone-600">P1-D migrationとコマ情報を確認してください。</p>:<form action={savePanelContinuityStateAction.bind(null,projectId)} className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="label">対象</span><select className="field" name="subject" required>{subjects.filter(item=>item.kind!=="style").map(item=><option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{kindLabel[item.kind]}：{item.name}</option>)}</select></label><label><span className="label">対象コマ</span><select className="field" name="panel" required>{panels.map(item=><option key={`${item.pageId}:${item.panelId}`} value={`${item.pageId}:${item.panelId}`}>{item.label}</option>)}</select></label><label><span className="label">時間帯</span><input className="field" name="timeOfDay" maxLength={80} placeholder="夕方"/></label><label><span className="label">天候</span><input className="field" name="weather" maxLength={80} placeholder="小雨"/></label><label><span className="label">持ち手</span><select className="field" name="holdingHand" defaultValue="unspecified"><option value="unspecified">未指定</option><option value="left">左手</option><option value="right">右手</option><option value="both">両手</option><option value="none">持っていない</option></select></label><label><span className="label">画面上の位置</span><select className="field" name="screenSide" defaultValue="unspecified"><option value="unspecified">未指定</option><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select></label><label><span className="label">視線</span><input className="field" name="gazeDirection" maxLength={120} placeholder="画面右の相手を見る"/></label><label><span className="label">継続元コマ（任意）</span><select className="field" name="continuesFromPanelId"><option value="">新しい状態</option>{panels.map(item=><option key={item.panelId} value={item.panelId}>{item.label}</option>)}</select></label><label className="md:col-span-2"><span className="label">状態</span><textarea className="field min-h-20" name="stateNote" maxLength={500} placeholder="右手に赤い傘、上着は濡れている"/></label><div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">連続状態を保存</PendingSubmitButton></div></form>}
        <div className="mt-4 space-y-2">{referenceWorkspace.continuityStates.map(item=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={item.id}><span>{panelName.get(`${item.page_id}:${item.panel_id}`)??"コマ"}：{kindLabel[item.subject_kind as keyof typeof kindLabel]}「{subjectName.get(`${item.subject_kind}:${item.subject_id}`)??"設定"}」{item.time_of_day?`・${item.time_of_day}`:""}{item.weather?`・${item.weather}`:""}{item.state_note?`・${item.state_note}`:""}</span><form action={deletePanelContinuityStateAction.bind(null,projectId,item.id)}><PendingSubmitButton className="button-secondary" pendingLabel="解除中…">解除</PendingSubmitButton></form></div>)}</div>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { getCloudProjectWorkspace, getCloudWorldBible } from "@/lib/cloud-creator-server";
import type { CloudWorldProfile } from "@/lib/cloud-world-bible";
import {
  deleteWorldProfileAction,
  saveStyleBibleAction,
  saveWorldProfileAction,
} from "./actions";

export default async function WorldBiblePage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  const workspace = await getCloudProjectWorkspace(projectId).catch(() => null);
  if (!workspace) notFound();
  const result = await getCloudWorldBible(projectId);
  return <main className="page">
    <Link className="text-violet-700 underline" href={`/creator/${projectId}`}>← {workspace.project.title}へ戻る</Link>
    <h1 className="mt-4 text-3xl font-bold">画風・世界観設定</h1>
    <p className="mt-2 text-stone-600">作品全体でそろえる画風、場所、小物の見た目を保存します。技術的なAI設定は必要ありません。</p>
    {query.message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800">{query.message}</p> : null}
    {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{query.error}</p> : null}
    {!result.available ? <section className="panel mt-6"><h2 className="text-xl font-bold">準備が必要です</h2><p className="mt-2">画風・世界観migrationを適用すると利用できます。</p></section> : <>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">作品全体の画風 {result.styleBible ? `・設定 v${result.styleBible.current_version}` : ""}</h2>
        <form action={saveStyleBibleAction.bind(null, projectId)} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="画風" name="artStyle" value={result.styleBible?.art_style} placeholder="繊細な青年漫画、映画的" />
          <Field label="線の表現" name="linework" value={result.styleBible?.linework} placeholder="細い均一線、輪郭は明瞭" />
          <Field label="陰影・トーン" name="shading" value={result.styleBible?.shading} placeholder="網点中心、強い黒ベタは要所のみ" />
          <Field label="背景の密度" name="backgroundDetail" value={result.styleBible?.background_detail} placeholder="主要コマは詳細、会話コマは簡潔" />
          <Field label="構図の共通ルール" name="compositionRules" value={result.styleBible?.composition_rules} wide rows={3} />
          <Field label="作品全体で避ける表現" name="negativePrompt" value={result.styleBible?.negative_prompt} wide rows={3} />
          <div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">{result.styleBible ? "新しい版として保存" : "画風を保存"}</PendingSubmitButton></div>
        </form>
      </section>
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">新しい場所・小物</h2>
        <WorldForm projectId={projectId} />
      </section>
      <section className="mt-6 space-y-4" aria-label="保存済みの場所と小物">
        {result.profiles.map((profile) => <details className="panel" key={profile.id}>
          <summary className="cursor-pointer font-bold">{profile.name}<span className="ml-2 text-sm font-normal text-stone-500">{profile.kind === "location" ? "場所" : "小物"}・設定 v{profile.current_version}</span></summary>
          <WorldForm projectId={projectId} profile={profile} />
          <form action={deleteWorldProfileAction.bind(null, projectId, profile.id)} className="mt-3 text-right"><PendingSubmitButton className="button-secondary text-red-700" pendingLabel="削除中…">削除</PendingSubmitButton></form>
        </details>)}
        {!result.profiles.length ? <div className="panel text-center text-stone-600">設定済みの場所・小物はまだありません。</div> : null}
      </section>
    </>}
  </main>;
}

function Field({ label, name, value, placeholder, wide, rows = 2 }: { label: string; name: string; value?: string; placeholder?: string; wide?: boolean; rows?: number }) {
  return <label className={wide ? "block md:col-span-2" : "block"}><span className="label">{label}</span><textarea className="field" name={name} defaultValue={value} placeholder={placeholder} maxLength={name === "negativePrompt" ? 1500 : name === "compositionRules" ? 1000 : 500} rows={rows} /></label>;
}

function WorldForm({ projectId, profile }: { projectId: string; profile?: CloudWorldProfile }) {
  return <form action={saveWorldProfileAction.bind(null, projectId)} className="mt-5 grid gap-4 md:grid-cols-2">
    <input name="profileId" type="hidden" value={profile?.id ?? ""} />
    <label><span className="label">種類</span><select className="field" name="kind" defaultValue={profile?.kind ?? "location"}><option value="location">場所</option><option value="prop">小物</option></select></label>
    <label><span className="label">名前</span><input className="field" name="name" defaultValue={profile?.name} maxLength={100} required placeholder="駅前広場" /></label>
    <label className="md:col-span-2"><span className="label">概要</span><textarea className="field" name="description" defaultValue={profile?.description} maxLength={1000} rows={3} /></label>
    <label><span className="label">見た目の特徴（1行1項目）</span><textarea className="field" name="visualTraits" defaultValue={profile?.visual_traits.join("\n")} maxLength={1500} rows={4} /></label>
    <label><span className="label">変えてはいけない点（1行1項目）</span><textarea className="field" name="continuityRules" defaultValue={profile?.continuity_rules.join("\n")} maxLength={1500} rows={4} /></label>
    <label><span className="label">配色</span><input className="field" name="colorPalette" defaultValue={profile?.color_palette} maxLength={300} /></label>
    <label><span className="label">生成時の追加条件</span><textarea className="field" name="prompt" defaultValue={profile?.prompt} maxLength={3000} rows={3} /></label>
    <label className="md:col-span-2"><span className="label">避ける変化</span><textarea className="field" name="negativePrompt" defaultValue={profile?.negative_prompt} maxLength={1500} rows={3} /></label>
    <div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">{profile ? "新しい版として保存" : "場所・小物を追加"}</PendingSubmitButton></div>
  </form>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { getCloudProjectWorkspace, listCloudCharacterProfiles } from "@/lib/cloud-creator-server";
import { deleteCharacterProfileAction, saveCharacterProfileAction } from "./actions";
import { CloudDataNotice } from "@/components/CloudDataNotice";
import { safelyLoadCloudData } from "@/lib/cloud-runtime-resilience";
import { ResourceNotFoundError } from "@/lib/domain-errors";

const roleLabel = { protagonist: "主人公", supporting: "登場人物", antagonist: "対立人物", other: "その他" } as const;

export default async function CharacterProfilesPage({ params, searchParams }: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireProfile();
  const { projectId } = await params;const query = await searchParams;
  const workspaceLoad = await safelyLoadCloudData(
    "creator/characters/workspace",
    () => getCloudProjectWorkspace(projectId),
    null,
    { shouldRethrow: (error) => error instanceof ResourceNotFoundError },
  ).catch(() => notFound());
  if (!workspaceLoad.ok || !workspaceLoad.value) return <main className="page"><h1 className="text-3xl font-bold">キャラクター設定</h1><CloudDataNotice className="mt-6">作品情報を一時的に読み込めません。時間をおいて再読み込みしてください。</CloudDataNotice><Link className="button-secondary mt-5" href="/creator">作品一覧へ戻る</Link></main>;
  const workspace = workspaceLoad.value;
  const resultLoad = await safelyLoadCloudData(
    "creator/characters/profiles",
    () => listCloudCharacterProfiles(projectId),
    { available: false, profiles: [] },
  );
  const result = resultLoad.value;
  return <main className="page">
    <Link className="text-violet-700 underline" href={`/creator/${projectId}`}>← {workspace.project.title}へ戻る</Link>
    <h1 className="mt-4 text-3xl font-bold">キャラクター設定</h1>
    <p className="mt-2 text-stone-600">ページをまたいで変えない外見・衣装・特徴を保存します。更新するたびに履歴が残ります。</p>
    {query.message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800">{query.message}</p> : null}
    {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{query.error}</p> : null}
    {!resultLoad.ok ? <CloudDataNotice className="mt-6">キャラクター設定を一時的に読み込めません。作品とページの編集は影響を受けません。</CloudDataNotice> : !result.available ? <section className="panel mt-6"><h2 className="text-xl font-bold">準備が必要です</h2><p className="mt-2">キャラクターProfile migrationを適用すると利用できます。</p></section> : <>
      <section className="panel mt-6"><h2 className="text-xl font-bold">新しいキャラクター</h2><CharacterForm projectId={projectId} /></section>
      <section className="mt-6 space-y-4" aria-label="保存済みキャラクター">
        {result.profiles.map((profile) => <details className="panel" key={profile.id}>
          <summary className="cursor-pointer font-bold">{profile.name} <span className="ml-2 text-sm font-normal text-stone-500">{roleLabel[profile.role]}・設定 v{profile.current_version}</span></summary>
          <CharacterForm projectId={projectId} profile={profile} />
          <form action={deleteCharacterProfileAction.bind(null,projectId,profile.id)} className="mt-3 text-right"><PendingSubmitButton className="button-secondary text-red-700" pendingLabel="削除中…">削除</PendingSubmitButton></form>
        </details>)}
        {!result.profiles.length ? <div className="panel text-center text-stone-600">設定済みキャラクターはまだありません。</div> : null}
      </section>
    </>}
  </main>;
}

function CharacterForm({ projectId, profile }: { projectId: string; profile?: Awaited<ReturnType<typeof listCloudCharacterProfiles>>["profiles"][number] }) {
  return <form action={saveCharacterProfileAction.bind(null,projectId)} className="mt-5 grid gap-4 md:grid-cols-2">
    <input name="profileId" type="hidden" value={profile?.id ?? ""} />
    <label className="block"><span className="label">名前</span><input className="field" name="name" defaultValue={profile?.name} required maxLength={100} /></label>
    <label className="block"><span className="label">役割</span><select className="field" name="role" defaultValue={profile?.role ?? "supporting"}>{Object.entries(roleLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block"><span className="label">見た目の年齢</span><input className="field" name="appearanceAge" defaultValue={profile?.appearance_age} maxLength={120} placeholder="20代前半" /></label>
    <label className="block"><span className="label">体格</span><input className="field" name="bodyBuild" defaultValue={profile?.body_build} maxLength={300} placeholder="小柄、細身" /></label>
    <label className="block"><span className="label">髪型・髪色</span><textarea className="field min-h-20" name="hair" defaultValue={profile?.hair} maxLength={300} /></label>
    <label className="block"><span className="label">基本衣装</span><textarea className="field min-h-20" name="costume" defaultValue={profile?.costume} maxLength={500} /></label>
    <label className="block"><span className="label">配色</span><input className="field" name="colorPalette" defaultValue={profile?.color_palette} maxLength={300} /></label>
    <label className="block"><span className="label">変えてはいけない特徴（1行1項目）</span><textarea className="field min-h-24" name="immutableTraits" defaultValue={profile?.immutable_traits.join("\n")} maxLength={1500} /></label>
    <label className="block md:col-span-2"><span className="label">生成時に追加する外見条件</span><textarea className="field min-h-24" name="prompt" defaultValue={profile?.prompt} maxLength={3000} /></label>
    <label className="block md:col-span-2"><span className="label">避ける外見・変更</span><textarea className="field min-h-20" name="negativePrompt" defaultValue={profile?.negative_prompt} maxLength={1500} /></label>
    <div className="md:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">{profile ? "新しい版として保存" : "キャラクターを追加"}</PendingSubmitButton></div>
  </form>;
}

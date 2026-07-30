import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getCloudProposalSelection } from "@/lib/cloud-proposal-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { getLatestCloudScenarioAdoption, listCloudScenarioVersions } from "@/lib/cloud-scenario-server";
import { createCloudScenarioAction } from "./actions";
import { ScenarioSubmitButton } from "./scenario-buttons";
import { getCloudAdultScenarioAccess } from "@/lib/cloud-adult-scenario";
import { consentCloudAdultScenarioAction } from "./actions";

export default async function ScenarioPage({ params, searchParams }: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled()) redirect("/dashboard/research");
  const { reportId } = await params;
  const query = await searchParams;
  const { profile } = await requireProfile();
  const selection = await getCloudProposalSelection(profile.id, reportId);
  if (!selection) notFound();
  const enabled = cloudScenarioFeatureEnabled();
  const adultAccess = selection.content_class === "adult"
    ? await getCloudAdultScenarioAccess(profile.id)
    : null;
  const available = enabled && (selection.content_class === "general" || adultAccess?.allowed === true);
  const [versions, adoption] = available
    ? await Promise.all([
        listCloudScenarioVersions(profile.id, selection.id),
        getLatestCloudScenarioAdoption(profile.id, selection.id),
      ])
    : [[], null];
  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href={`/dashboard/research/${reportId}/proposal`}>
        ← AI企画提案へ
      </Link>
      <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 3</p>
      <h1 className="mt-2 text-3xl font-bold">シナリオ生成</h1>
      <p className="mt-2 text-stone-600">採用した企画を、人物・三幕構成・ページ単位のシーンへ具体化します。</p>
      <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${selection.content_class === "adult" ? "bg-rose-50 text-rose-800" : "bg-violet-50 text-violet-800"}`}>
        {selection.content_class === "adult" ? "成人向け" : "一般向け"}
      </span>
      {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{query.error}</p> : null}
      {query.message ? <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800" role="status">{query.message}</p> : null}
      <section className="panel mt-6 border-violet-200">
        <p className="text-sm font-bold text-violet-700">採用済み企画</p>
        <h2 className="mt-2 text-2xl font-bold">{selection.candidate_snapshot.title}</h2>
        <p className="mt-3 leading-relaxed text-stone-700">{selection.candidate_snapshot.logline}</p>
      </section>
      {!enabled ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-950">AIシナリオ生成は現在停止中です。</p>
      ) : selection.content_class === "adult" && adultAccess?.reason === "consent_required" ? (
        <form action={consentCloudAdultScenarioAction.bind(null, reportId)} className="panel mt-6">
          <h2 className="text-xl font-bold">成人向けAIシナリオの利用条件</h2>
          <p className="mt-2 text-stone-600">企画内容を管理画面で設定済みの外部AIへ送信します。APIキーは画面やログへ表示されません。</p>
          <div className="mt-5 space-y-3">
            {[
              ["confirmed18Plus", "私は18歳以上です"],
              ["fictionalAdultsOnly", "登場人物は架空かつ18歳以上の成人だけです"],
              ["consensualOnly", "合意のある非搾取的な内容だけを扱います"],
              ["noRealPerson", "実在人物を題材にしません"],
              ["providerDisclosureAccepted", "外部AIへの送信に同意します"],
            ].map(([name, label]) => <label className="flex items-start gap-3" key={name}><input className="mt-1" name={name} type="checkbox" value="true" required /><span>{label}</span></label>)}
          </div>
          <button className="button mt-5 bg-rose-700 hover:bg-rose-800" type="submit">同意して利用を開始</button>
        </form>
      ) : selection.content_class === "adult" && !adultAccess?.allowed ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-950">成人向けAIシナリオは現在利用できません。管理者による機能許可と全体設定が必要です。</p>
      ) : versions.length ? (
        <section className="mt-6">
          <h2 className="text-xl font-bold">シナリオ版履歴</h2>
          <div className="mt-4 space-y-3">
            {versions.map((version, index) => (
              <Link className="panel flex flex-col gap-2 transition hover:border-violet-300 sm:flex-row sm:items-center sm:justify-between"
                href={`/dashboard/research/${reportId}/proposal/scenario/versions/${version.id}`} key={version.id}>
                <span>
                  <strong>{version.result.title}</strong>
                  <span className="ml-2 text-sm text-stone-500">v{versions.length - index}</span>
                </span>
                <span className="text-sm text-stone-600">
                  {adoption?.scenario_version_id === version.id ? "採用版 · " : ""}
                  {new Date(version.created_at).toLocaleString("ja-JP")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <form action={createCloudScenarioAction.bind(null, reportId)} className="panel mt-6 text-center">
          <h2 className="text-xl font-bold">初稿を作成</h2>
          <p className="mt-2 text-stone-600">AIが採用企画と区分を保ったまま、漫画制作用の構成へ変換します。</p>
          <div className="mt-5"><ScenarioSubmitButton>AIで初稿シナリオを作る</ScenarioSubmitButton></div>
        </form>
      )}
    </main>
  );
}

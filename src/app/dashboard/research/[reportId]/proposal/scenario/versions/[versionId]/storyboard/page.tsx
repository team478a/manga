import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { getCloudScenarioVersion, getLatestCloudScenarioAdoption } from "@/lib/cloud-scenario-server";
import { cloudStoryboardFeatureEnabled } from "@/lib/cloud-storyboard";
import { getLatestCloudStoryboardAdoption, listCloudStoryboardVersions } from "@/lib/cloud-storyboard-server";
import { consentCloudAdultStoryboardAction, createCloudStoryboardAction } from "./actions";
import { StoryboardButton } from "./storyboard-button";
import { getCloudAdultStoryboardAccess } from "@/lib/cloud-adult-storyboard";

export default async function StoryboardPage({ params, searchParams }: {
  params: Promise<{ reportId: string; versionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled()) redirect("/dashboard/research");
  const { reportId, versionId } = await params;
  const { error } = await searchParams;
  const { profile } = await requireProfile();
  const scenario = await getCloudScenarioVersion(profile.id, versionId).catch(() => notFound());
  if (scenario.research_report_id !== reportId) notFound();
  const scenarioAdoption = await getLatestCloudScenarioAdoption(profile.id, scenario.proposal_selection_id);
  if (scenarioAdoption?.scenario_version_id !== scenario.id) notFound();
  const adultAccess = scenario.content_class === "adult"
    ? await getCloudAdultStoryboardAccess(profile.id)
    : null;
  const featureEnabled = cloudStoryboardFeatureEnabled() &&
    (scenario.content_class === "general" || adultAccess?.allowed === true);
  const [versions, adoption] = featureEnabled ? await Promise.all([
    listCloudStoryboardVersions(profile.id, scenario.id),
    getLatestCloudStoryboardAdoption(profile.id, scenario.id),
  ]) : [[], null];
  return <main className="page max-w-5xl">
    <Link className="text-violet-700 underline" href={`/dashboard/research/${reportId}/proposal/scenario/versions/${scenario.id}`}>← 採用シナリオへ</Link>
    <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 4</p>
    <h1 className="mt-2 text-3xl font-bold">AIネーム・ページ構成</h1>
    <p className="mt-2 text-stone-600">採用シナリオを、右綴じ漫画のページとコマへ具体化します。</p>
    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${scenario.content_class === "adult" ? "bg-rose-50 text-rose-800" : "bg-violet-50 text-violet-800"}`}>{scenario.content_class === "adult" ? "成人向け" : "一般向け"}</span>
    {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
    <section className="panel mt-6 border-violet-200"><p className="text-sm font-bold text-violet-700">採用シナリオ</p><h2 className="mt-2 text-2xl font-bold">{scenario.result.title}</h2><p className="mt-2 text-stone-600">{scenario.result.pageCount}ページ · {scenario.result.oneSentencePitch}</p></section>
    {scenario.content_class === "adult" && adultAccess?.reason === "consent_required" ? <form action={consentCloudAdultStoryboardAction.bind(null, reportId, scenario.id)} className="panel mt-6 space-y-4">
      <h2 className="text-xl font-bold">成人向けAIネームの利用確認</h2>
      <p className="text-sm text-stone-600">この工程ではシナリオと修正指示を設定済み外部AIへ送信します。APIキーは画面やログへ表示しません。</p>
      {[["confirmed18Plus", "私は18歳以上です"], ["fictionalAdultsOnly", "架空かつ18歳以上の人物だけを扱います"], ["consensualOnly", "合意のある非搾取的な内容だけを扱います"], ["noRealPerson", "実在人物を扱いません"], ["providerDisclosureAccepted", "外部AIへの送信に同意します"]].map(([name, label]) => <label className="flex items-start gap-3" key={name}><input className="mt-1" name={name} type="checkbox" value="true" required /><span>{label}</span></label>)}
      <StoryboardButton>同意して成人向けネームへ進む</StoryboardButton>
    </form> : !featureEnabled ? <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-950">{scenario.content_class === "adult" ? "成人向けAIネームは現在利用できません。管理者による機能許可をご確認ください。" : "AIネーム生成は現在停止中です。"}</p> :
      versions.length ? <section className="mt-6"><h2 className="text-xl font-bold">ネーム版履歴</h2><div className="mt-4 space-y-3">{versions.map((version, index) =>
        <Link className="panel flex flex-col gap-2 transition hover:border-violet-300 sm:flex-row sm:items-center sm:justify-between" href={`/dashboard/research/${reportId}/proposal/scenario/versions/${scenario.id}/storyboard/versions/${version.id}`} key={version.id}>
          <strong>{version.result.title} <span className="text-sm text-stone-500">v{versions.length - index} · {version.content_class === "adult" ? "成人向け" : "一般向け"}</span></strong>
          <span className="text-sm text-stone-600">{adoption?.storyboard_version_id === version.id ? "採用版 · " : ""}{new Date(version.created_at).toLocaleString("ja-JP")}</span>
        </Link>)}</div></section> :
      <form action={createCloudStoryboardAction.bind(null, reportId, scenario.id)} className="panel mt-6 text-center"><h2 className="text-xl font-bold">初稿ネームを作成</h2><p className="mt-2 text-stone-600">ページ配分、コマ割り、構図、セリフをAIが設計します。</p><div className="mt-5"><StoryboardButton>AIで初稿ネームを作る</StoryboardButton></div></form>}
  </main>;
}

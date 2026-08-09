import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { getCloudScenarioVersion, getLatestCloudScenarioAdoption } from "@/lib/cloud-scenario-server";
import { cloudStoryboardFeatureEnabled } from "@/lib/cloud-storyboard";
import { getLatestCloudStoryboardAdoption, listCloudStoryboardVersions } from "@/lib/cloud-storyboard-server";
import { createCloudStoryboardAction } from "./actions";
import { StoryboardButton } from "./storyboard-button";
import { CloudDataNotice } from "@/components/CloudDataNotice";
import { safelyLoadCloudData } from "@/lib/cloud-runtime-resilience";
import { ResourceNotFoundError } from "@/lib/domain-errors";

// Storyboard generation may use the provider for up to 120 seconds.
export const maxDuration = 180;

export default async function StoryboardPage({ params, searchParams }: {
  params: Promise<{ reportId: string; versionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled()) redirect("/dashboard/research");
  const { reportId, versionId } = await params;
  const { error } = await searchParams;
  const { profile } = await requireProfile();
  const scenario = await getCloudScenarioVersion(profile.id, versionId).catch((cause) => {
    if (cause instanceof ResourceNotFoundError) notFound();
    throw cause;
  });
  if (scenario.research_report_id !== reportId) notFound();
  const scenarioAdoptionLoad = await safelyLoadCloudData(
    "storyboard/scenario-adoption",
    () => getLatestCloudScenarioAdoption(profile.id, scenario.proposal_selection_id),
    null,
  );
  const scenarioAdoption = scenarioAdoptionLoad.value;
  if (scenarioAdoptionLoad.ok && scenarioAdoption?.scenario_version_id !== scenario.id) notFound();
  const featureEnabled = cloudStoryboardFeatureEnabled();
  const versionLoad = featureEnabled && scenarioAdoptionLoad.ok
    ? await safelyLoadCloudData(
        "storyboard/history",
        () => listCloudStoryboardVersions(profile.id, scenario.id),
        [],
      )
    : { ok: scenarioAdoptionLoad.ok, value: [] };
  const adoptionLoad = featureEnabled && scenarioAdoptionLoad.ok
    ? await safelyLoadCloudData(
        "storyboard/adoption",
        () => getLatestCloudStoryboardAdoption(profile.id, scenario.id),
        null,
      )
    : { ok: scenarioAdoptionLoad.ok, value: null };
  const versions = versionLoad.value;
  const adoption = adoptionLoad.value;
  return <main className="page max-w-5xl">
    <Link className="text-violet-700 underline" href={`/dashboard/research/${reportId}/proposal/scenario/versions/${scenario.id}`}>← 採用シナリオへ</Link>
    <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 4</p>
    <h1 className="mt-2 text-3xl font-bold">AIネーム・ページ構成</h1>
    <p className="mt-2 text-stone-600">採用シナリオを、右綴じ漫画のページとコマへ具体化します。</p>
    {error ? <InlineErrorMessage radius="lg" role="alert">{error}</InlineErrorMessage> : null}
    {!scenarioAdoptionLoad.ok ? <CloudDataNotice className="mt-5">採用シナリオの状態を一時的に確認できません。本文は閲覧できますが、ネーム生成を停止しています。</CloudDataNotice> : null}
    {scenarioAdoptionLoad.ok && !versionLoad.ok ? <CloudDataNotice className="mt-5">ネーム版履歴を一時的に確認できません。重複作成を防ぐため、新規生成を停止しています。</CloudDataNotice> : null}
    {!adoptionLoad.ok && scenarioAdoptionLoad.ok ? <CloudDataNotice className="mt-5">ネームの採用状態を一時的に確認できません。保存済みの履歴は引き続き確認できます。</CloudDataNotice> : null}
    <section className="panel mt-6 border-violet-200"><p className="text-sm font-bold text-violet-700">採用シナリオ</p><h2 className="mt-2 text-2xl font-bold">{scenario.result.title}</h2><p className="mt-2 text-stone-600">{scenario.result.pageCount}ページ · {scenario.result.oneSentencePitch}</p></section>
    {!featureEnabled ? <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-950">AIネーム生成は現在停止中です。</p> :
      !scenarioAdoptionLoad.ok || !versionLoad.ok ? null :
      versions.length ? <section className="mt-6"><h2 className="text-xl font-bold">ネーム版履歴</h2><div className="mt-4 space-y-3">{versions.map((version, index) =>
        <Link className="panel flex flex-col gap-2 transition hover:border-violet-300 sm:flex-row sm:items-center sm:justify-between" href={`/dashboard/research/${reportId}/proposal/scenario/versions/${scenario.id}/storyboard/versions/${version.id}`} key={version.id}>
          <strong>{version.result.title} <span className="text-sm text-stone-500">v{versions.length - index}</span></strong>
          <span className="text-sm text-stone-600">{adoption?.storyboard_version_id === version.id ? "採用版 · " : ""}{new Date(version.created_at).toLocaleString("ja-JP")}</span>
        </Link>)}</div></section> :
      <form action={createCloudStoryboardAction.bind(null, reportId, scenario.id)} className="panel mt-6 text-center"><h2 className="text-xl font-bold">初稿ネームを作成</h2><p className="mt-2 text-stone-600">ページ配分、コマ割り、構図、セリフをAIが設計します。</p><div className="mt-5"><StoryboardButton>AIで初稿ネームを作る</StoryboardButton></div></form>}
  </main>;
}

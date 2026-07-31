import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { getCloudProposalSelection } from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import {
  getCloudScenarioVersion,
  getLatestCloudScenarioAdoption,
} from "@/lib/cloud-scenario-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { adoptCloudScenarioAction, reviseCloudScenarioAction } from "../../actions";
import { ScenarioSubmitButton } from "../../scenario-buttons";

const role = { protagonist: "主人公", supporting: "主要人物", antagonist: "対立人物" } as const;
const act = { setup: "第1幕・導入", confrontation: "第2幕・対立", resolution: "第3幕・解決" } as const;

export default async function ScenarioVersionPage({ params, searchParams }: {
  params: Promise<{ reportId: string; versionId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled())
    redirect("/dashboard/research");
  const { reportId, versionId } = await params;
  const query = await searchParams;
  const { profile } = await requireProfile();
  const version = await getCloudScenarioVersion(profile.id, versionId).catch((error) => {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  });
  if (version.research_report_id !== reportId) notFound();
  const selection = await getCloudProposalSelection(profile.id, reportId);
  if (!selection || selection.id !== version.proposal_selection_id) notFound();
  const adoption = await getLatestCloudScenarioAdoption(profile.id, selection.id);
  const adopted = adoption?.scenario_version_id === version.id;
  const result = version.result;
  return (
    <main className="page max-w-6xl">
      <Link className="text-violet-700 underline" href={`/dashboard/research/${reportId}/proposal/scenario`}>← シナリオ版履歴へ</Link>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-bold text-violet-700">WORKFLOW 3</p><h1 className="mt-2 break-words text-3xl font-bold">{result.title}</h1></div>
        {adopted ? <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 font-bold text-emerald-800"><CheckCircle2 className="h-5 w-5" />採用版</span> : null}
      </div>
      <p className="mt-3 break-words text-lg leading-relaxed text-stone-700">{result.oneSentencePitch}</p>
      <p className="mt-2 text-sm text-stone-500">{result.pageCount}ページ · {new Date(version.created_at).toLocaleString("ja-JP")}</p>
      {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{query.error}</p> : null}
      {query.message ? <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800" role="status">{query.message}</p> : null}

      <section className="mt-8"><h2 className="text-2xl font-bold">登場人物</h2><div className="mt-4 grid gap-4 md:grid-cols-2">
        {result.characters.map((character) => <article className="panel" key={character.id}>
          <div className="flex items-center justify-between gap-2"><h3 className="text-xl font-bold">{character.name}</h3><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">{role[character.role]}</span></div>
          <dl className="mt-4 space-y-3 text-sm">{[["望み", character.desire], ["恐れ", character.fear], ["対立", character.conflict], ["変化", character.arc]].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="mt-1 break-words text-stone-600">{value}</dd></div>)}</dl>
        </article>)}
      </div></section>

      <section className="mt-8"><h2 className="text-2xl font-bold">三幕構成</h2><div className="mt-4 grid gap-4 lg:grid-cols-3">
        {result.acts.map((item) => <article className="panel" key={item.act}><p className="text-sm font-bold text-violet-700">{act[item.act]} · P{item.pageStart}–{item.pageEnd}</p><p className="mt-3 break-words">{item.purpose}</p><p className="mt-3 border-t pt-3 text-sm text-stone-600"><strong>転換点：</strong>{item.turningPoint}</p></article>)}
      </div></section>

      <section className="mt-8"><h2 className="text-2xl font-bold">シーン構成</h2><div className="mt-4 space-y-4">
        {result.scenes.map((scene) => <article className="panel" key={scene.index}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-bold">{scene.index}. {scene.title}</h3><span className="text-sm font-bold text-violet-700">P{scene.pageStart}–{scene.pageEnd}</span></div>
          <p className="mt-3 break-words leading-relaxed">{scene.summary}</p>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">{[["目的", scene.purpose], ["感情の動き", scene.emotionalBeat], ["次へ進むフック", scene.hook], ["会話の目標", scene.dialogueGoal]].map(([label, value]) => <div className="rounded-lg bg-violet-50 p-3" key={label}><dt className="font-bold">{label}</dt><dd className="mt-1 break-words text-stone-700">{value}</dd></div>)}</dl>
        </article>)}
      </div></section>

      <section className="panel mt-8"><h2 className="text-xl font-bold">商品企画との整合</h2><dl className="mt-4 grid gap-4 md:grid-cols-3">{[["冒頭フック", result.commercialAlignment.openingHook], ["読者への報酬", result.commercialAlignment.readerPayoff], ["差別化", result.commercialAlignment.differentiation]].map(([label, value]) => <div key={label}><dt className="font-bold">{label}</dt><dd className="mt-2 break-words text-stone-600">{value}</dd></div>)}</dl><h3 className="mt-5 font-bold">制作上の注意</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">{result.commercialAlignment.productionRisks.map((risk) => <li key={risk}>{risk}</li>)}</ul></section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <form action={reviseCloudScenarioAction.bind(null, reportId, version.id)} className="panel">
          <h2 className="text-xl font-bold">この版から修正版を作る</h2><label className="label mt-4" htmlFor="revisionInstruction">直したい内容</label>
          <textarea className="field" id="revisionInstruction" maxLength={2000} name="revisionInstruction" placeholder="例：主人公の決断を早め、最終シーンの読後感を明るくする" required rows={5} />
          <div className="mt-4"><ScenarioSubmitButton secondary>AIで修正版を作る</ScenarioSubmitButton></div>
        </form>
        <form action={adoptCloudScenarioAction.bind(null, reportId, version.id)} className="panel">
          <h2 className="text-xl font-bold">{adopted ? "マンガ生成の準備ができました" : "制作する版を決定"}</h2>
          <p className="mt-2 text-stone-600">{adopted ? "この版からAIネーム・ページ構成を作成できます。" : "内容を確認し、マンガ生成へ渡すシナリオを採用してください。"}</p>
          {!adopted ? <div className="mt-5"><ScenarioSubmitButton>このシナリオを採用</ScenarioSubmitButton></div> : null}
          {adopted ? <Link className="button mt-5 bg-violet-700 hover:bg-violet-800" href={`/dashboard/research/${reportId}/proposal/scenario/versions/${version.id}/storyboard`}>AIネーム生成へ進む</Link> : null}
        </form>
      </div>
    </main>
  );
}

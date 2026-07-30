import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { getCloudScenarioVersion, getLatestCloudScenarioAdoption } from "@/lib/cloud-scenario-server";
import { cloudStoryboardFeatureEnabled } from "@/lib/cloud-storyboard";
import { getCloudStoryboardVersion, getLatestCloudStoryboardAdoption } from "@/lib/cloud-storyboard-server";
import { cloudStoryboardCanvasFeatureEnabled } from "@/lib/cloud-storyboard-materialization";
import { getCloudStoryboardMaterialization } from "@/lib/cloud-storyboard-materialization-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { getCloudAdultStoryboardAccess } from "@/lib/cloud-adult-storyboard";
import { adoptCloudStoryboardAction, materializeCloudStoryboardAction, reviseCloudStoryboardAction } from "../../actions";
import { StoryboardButton } from "../../storyboard-button";

const shot = { extreme_close_up: "極端な寄り", close_up: "アップ", medium: "中景", wide: "引き", establishing: "状況説明", detail: "細部" } as const;
const angle = { eye_level: "目線", high: "俯瞰", low: "煽り", over_shoulder: "肩越し", top_down: "真上", dynamic: "動的" } as const;
const dialogueType = { speech: "セリフ", thought: "心の声", narration: "ナレーション" } as const;

export default async function StoryboardVersionPage({ params, searchParams }: {
  params: Promise<{ reportId: string; versionId: string; storyboardVersionId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled() || !cloudScenarioFeatureEnabled() || !cloudStoryboardFeatureEnabled()) redirect("/dashboard/research");
  const { reportId, versionId, storyboardVersionId } = await params;
  const query = await searchParams;
  const { profile } = await requireProfile();
  const [scenario, storyboard] = await Promise.all([
    getCloudScenarioVersion(profile.id, versionId),
    getCloudStoryboardVersion(profile.id, storyboardVersionId),
  ]).catch((error) => { if (error instanceof ResourceNotFoundError) notFound(); throw error; });
  if (scenario.research_report_id !== reportId ||
      storyboard.scenario_version_id !== scenario.id ||
      storyboard.content_class !== scenario.content_class) notFound();
  if (storyboard.content_class === "adult" &&
      !(await getCloudAdultStoryboardAccess(profile.id)).allowed)
    redirect(`/dashboard/research/${reportId}/proposal/scenario/versions/${scenario.id}/storyboard`);
  const scenarioAdoption = await getLatestCloudScenarioAdoption(profile.id, scenario.proposal_selection_id);
  if (scenarioAdoption?.scenario_version_id !== scenario.id) notFound();
  const adoption = await getLatestCloudStoryboardAdoption(profile.id, scenario.id);
  const adopted = adoption?.storyboard_version_id === storyboard.id;
  const materialization = adopted && storyboard.content_class === "general" && cloudStoryboardCanvasFeatureEnabled()
    ? await getCloudStoryboardMaterialization(profile.id, storyboard.id)
    : null;
  const result = storyboard.result;
  return <main className="page max-w-7xl">
    <Link className="text-violet-700 underline" href={`/dashboard/research/${reportId}/proposal/scenario/versions/${scenario.id}/storyboard`}>← ネーム版履歴へ</Link>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-violet-700">WORKFLOW 4</p><h1 className="mt-2 text-3xl font-bold">{result.title}</h1><p className="mt-2 text-stone-600">{result.pageCount}ページ · 右綴じ</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${storyboard.content_class === "adult" ? "bg-rose-50 text-rose-800" : "bg-violet-50 text-violet-800"}`}>{storyboard.content_class === "adult" ? "成人向け" : "一般向け"}</span></div>{adopted ? <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 font-bold text-emerald-800"><CheckCircle2 className="h-5 w-5" />採用版</span> : null}</div>
    {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{query.error}</p> : null}
    {query.message ? <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800" role="status">{query.message}</p> : null}
    <section className="mt-8"><h2 className="text-2xl font-bold">ページ・コマ構成</h2><div className="mt-4 grid gap-5 xl:grid-cols-2">{result.pages.map((page) =>
      <article className="panel min-w-0" key={page.pageNumber}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-violet-700">PAGE {page.pageNumber} · SCENE {page.sceneIndex}</p><h3 className="mt-1 font-bold">{page.purpose}</h3></div><span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold">{page.panels.length}コマ</span></div>
        <div className="mt-4 space-y-3">{page.panels.map((panel) => <div className="rounded-xl border border-stone-200 p-4" key={panel.index}>
          <div className="flex flex-wrap items-center gap-2"><strong>コマ{panel.index}</strong><span className="rounded bg-stone-100 px-2 py-1 text-xs">{shot[panel.shot]}</span><span className="rounded bg-stone-100 px-2 py-1 text-xs">{angle[panel.cameraAngle]}</span></div>
          <p className="mt-2 break-words text-sm"><strong>構図：</strong>{panel.composition}</p><p className="mt-1 break-words text-sm"><strong>動作：</strong>{panel.action}</p><p className="mt-1 break-words text-sm text-stone-600"><strong>背景：</strong>{panel.background}　<strong>感情：</strong>{panel.emotion}</p>
          {panel.characters.length ? <p className="mt-1 break-words text-sm text-stone-600"><strong>登場：</strong>{panel.characters.join("、")}</p> : null}
          {panel.dialogue.length ? <ul className="mt-3 space-y-1 border-l-2 border-violet-200 pl-3 text-sm">{panel.dialogue.map((line, index) => <li key={`${line.speaker}-${index}`}><span className="font-bold">{line.speaker}</span>（{dialogueType[line.type]}）「{line.text}」</li>)}</ul> : null}
        </div>)}</div><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>ページ送り：</strong>{page.pageTurnHook}</p>
      </article>)}</div></section>
    <section className="panel mt-8"><h2 className="text-xl font-bold">制作ノート</h2><p className="mt-3 text-stone-700">{result.productionNotes.pageRhythm}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="font-bold">視覚モチーフ</h3><ul className="mt-2 list-disc pl-5 text-stone-600">{result.productionNotes.visualMotifs.map((value) => <li key={value}>{value}</li>)}</ul></div><div><h3 className="font-bold">連続性の注意</h3><ul className="mt-2 list-disc pl-5 text-stone-600">{result.productionNotes.continuityRisks.map((value) => <li key={value}>{value}</li>)}</ul></div></div></section>
    <div className="mt-8 grid gap-5 lg:grid-cols-2"><form action={reviseCloudStoryboardAction.bind(null, reportId, scenario.id, storyboard.id)} className="panel"><h2 className="text-xl font-bold">この版から修正版を作る</h2><label className="label mt-4" htmlFor="revisionInstruction">直したい内容</label><textarea className="field" id="revisionInstruction" maxLength={2000} name="revisionInstruction" required rows={5} placeholder="例：冒頭3ページの展開を速め、セリフを減らす" /><div className="mt-4"><StoryboardButton secondary>AIで修正版を作る</StoryboardButton></div></form>
      <section className="panel"><h2 className="text-xl font-bold">{adopted ? (storyboard.content_class === "adult" ? "成人向けネームを採用しました" : "Cloud Canvas下書きへ進む") : "制作するネームを決定"}</h2><p className="mt-2 text-stone-600">{adopted ? (storyboard.content_class === "adult" ? "成人向けCanvas・画像生成は次フェーズです。このネームは一般向けCanvasへ送られません。" : "全ページのコマ枠・吹き出し・セリフを編集可能な下書きへ変換します。画像生成や課金は発生しません。") : "内容を確認し、次工程へ渡すネームを採用してください。"}</p>{!adopted ? <form action={adoptCloudStoryboardAction.bind(null, reportId, scenario.id, storyboard.id)} className="mt-5"><StoryboardButton>このネームを採用</StoryboardButton></form> : storyboard.content_class === "adult" ? <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">成人向けCanvas／画像生成には進みません。</p> : materialization ? <Link className="button mt-5 inline-flex" href={`/creator/${materialization.project_id}/pages/${materialization.first_page_id}`}>作成済みCanvasを開く</Link> : cloudStoryboardCanvasFeatureEnabled() ? <form action={materializeCloudStoryboardAction.bind(null, reportId, scenario.id, storyboard.id)} className="mt-5"><StoryboardButton>Canvas下書きを作成</StoryboardButton></form> : <p className="mt-5 rounded-lg bg-stone-100 p-3 text-sm text-stone-600">Canvas変換は現在準備中です。</p>}</section></div>
  </main>;
}

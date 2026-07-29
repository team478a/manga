import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import {
  confirmCloudScenarioAction,
  reviseCloudScenarioAction,
} from "@/app/dashboard/scenarios/actions";
import { createCloudMangaAction } from "@/app/dashboard/manga/actions";
import { requireProfile } from "@/lib/auth";
import { cloudMangaFeatureEnabled } from "@/lib/cloud-manga";
import { getCloudMangaGenerationByConfirmation } from "@/lib/cloud-manga-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import {
  getCloudScenarioConfirmation,
  getCloudScenarioRun,
  listCloudScenarioRuns,
} from "@/lib/cloud-scenario-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";

const focusLabels = {
  initial: "初稿",
  pacing: "テンポ重視",
  character: "人物変化重視",
  clarity: "分かりやすさ重視",
};

export default async function CloudScenarioRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  if (
    !cloudResearchFeatureEnabled() ||
    !cloudProposalFeatureEnabled() ||
    !cloudScenarioFeatureEnabled()
  )
    redirect("/dashboard/scenarios");
  const { runId } = await params;
  const query = await searchParams;
  const run = await getCloudScenarioRun(profile.id, runId).catch((error) => {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  });
  const [versions, confirmation] = await Promise.all([
    listCloudScenarioRuns(profile.id, run.proposal_selection_id),
    getCloudScenarioConfirmation(profile.id, run.proposal_selection_id),
  ]);
  const mangaEnabled = cloudMangaFeatureEnabled();
  const mangaGeneration =
    confirmation && mangaEnabled
      ? await getCloudMangaGenerationByConfirmation(
          profile.id,
          confirmation.id,
        )
      : null;
  const confirmed = confirmation?.scenario_run_id === run.id;

  return (
    <main className="page max-w-6xl">
      <Link className="text-violet-700 underline" href="/dashboard/scenarios">
        ← シナリオ履歴へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">WORKFLOW 3</p>
          <h1 className="mt-2 text-3xl font-bold">{run.result.title}</h1>
          <p className="mt-2 text-stone-600">{run.result.logline}</p>
          <p className="mt-2 text-xs text-stone-500">
            第{run.revision_number}版／
            {focusLabels[run.result.revisionFocus]}／{run.engine_version}／
            {new Date(run.completed_at).toLocaleString("ja-JP")}
          </p>
        </div>
        {confirmed ? (
          <span className="inline-flex items-center rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-800">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            確定版
          </span>
        ) : null}
      </div>
      {query.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">
          {query.error}
        </p>
      ) : null}
      {query.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800" role="status">
          {query.message}
        </p>
      ) : null}
      <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        このシナリオは、採用企画と市場分析の根拠をもとに
        {run.engine_version} が作成したAI推論・制作仮説です。
        市場の事実そのものではありません。
      </p>

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">登場人物</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {run.result.characters.map((character) => (
            <article className="rounded-lg bg-stone-50 p-4" key={character.id}>
              <h3 className="font-bold">{character.role}</h3>
              <p className="mt-2 text-sm text-stone-700">{character.description}</p>
              <p className="mt-3 text-sm"><strong>目的:</strong> {character.goal}</p>
              <p className="mt-2 text-sm"><strong>変化:</strong> {character.change}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">三幕構成</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {run.result.acts.map((act) => (
            <article className="rounded-lg border border-violet-100 p-4" key={act.act}>
              <p className="text-sm font-bold text-violet-700">
                第{act.act}幕・{act.pageStart}〜{act.pageEnd}Page
              </p>
              <h3 className="mt-2 font-bold">{act.label}</h3>
              <p className="mt-2 text-sm text-stone-700">{act.purpose}</p>
              <p className="mt-3 text-sm"><strong>転換:</strong> {act.turningPoint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">シーンとページ配分</h2>
        <div className="mt-4 space-y-4">
          {run.result.scenes.map((scene) => (
            <article className="panel" key={scene.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-bold">
                  {scene.order}. {scene.heading}
                </h3>
                <span className="text-sm font-bold text-violet-700">
                  {scene.pageStart}〜{scene.pageEnd}Page
                </span>
              </div>
              <p className="mt-3 text-stone-700">{scene.summary}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="font-bold">場面目的</dt><dd className="mt-1 text-stone-600">{scene.purpose}</dd></div>
                <div><dt className="font-bold">登場</dt><dd className="mt-1 text-stone-600">{scene.characters.join("、")}</dd></div>
                <div><dt className="font-bold">会話目標</dt><dd className="mt-1 text-stone-600">{scene.dialogueGoal}</dd></div>
                <div><dt className="font-bold">絵で見せる変化</dt><dd className="mt-1 text-stone-600">{scene.visualBeat}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">連続性チェック</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-700">
          {run.result.continuityChecks.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">版履歴</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {versions.map((version) => (
            <Link
              className={version.id === run.id ? "button bg-violet-700" : "button-secondary"}
              href={`/dashboard/scenarios/${version.id}`}
              key={version.id}
            >
              第{version.revision_number}版
            </Link>
          ))}
        </div>
      </section>

      {!confirmation ? (
        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <form action={reviseCloudScenarioAction} className="panel">
            <input name="runId" type="hidden" value={run.id} />
            <label className="label" htmlFor="focus">改稿方針</label>
            <select className="field" id="focus" name="focus" required>
              <option value="pacing">テンポを改善</option>
              <option value="character">人物変化を強化</option>
              <option value="clarity">分かりやすさを改善</option>
            </select>
            <button className="button-secondary mt-4 w-full" type="submit">
              新しい改稿版を生成
            </button>
          </form>
          <form action={confirmCloudScenarioAction} className="panel">
            <input name="runId" type="hidden" value={run.id} />
            <h2 className="text-xl font-bold">この版を確定</h2>
            <p className="mt-2 text-sm text-stone-600">
              確定後は別版へ変更できません。Release 4へ渡すsnapshotを固定します。
            </p>
            <button className="button mt-4 w-full bg-violet-700 hover:bg-violet-800" type="submit">
              第{run.revision_number}版を確定
            </button>
          </form>
        </section>
      ) : (
        <section className="mt-6 rounded-lg border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-xl font-bold text-violet-950">
            マンガ下書き生成
          </h2>
          <p className="mt-2 text-violet-900">
            確定Scenario snapshotからCloud Projectと編集可能なCanvas Pageを作成します。
          </p>
          {mangaGeneration ? (
            <Link
              className="button mt-4 bg-violet-700 hover:bg-violet-800"
              href={`/dashboard/manga/${mangaGeneration.id}`}
            >
              作成済みマンガ下書きを開く
            </Link>
          ) : mangaEnabled ? (
            <form action={createCloudMangaAction} className="mt-4">
              <input
                name="confirmationId"
                type="hidden"
                value={confirmation.id}
              />
              <button
                className="button bg-violet-700 hover:bg-violet-800"
                type="submit"
              >
                マンガ下書きとCanvas Pageを作成
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-violet-700">
              Release 4 Feature Flagは停止中です。
            </p>
          )}
        </section>
      )}
    </main>
  );
}

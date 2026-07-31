import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  cloudAdultPlanningFeatureEnabled,
  getCloudAdultPlanningAccess,
  listCloudAdultPlanningBriefs,
} from "@/lib/cloud-adult-planning";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { createCloudAdultPlanningBriefAction } from "./actions";
import { createCloudProposalAction } from "./actions";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { listCloudProposalRuns } from "@/lib/cloud-proposal-server";
import { ProposalSubmitButton } from "./proposal-submit-button";
import {
  cloudAdultAiPlanningFeatureEnabled,
  getCloudAdultAiPlanningAccess,
} from "@/lib/cloud-adult-ai-planning";
import {
  consentCloudAdultAiPlanningAction,
  createCloudAdultProposalAction,
} from "./actions";

const accessLabel = {
  allowed: "利用可能",
  feature_disabled: "現在停止中",
  adult_access_required: "成人向け市場分析の利用条件が必要",
  grant_missing: "企画機能の管理者許可が必要",
  grant_inactive: "企画機能は利用停止中",
  grant_expired: "企画機能の利用期限切れ",
  configuration_unavailable: "設定確認中",
} as const;

function Field({
  id,
  label,
  maxLength,
  defaultValue,
  rows = 3,
}: {
  id: string;
  label: string;
  maxLength: number;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <textarea
        className="field"
        defaultValue={defaultValue}
        id={id}
        maxLength={maxLength}
        name={id}
        required={id !== "notes"}
        rows={rows}
      />
    </div>
  );
}

export default async function ProposalHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!cloudResearchFeatureEnabled()) redirect("/dashboard/research");
  const { profile } = await requireProfile();
  const { reportId } = await params;
  const { error, message } = await searchParams;
  const report = await getCloudResearchReport(profile.id, reportId).catch(
    (cause) => {
      if (cause instanceof ResourceNotFoundError) notFound();
      throw cause;
    },
  );
  const next = report.result.findings.find(
    (finding) => finding.key === "next_proposal",
  );
  const differentiation = report.result.findings.find(
    (finding) => finding.key === "differentiation",
  );

  if (report.input.contentClass !== "adult") {
    const proposalEnabled = cloudProposalFeatureEnabled();
    const runs = proposalEnabled
      ? await listCloudProposalRuns(profile.id, report.id)
      : [];
    return (
      <main className="page max-w-3xl">
        <Link
          className="text-violet-700 underline"
          href={`/dashboard/research/${report.id}`}
        >
          ← 市場分析Reportへ
        </Link>
        <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 2</p>
        <h1 className="mt-2 text-3xl font-bold">AI企画提案への引継ぎ</h1>
        <section className="panel mt-6 border-violet-200">
          <p className="text-sm font-bold text-violet-700">市場分析完了済み</p>
          <h2 className="mt-2 text-xl font-bold">引継ぎ条件</h2>
          <p className="mt-3 leading-relaxed text-stone-700">{next?.summary}</p>
        </section>
        {error ? (
          <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {runs.length ? (
          <section className="mt-6">
            <h2 className="text-xl font-bold">作成済みの企画</h2>
            <div className="mt-4 space-y-3">
              {runs.map((run) => (
                <Link
                  className="panel block transition hover:border-violet-300"
                  href={`/dashboard/research/${report.id}/proposal/runs/${run.id}`}
                  key={run.id}
                >
                  <span className="font-bold">企画3案を比較する</span>
                  <span className="ml-3 text-sm text-stone-600">
                    {new Date(run.created_at).toLocaleString("ja-JP")}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="panel mt-6 text-center" aria-labelledby="proposal-empty-title">
            <h2 className="text-xl font-bold" id="proposal-empty-title">
              企画はまだ作成されていません
            </h2>
            <p className="mt-2 text-stone-600">
              下のボタンから、市場分析に合う3つの企画を作成できます。
            </p>
          </section>
        )}
        {proposalEnabled ? (
          <form action={createCloudProposalAction.bind(null, report.id)} className="panel mt-6">
            <h2 className="text-xl font-bold">市場分析から企画を作る</h2>
            <p className="mt-2 text-stone-600">
              分析結果をもとに、売れやすさ・作りやすさ・独自性が異なる3案をAIが提案します。
            </p>
            <ProposalSubmitButton />
          </form>
        ) : (
          <div className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">
            AI企画提案は現在停止中です。
          </div>
        )}
      </main>
    );
  }

  const planningEnabled = cloudAdultPlanningFeatureEnabled();
  const access = await getCloudAdultPlanningAccess(profile.id);
  const aiPlanningEnabled =
    cloudProposalFeatureEnabled() && cloudAdultAiPlanningFeatureEnabled();
  const aiAccess = await getCloudAdultAiPlanningAccess(profile.id);
  const adultRuns = aiAccess.allowed
    ? await listCloudProposalRuns(profile.id, report.id)
    : [];
  const briefs = access.allowed
    ? await listCloudAdultPlanningBriefs(profile.id, report.id)
    : [];

  return (
    <main className="page max-w-4xl">
      <Link
        className="text-violet-700 underline"
        href={`/dashboard/research/${report.id}`}
      >
        ← 市場分析Reportへ
      </Link>
      <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 2</p>
      <h1 className="mt-2 text-3xl font-bold">成人向け企画ブリーフ</h1>
      <p className="mt-3 text-stone-600">
        市場分析の条件を、次の制作工程で使う企画へ整理します。外部AIには送信されません。
      </p>
      {error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800" role="status">
          {message}
        </p>
      ) : null}

      <section className="panel mt-6 border-violet-200">
        <p className="text-sm font-bold text-violet-700">市場分析からの引継ぎ</p>
        <p className="mt-3 leading-relaxed text-stone-700">{next?.summary}</p>
      </section>

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">利用状態</h2>
        <p className="mt-2 font-bold">{accessLabel[access.reason]}</p>
        {!planningEnabled ? (
          <p className="mt-2 text-sm text-stone-600">
            成人向け企画機能のFeature Flagが有効になるまで保存できません。
          </p>
        ) : null}
      </section>

      <section className="panel mt-6 border-rose-200">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">AIで成人向け企画を3案作る</h2>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">成人向け</span>
        </div>
        <p className="mt-3 text-stone-600">
          市場分析をxAI/Grokへ送信し、架空の18歳以上・合意のある非搾取的な内容に限定して企画を提案します。
        </p>
        {adultRuns.length ? (
          <div className="mt-5 space-y-3">
            {adultRuns.map((run) => (
              <Link className="block rounded-lg border border-rose-100 p-4 hover:border-rose-300" href={`/dashboard/research/${report.id}/proposal/runs/${run.id}`} key={run.id}>
                成人向け企画3案を比較 · {new Date(run.created_at).toLocaleString("ja-JP")}
              </Link>
            ))}
          </div>
        ) : null}
        {aiAccess.reason === "consent_required" ? (
          <form action={consentCloudAdultAiPlanningAction.bind(null, report.id)} className="mt-5 space-y-3 rounded-lg bg-rose-50 p-4">
            {[
              ["confirmed18Plus", "私は18歳以上です"],
              ["fictionalAdultsOnly", "架空の18歳以上の成人だけを扱います"],
              ["consensualOnly", "合意のある非搾取的な内容だけを扱います"],
              ["noRealPerson", "実在人物を扱いません"],
              ["providerDisclosureAccepted", "入力した市場分析がxAI/Grokへ送信されることに同意します"],
            ].map(([name, label]) => (
              <label className="flex gap-3 text-sm" key={name}>
                <input name={name} type="checkbox" value="true" />
                <span>{label}</span>
              </label>
            ))}
            <button className="button bg-rose-700 hover:bg-rose-800" type="submit">利用条件に同意</button>
          </form>
        ) : aiAccess.allowed ? (
          <form action={createCloudAdultProposalAction.bind(null, report.id)} className="mt-5">
            <ProposalSubmitButton />
          </form>
        ) : (
          <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">
            {aiPlanningEnabled ? "管理者による成人向けAI企画の個別許可とDB側許可が必要です。" : "成人向けAI企画は現在停止中です。"}
          </p>
        )}
      </section>

      {access.allowed ? (
        <>
          <section className="mt-6">
            <h2 className="text-xl font-bold">保存済み企画ブリーフ</h2>
            {briefs.length ? (
              <div className="mt-4 space-y-3">
                {briefs.map((brief) => (
                  <Link
                    className="panel block transition hover:border-violet-300"
                    href={`/dashboard/research/${report.id}/proposal/${brief.id}`}
                    key={brief.id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-bold">{brief.workingTitle}</h3>
                      <span className="text-sm text-violet-700">
                        {brief.status === "ready" ? "企画条件確定" : "下書き"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">
                      {new Date(brief.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-stone-600">
                保存済みの企画ブリーフはありません。
              </p>
            )}
          </section>

          <form
            action={createCloudAdultPlanningBriefAction.bind(null, report.id)}
            className="panel mt-6 space-y-5"
          >
            <h2 className="text-xl font-bold">新しい企画ブリーフ</h2>
            <div>
              <label className="label" htmlFor="status">
                状態
              </label>
              <select className="field" id="status" name="status">
                <option value="draft">下書き</option>
                <option value="ready">企画条件確定</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="workingTitle">
                仮タイトル
              </label>
              <input
                className="field"
                defaultValue={`${report.input.theme}（仮）`}
                id="workingTitle"
                maxLength={200}
                name="workingTitle"
                required
              />
            </div>
            <Field
              defaultValue={`${report.input.genre}として、${report.input.theme}を軸にした${report.input.publicationFormat === "auto" ? "AI推奨形式" : report.input.publicationFormat === "series" ? "連載" : "読切"}企画。`}
              id="concept"
              label="企画コンセプト"
              maxLength={2000}
            />
            <Field id="protagonist" label="主人公" maxLength={1000} />
            <Field
              id="protagonistGoal"
              label="主人公の目的"
              maxLength={1000}
            />
            <Field
              id="centralConflict"
              label="中心となる対立"
              maxLength={1000}
            />
            <Field
              defaultValue={report.input.audience}
              id="readerPromise"
              label="読者への約束"
              maxLength={1000}
            />
            <Field id="tone" label="トーン・雰囲気" maxLength={500} />
            <Field
              defaultValue={differentiation?.summary}
              id="differentiation"
              label="差別化ポイント"
              maxLength={1500}
            />
            <Field
              id="endingDirection"
              label="結末の方向性"
              maxLength={1000}
            />
            <Field
              id="notes"
              label="制作メモ（任意）"
              maxLength={3000}
              rows={5}
            />
            <button
              className="button bg-violet-700 hover:bg-violet-800"
              type="submit"
            >
              企画ブリーフを保存
            </button>
          </form>
        </>
      ) : (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">利用許可が必要です</h2>
          <p className="mt-2 text-stone-600">
            成人向け市場分析の利用条件と、管理者による成人向け企画機能の許可が必要です。
          </p>
          <Link
            className="button-secondary mt-5"
            href="/dashboard/research/adult-access"
          >
            成人向け利用状態を確認
          </Link>
        </section>
      )}
    </main>
  );
}

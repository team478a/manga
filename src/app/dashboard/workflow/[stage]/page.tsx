import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { cloudStoryboardFeatureEnabled } from "@/lib/cloud-storyboard";
import {
  resolveCloudWorkflowEntry,
  type CloudWorkflowStage,
} from "@/lib/cloud-workflow-entrypoints-server";

const stages: Record<CloudWorkflowStage, { label: string; enabled: () => boolean }> = {
  proposal: {
    label: "AI企画提案",
    enabled: () => cloudResearchFeatureEnabled() && cloudProposalFeatureEnabled(),
  },
  scenario: {
    label: "シナリオ作成",
    enabled: () =>
      cloudResearchFeatureEnabled() &&
      cloudProposalFeatureEnabled() &&
      cloudScenarioFeatureEnabled(),
  },
  storyboard: {
    label: "ネーム作成",
    enabled: () =>
      cloudResearchFeatureEnabled() &&
      cloudProposalFeatureEnabled() &&
      cloudScenarioFeatureEnabled() &&
      cloudStoryboardFeatureEnabled(),
  },
};

const prerequisiteLabels = {
  research: "最初に市場分析を完了してください。",
  proposal: "AI企画提案で制作する企画を決定してください。",
  scenario: "シナリオを作成して、使用する版を決定してください。",
};

export default async function CloudWorkflowEntryPage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage: value } = await params;
  const config = stages[value as CloudWorkflowStage];
  if (!config) redirect("/dashboard");
  const stage = value as CloudWorkflowStage;

  if (!config.enabled()) {
    return (
      <main className="page max-w-3xl">
        <p className="text-sm font-bold text-violet-700">制作ワークフロー</p>
        <h1 className="mt-2 text-3xl font-bold">{config.label}</h1>
        <section className="panel mt-6 text-center">
          <CircleAlert className="mx-auto h-9 w-9 text-amber-600" />
          <h2 className="mt-3 text-xl font-bold">この機能は現在停止中です</h2>
          <p className="mt-2 text-stone-600">
            管理者がFeature Flagを有効にすると利用できます。
          </p>
          <Link className="button-secondary mt-5 inline-flex" href="/dashboard">
            ダッシュボードへ戻る
          </Link>
        </section>
      </main>
    );
  }

  const { profile } = await requireProfile();
  const entry = await resolveCloudWorkflowEntry(profile.id, stage);
  if (!entry.prerequisite) redirect(entry.href);

  return (
    <main className="page max-w-3xl">
      <p className="text-sm font-bold text-violet-700">制作ワークフロー</p>
      <h1 className="mt-2 text-3xl font-bold">{config.label}</h1>
      <section className="panel mt-6 text-center">
        <CircleAlert className="mx-auto h-9 w-9 text-violet-700" />
        <h2 className="mt-3 text-xl font-bold">前の工程を完了すると進めます</h2>
        <p className="mt-2 text-stone-600">
          {prerequisiteLabels[entry.prerequisite]}
        </p>
        <Link className="button mt-5 inline-flex bg-violet-700 hover:bg-violet-800" href={entry.href}>
          必要な工程を開く
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

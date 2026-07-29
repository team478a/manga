import { z } from "zod";
import {
  cloudStoryProposalResultSchema,
  type CloudStoryProposalCandidate,
  type CloudStoryProposalResult,
} from "./cloud-proposal.ts";
import { DomainError, ResourceNotFoundError, ValidationError } from "./domain-errors.ts";

export type CloudStoryProposalRun = {
  id: string;
  owner_profile_id: string;
  research_report_id: string;
  status: "completed";
  result: CloudStoryProposalResult;
  engine_version: "proposal-rules-v1";
  completed_at: string;
  created_at: string;
};

export type CloudStoryProposalSelection = {
  id: string;
  owner_profile_id: string;
  research_report_id: string;
  proposal_run_id: string;
  candidate_id: string;
  candidate_snapshot: CloudStoryProposalCandidate;
  selected_at: string;
};

type Result<T> = { data: T | null; error: unknown };
export type CloudProposalPersistence = {
  insertRun(
    run: Omit<CloudStoryProposalRun, "id" | "created_at">,
  ): Promise<Result<{ id: string }>>;
  listRuns(profileId: string): Promise<Result<CloudStoryProposalRun[]>>;
  findRun(profileId: string, runId: string): Promise<Result<CloudStoryProposalRun>>;
  findSelection(
    profileId: string,
    reportId: string,
  ): Promise<Result<CloudStoryProposalSelection>>;
  insertSelection(
    selection: Omit<CloudStoryProposalSelection, "id" | "selected_at">,
  ): Promise<Result<{ id: string }>>;
};

const uuid = z.string().uuid();

function internal(message: string, error: unknown) {
  return new DomainError("INTERNAL_ERROR", message, { cause: error });
}
export async function createCloudProposalRunWithPersistence({
  profileId,
  reportId,
  result,
  persistence,
}: {
  profileId: string;
  reportId: string;
  result: CloudStoryProposalResult;
  persistence: CloudProposalPersistence;
}) {
  if (!uuid.safeParse(reportId).success)
    throw new ResourceNotFoundError("市場分析レポートが見つかりません。");
  const validated = cloudStoryProposalResultSchema.parse(result);
  const saved = await persistence.insertRun({
    owner_profile_id: profileId,
    research_report_id: reportId,
    status: "completed",
    result: validated,
    engine_version: validated.engineVersion,
    completed_at: validated.generatedAt,
  });
  if (saved.error || !saved.data)
    throw internal("企画候補を保存できませんでした。", saved.error);
  return saved.data.id;
}

export async function listCloudProposalRunsWithPersistence({
  profileId,
  persistence,
}: {
  profileId: string;
  persistence: CloudProposalPersistence;
}) {
  const result = await persistence.listRuns(profileId);
  if (result.error)
    throw internal("企画履歴を取得できませんでした。", result.error);
  return result.data ?? [];
}

export async function getCloudProposalRunWithPersistence({
  profileId,
  runId,
  persistence,
}: {
  profileId: string;
  runId: string;
  persistence: CloudProposalPersistence;
}) {
  if (!uuid.safeParse(runId).success)
    throw new ResourceNotFoundError("企画Runが見つかりません。");
  const result = await persistence.findRun(profileId, runId);
  if (result.error)
    throw internal("企画Runを取得できませんでした。", result.error);
  if (!result.data)
    throw new ResourceNotFoundError("企画Runが見つかりません。");
  return result.data;
}

export async function selectCloudProposalWithPersistence({
  profileId,
  run,
  candidateId,
  persistence,
}: {
  profileId: string;
  run: CloudStoryProposalRun;
  candidateId: string;
  persistence: CloudProposalPersistence;
}) {
  const candidate = run.result.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new ValidationError("採用する企画候補を確認してください。");
  const existing = await persistence.findSelection(profileId, run.research_report_id);
  if (existing.error)
    throw internal("採用状況を確認できませんでした。", existing.error);
  if (existing.data)
    throw new ValidationError("この市場分析では企画を採用済みです。");
  const saved = await persistence.insertSelection({
    owner_profile_id: profileId,
    research_report_id: run.research_report_id,
    proposal_run_id: run.id,
    candidate_id: candidate.id,
    candidate_snapshot: candidate,
  });
  if (saved.error || !saved.data)
    throw internal("企画を採用できませんでした。", saved.error);
  return saved.data.id;
}

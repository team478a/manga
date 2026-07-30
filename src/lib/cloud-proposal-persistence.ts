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
  engine_version: "openai-proposal-v1";
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
  insertRun(value: Omit<CloudStoryProposalRun, "id" | "created_at">): Promise<Result<{ id: string }>>;
  listRuns(profileId: string, reportId: string): Promise<Result<CloudStoryProposalRun[]>>;
  findRun(profileId: string, runId: string): Promise<Result<CloudStoryProposalRun>>;
  findSelection(profileId: string, reportId: string): Promise<Result<CloudStoryProposalSelection>>;
  insertSelection(value: Omit<CloudStoryProposalSelection, "id" | "selected_at">): Promise<Result<{ id: string }>>;
};
const uuid = z.string().uuid();
const internal = (message: string, cause: unknown) =>
  new DomainError("INTERNAL_ERROR", message, { cause });
const isUniqueViolation = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505",
  );

export async function createCloudProposalRunWithPersistence(input: {
  profileId: string;
  reportId: string;
  result: CloudStoryProposalResult;
  persistence: CloudProposalPersistence;
}) {
  if (!uuid.safeParse(input.reportId).success)
    throw new ResourceNotFoundError("市場分析レポートが見つかりません。");
  const result = cloudStoryProposalResultSchema.parse(input.result);
  const saved = await input.persistence.insertRun({
    owner_profile_id: input.profileId,
    research_report_id: input.reportId,
    status: "completed",
    result,
    engine_version: result.engineVersion,
    completed_at: result.generatedAt,
  });
  if (saved.error || !saved.data)
    throw internal("企画候補を保存できませんでした。", saved.error);
  return saved.data.id;
}
export async function listCloudProposalRunsWithPersistence(input: {
  profileId: string; reportId: string; persistence: CloudProposalPersistence;
}) {
  if (!uuid.safeParse(input.reportId).success)
    throw new ResourceNotFoundError("市場分析レポートが見つかりません。");
  const result = await input.persistence.listRuns(input.profileId, input.reportId);
  if (result.error) throw internal("企画履歴を取得できませんでした。", result.error);
  return result.data ?? [];
}

export async function getCloudProposalRunWithPersistence(input: {
  profileId: string; runId: string; persistence: CloudProposalPersistence;
}) {
  if (!uuid.safeParse(input.runId).success)
    throw new ResourceNotFoundError("企画が見つかりません。");
  const result = await input.persistence.findRun(input.profileId, input.runId);
  if (result.error) throw internal("企画を取得できませんでした。", result.error);
  if (!result.data) throw new ResourceNotFoundError("企画が見つかりません。");
  return result.data;
}

export async function selectCloudProposalWithPersistence(input: {
  profileId: string; run: CloudStoryProposalRun; candidateId: string;
  persistence: CloudProposalPersistence;
}) {
  const candidate = input.run.result.candidates.find((item) => item.id === input.candidateId);
  if (!candidate) throw new ValidationError("選択する企画を確認してください。");
  const existing = await input.persistence.findSelection(input.profileId, input.run.research_report_id);
  if (existing.error) throw internal("選択状況を確認できませんでした。", existing.error);
  if (existing.data) throw new ValidationError("この市場分析では企画を選択済みです。");
  const saved = await input.persistence.insertSelection({
    owner_profile_id: input.profileId,
    research_report_id: input.run.research_report_id,
    proposal_run_id: input.run.id,
    candidate_id: candidate.id,
    candidate_snapshot: candidate,
  });
  if (isUniqueViolation(saved.error)) {
    const concurrent = await input.persistence.findSelection(
      input.profileId,
      input.run.research_report_id,
    );
    if (concurrent.error)
      throw internal("選択状況を確認できませんでした。", concurrent.error);
    if (concurrent.data?.candidate_id === candidate.id)
      return concurrent.data.id;
    if (concurrent.data)
      throw new ValidationError("この市場分析では企画を選択済みです。");
  }
  if (saved.error || !saved.data)
    throw internal("企画を選択できませんでした。", saved.error);
  return saved.data.id;
}

import { z } from "zod";
import { DomainError, ResourceNotFoundError } from "./domain-errors.ts";
import type {
  CloudResearchEvidence,
  CloudResearchInput,
  CloudResearchResult,
} from "./cloud-research.ts";

export type CloudResearchReport = {
  id: string;
  owner_profile_id: string;
  status: "completed";
  input: CloudResearchInput;
  sources: CloudResearchEvidence[];
  result: CloudResearchResult;
  engine_version: string;
  completed_at: string;
  created_at: string;
};

export type CloudResearchReportInsert = Omit<
  CloudResearchReport,
  "id" | "created_at"
>;

type PersistenceResult<T> = {
  data: T | null;
  error: unknown;
};

export type CloudResearchPersistence = {
  insert(
    report: CloudResearchReportInsert,
  ): Promise<PersistenceResult<{ id: string }>>;
  list(
    profileId: string,
  ): Promise<PersistenceResult<CloudResearchReport[]>>;
  find(
    profileId: string,
    reportId: string,
  ): Promise<PersistenceResult<CloudResearchReport>>;
};

const reportIdSchema = z.string().uuid();

export async function createCloudResearchReportWithPersistence({
  profileId,
  input,
  result,
  persistence,
}: {
  profileId: string;
  input: CloudResearchInput;
  result: CloudResearchResult;
  persistence: CloudResearchPersistence;
}) {
  const { data, error } = await persistence.insert({
    owner_profile_id: profileId,
    status: "completed",
    input,
    sources: input.evidence,
    result,
    engine_version: result.engineVersion,
    completed_at: result.generatedAt,
  });
  if (error || !data)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析レポートを保存できませんでした。",
      { cause: error },
    );
  return data.id;
}

export async function listCloudResearchReportsWithPersistence({
  profileId,
  persistence,
}: {
  profileId: string;
  persistence: CloudResearchPersistence;
}) {
  const { data, error } = await persistence.list(profileId);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析履歴を取得できませんでした。",
      { cause: error },
    );
  return data ?? [];
}

export async function getCloudResearchReportWithPersistence({
  profileId,
  reportId,
  persistence,
}: {
  profileId: string;
  reportId: string;
  persistence: CloudResearchPersistence;
}) {
  if (!reportIdSchema.safeParse(reportId).success)
    throw new ResourceNotFoundError("市場分析レポートが見つかりません。");

  const { data, error } = await persistence.find(profileId, reportId);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析レポートを取得できませんでした。",
      { cause: error },
    );
  if (!data)
    throw new ResourceNotFoundError("市場分析レポートが見つかりません。");
  return data;
}

import { z } from "zod";
import { cloudStoryScenarioResultSchema, type CloudStoryScenarioResult } from "./cloud-scenario.ts";
import { DomainError, ResourceNotFoundError, ValidationError } from "./domain-errors.ts";

export type CloudStoryScenarioVersion = {
  id: string;
  owner_profile_id: string;
  research_report_id: string;
  proposal_selection_id: string;
  parent_version_id: string | null;
  revision_instruction: string | null;
  result: CloudStoryScenarioResult;
  engine_version: "openai-scenario-v1";
  completed_at: string;
  created_at: string;
};
export type CloudStoryScenarioAdoption = {
  id: string;
  owner_profile_id: string;
  proposal_selection_id: string;
  scenario_version_id: string;
  adopted_at: string;
};
type Result<T> = { data: T | null; error: unknown };
export type CloudScenarioPersistence = {
  insertVersion(value: Omit<CloudStoryScenarioVersion, "id" | "created_at">): Promise<Result<{ id: string }>>;
  listVersions(profileId: string, selectionId: string): Promise<Result<CloudStoryScenarioVersion[]>>;
  findVersion(profileId: string, versionId: string): Promise<Result<CloudStoryScenarioVersion>>;
  insertAdoption(value: Omit<CloudStoryScenarioAdoption, "id" | "adopted_at">): Promise<Result<{ id: string }>>;
  findLatestAdoption(profileId: string, selectionId: string): Promise<Result<CloudStoryScenarioAdoption>>;
};
const uuid = z.string().uuid();
const internal = (message: string, cause: unknown) => new DomainError("INTERNAL_ERROR", message, { cause });
const unique = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");

export async function createCloudScenarioVersionWithPersistence(input: {
  profileId: string;
  reportId: string;
  selectionId: string;
  parentVersionId?: string | null;
  revisionInstruction?: string | null;
  result: CloudStoryScenarioResult;
  persistence: CloudScenarioPersistence;
}) {
  if (![input.reportId, input.selectionId].every((value) => uuid.safeParse(value).success) ||
      (input.parentVersionId && !uuid.safeParse(input.parentVersionId).success))
    throw new ResourceNotFoundError("シナリオの入力が見つかりません。");
  const result = cloudStoryScenarioResultSchema.parse(input.result);
  const instruction = input.revisionInstruction?.trim() || null;
  if (instruction && instruction.length > 2000)
    throw new ValidationError("修正内容は2000文字以内で入力してください。");
  const saved = await input.persistence.insertVersion({
    owner_profile_id: input.profileId,
    research_report_id: input.reportId,
    proposal_selection_id: input.selectionId,
    parent_version_id: input.parentVersionId ?? null,
    revision_instruction: instruction,
    result,
    engine_version: result.engineVersion,
    completed_at: result.generatedAt,
  });
  if (saved.error || !saved.data) throw internal("シナリオを保存できませんでした。", saved.error);
  return saved.data.id;
}
export async function listCloudScenarioVersionsWithPersistence(input: {
  profileId: string; selectionId: string; persistence: CloudScenarioPersistence;
}) {
  if (!uuid.safeParse(input.selectionId).success) throw new ResourceNotFoundError("企画が見つかりません。");
  const result = await input.persistence.listVersions(input.profileId, input.selectionId);
  if (result.error) throw internal("シナリオ履歴を取得できませんでした。", result.error);
  return result.data ?? [];
}
export async function getCloudScenarioVersionWithPersistence(input: {
  profileId: string; versionId: string; persistence: CloudScenarioPersistence;
}) {
  if (!uuid.safeParse(input.versionId).success) throw new ResourceNotFoundError("シナリオが見つかりません。");
  const result = await input.persistence.findVersion(input.profileId, input.versionId);
  if (result.error) throw internal("シナリオを取得できませんでした。", result.error);
  if (!result.data) throw new ResourceNotFoundError("シナリオが見つかりません。");
  return result.data;
}
export async function adoptCloudScenarioWithPersistence(input: {
  profileId: string; version: CloudStoryScenarioVersion; persistence: CloudScenarioPersistence;
}) {
  const current = await input.persistence.findLatestAdoption(input.profileId, input.version.proposal_selection_id);
  if (current.error) throw internal("採用状況を確認できませんでした。", current.error);
  if (current.data?.scenario_version_id === input.version.id) return current.data.id;
  const saved = await input.persistence.insertAdoption({
    owner_profile_id: input.profileId,
    proposal_selection_id: input.version.proposal_selection_id,
    scenario_version_id: input.version.id,
  });
  if (unique(saved.error)) {
    const concurrent = await input.persistence.findLatestAdoption(input.profileId, input.version.proposal_selection_id);
    if (concurrent.data?.scenario_version_id === input.version.id) return concurrent.data.id;
  }
  if (saved.error || !saved.data) throw internal("シナリオを採用できませんでした。", saved.error);
  return saved.data.id;
}

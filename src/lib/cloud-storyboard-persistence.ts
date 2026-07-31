import { z } from "zod";
import { cloudStoryboardResultSchema, type CloudStoryboardResult } from "./cloud-storyboard.ts";
import { DomainError, ResourceNotFoundError, ValidationError } from "./domain-errors.ts";

export type CloudStoryboardVersion = {
  id: string;
  owner_profile_id: string;
  scenario_version_id: string;
  parent_version_id: string | null;
  revision_instruction: string | null;
  content_class: "general" | "adult";
  result: CloudStoryboardResult;
  engine_version: "openai-storyboard-v1" | "xai-adult-storyboard-v1";
  completed_at: string;
  created_at: string;
};
export type CloudStoryboardAdoption = {
  id: string;
  owner_profile_id: string;
  scenario_version_id: string;
  storyboard_version_id: string;
  adopted_at: string;
};
type Result<T> = { data: T | null; error: unknown };
export type CloudStoryboardPersistence = {
  insertVersion(value: Omit<CloudStoryboardVersion, "id" | "created_at">): Promise<Result<{ id: string }>>;
  listVersions(profileId: string, scenarioVersionId: string): Promise<Result<CloudStoryboardVersion[]>>;
  findVersion(profileId: string, versionId: string): Promise<Result<CloudStoryboardVersion>>;
  insertAdoption(value: Omit<CloudStoryboardAdoption, "id" | "adopted_at">): Promise<Result<{ id: string }>>;
  findLatestAdoption(profileId: string, scenarioVersionId: string): Promise<Result<CloudStoryboardAdoption>>;
};
const uuid = z.string().uuid();
const internal = (message: string, cause: unknown) => new DomainError("INTERNAL_ERROR", message, { cause });
const unique = (error: unknown) =>
  Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");

export async function createCloudStoryboardVersionWithPersistence(input: {
  profileId: string; scenarioVersionId: string; parentVersionId?: string | null;
  revisionInstruction?: string | null; contentClass?: "general" | "adult";
  result: CloudStoryboardResult; persistence: CloudStoryboardPersistence;
}) {
  if (!uuid.safeParse(input.scenarioVersionId).success ||
      (input.parentVersionId && !uuid.safeParse(input.parentVersionId).success))
    throw new ResourceNotFoundError("ネームの入力が見つかりません。");
  const instruction = input.revisionInstruction?.trim() || null;
  if (instruction && instruction.length > 2000) throw new ValidationError("修正内容は2000文字以内で入力してください。");
  const result = cloudStoryboardResultSchema.parse(input.result);
  const saved = await input.persistence.insertVersion({
    owner_profile_id: input.profileId, scenario_version_id: input.scenarioVersionId,
    parent_version_id: input.parentVersionId ?? null, revision_instruction: instruction,
    content_class: input.contentClass ?? "general",
    result, engine_version: result.engineVersion, completed_at: result.generatedAt,
  });
  if (saved.error || !saved.data) throw internal("ネームを保存できませんでした。", saved.error);
  return saved.data.id;
}
export async function listCloudStoryboardVersionsWithPersistence(input: {
  profileId: string; scenarioVersionId: string; persistence: CloudStoryboardPersistence;
}) {
  if (!uuid.safeParse(input.scenarioVersionId).success) throw new ResourceNotFoundError("シナリオが見つかりません。");
  const result = await input.persistence.listVersions(input.profileId, input.scenarioVersionId);
  if (result.error) throw internal("ネーム履歴を取得できませんでした。", result.error);
  return result.data ?? [];
}
export async function getCloudStoryboardVersionWithPersistence(input: {
  profileId: string; versionId: string; persistence: CloudStoryboardPersistence;
}) {
  if (!uuid.safeParse(input.versionId).success) throw new ResourceNotFoundError("ネームが見つかりません。");
  const result = await input.persistence.findVersion(input.profileId, input.versionId);
  if (result.error) throw internal("ネームを取得できませんでした。", result.error);
  if (!result.data) throw new ResourceNotFoundError("ネームが見つかりません。");
  return result.data;
}
export async function adoptCloudStoryboardWithPersistence(input: {
  profileId: string; version: CloudStoryboardVersion; persistence: CloudStoryboardPersistence;
}) {
  const current = await input.persistence.findLatestAdoption(input.profileId, input.version.scenario_version_id);
  if (current.error) throw internal("採用状況を確認できませんでした。", current.error);
  if (current.data?.storyboard_version_id === input.version.id) return current.data.id;
  const saved = await input.persistence.insertAdoption({
    owner_profile_id: input.profileId, scenario_version_id: input.version.scenario_version_id,
    storyboard_version_id: input.version.id,
  });
  if (unique(saved.error)) {
    const concurrent = await input.persistence.findLatestAdoption(
      input.profileId,
      input.version.scenario_version_id,
    );
    if (concurrent.data?.storyboard_version_id === input.version.id) return concurrent.data.id;
  }
  if (saved.error || !saved.data) throw internal("ネームを採用できませんでした。", saved.error);
  return saved.data.id;
}

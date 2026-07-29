import { z } from "zod";
import {
  cloudMangaPlanResultSchema,
  type CloudMangaPlanResult,
} from "./cloud-manga.ts";
import { DomainError, ResourceNotFoundError } from "./domain-errors.ts";

export type CloudMangaGeneration = {
  id: string;
  owner_profile_id: string;
  scenario_confirmation_id: string;
  scenario_run_id: string;
  project_id: string;
  status: "completed";
  result: CloudMangaPlanResult;
  engine_version: "manga-layout-rules-v1";
  completed_at: string;
  created_at: string;
};

type Result<T> = { data: T | null; error: unknown };
export type CloudMangaPersistence = {
  createGeneration(input: {
    confirmationId: string;
    result: CloudMangaPlanResult;
    completedAt: string;
  }): Promise<
    Result<{
      generation_id: string;
      project_id: string;
      first_page_id: string;
    }>
  >;
  listGenerations(profileId: string): Promise<Result<CloudMangaGeneration[]>>;
  findGeneration(
    profileId: string,
    generationId: string,
  ): Promise<Result<CloudMangaGeneration>>;
  findByConfirmation(
    profileId: string,
    confirmationId: string,
  ): Promise<Result<CloudMangaGeneration>>;
};

const uuid = z.string().uuid();
const internal = (message: string, error: unknown) =>
  new DomainError("INTERNAL_ERROR", message, { cause: error });

export async function createCloudMangaGenerationWithPersistence({
  confirmationId,
  result,
  persistence,
}: {
  confirmationId: string;
  result: CloudMangaPlanResult;
  persistence: CloudMangaPersistence;
}) {
  if (!uuid.safeParse(confirmationId).success)
    throw new ResourceNotFoundError(
      "確定シナリオが見つかりません。",
    );
  const validated = cloudMangaPlanResultSchema.parse(result);
  const saved = await persistence.createGeneration({
    confirmationId,
    result: validated,
    completedAt: validated.generatedAt,
  });
  if (
    saved.error ||
    !saved.data?.generation_id ||
    !saved.data.project_id ||
    !saved.data.first_page_id
  )
    throw internal("マンガ下書きを保存できませんでした。", saved.error);
  return saved.data;
}

export async function listCloudMangaGenerationsWithPersistence({
  profileId,
  persistence,
}: {
  profileId: string;
  persistence: CloudMangaPersistence;
}) {
  const result = await persistence.listGenerations(profileId);
  if (result.error)
    throw internal("マンガ下書き履歴を取得できませんでした。", result.error);
  return result.data ?? [];
}

export async function getCloudMangaGenerationWithPersistence({
  profileId,
  generationId,
  persistence,
}: {
  profileId: string;
  generationId: string;
  persistence: CloudMangaPersistence;
}) {
  if (!uuid.safeParse(generationId).success)
    throw new ResourceNotFoundError("マンガ下書きが見つかりません。");
  const result = await persistence.findGeneration(profileId, generationId);
  if (result.error)
    throw internal("マンガ下書きを取得できませんでした。", result.error);
  if (!result.data)
    throw new ResourceNotFoundError("マンガ下書きが見つかりません。");
  return result.data;
}

export async function getCloudMangaGenerationByConfirmationWithPersistence({
  profileId,
  confirmationId,
  persistence,
}: {
  profileId: string;
  confirmationId: string;
  persistence: CloudMangaPersistence;
}) {
  if (!uuid.safeParse(confirmationId).success)
    throw new ResourceNotFoundError(
      "確定シナリオが見つかりません。",
    );
  const result = await persistence.findByConfirmation(
    profileId,
    confirmationId,
  );
  if (result.error)
    throw internal("マンガ下書きの作成状況を取得できませんでした。", result.error);
  return result.data;
}

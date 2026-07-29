import { z } from "zod";
import {
  cloudScenarioResultSchema,
  type CloudScenarioResult,
} from "./cloud-scenario.ts";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
} from "./domain-errors.ts";

export type CloudScenarioRun = {
  id: string;
  owner_profile_id: string;
  proposal_selection_id: string;
  research_report_id: string;
  parent_run_id: string | null;
  revision_number: number;
  status: "completed";
  result: CloudScenarioResult;
  engine_version: "scenario-rules-v1";
  completed_at: string;
  created_at: string;
};

export type CloudScenarioConfirmation = {
  id: string;
  owner_profile_id: string;
  proposal_selection_id: string;
  scenario_run_id: string;
  scenario_snapshot: CloudScenarioResult;
  confirmed_at: string;
};

type Result<T> = { data: T | null; error: unknown };
export type CloudScenarioPersistence = {
  createRun(input: {
    proposalSelectionId: string;
    parentRunId: string | null;
    result: CloudScenarioResult;
    completedAt: string;
  }): Promise<Result<string>>;
  listRuns(
    profileId: string,
    proposalSelectionId?: string,
  ): Promise<Result<CloudScenarioRun[]>>;
  findRun(profileId: string, runId: string): Promise<Result<CloudScenarioRun>>;
  findConfirmation(
    profileId: string,
    proposalSelectionId: string,
  ): Promise<Result<CloudScenarioConfirmation>>;
  insertConfirmation(
    confirmation: Omit<CloudScenarioConfirmation, "id" | "confirmed_at">,
  ): Promise<Result<{ id: string }>>;
};

const uuid = z.string().uuid();
const internal = (message: string, error: unknown) =>
  new DomainError("INTERNAL_ERROR", message, { cause: error });

export async function createCloudScenarioRunWithPersistence({
  proposalSelectionId,
  parentRunId,
  result,
  persistence,
}: {
  proposalSelectionId: string;
  parentRunId?: string | null;
  result: CloudScenarioResult;
  persistence: CloudScenarioPersistence;
}) {
  if (
    !uuid.safeParse(proposalSelectionId).success ||
    (parentRunId && !uuid.safeParse(parentRunId).success)
  )
    throw new ResourceNotFoundError("採用企画または親シナリオが見つかりません。");
  const validated = cloudScenarioResultSchema.parse(result);
  const saved = await persistence.createRun({
    proposalSelectionId,
    parentRunId: parentRunId ?? null,
    result: validated,
    completedAt: validated.generatedAt,
  });
  if (saved.error || !saved.data)
    throw internal("シナリオを保存できませんでした。", saved.error);
  return saved.data;
}

export async function listCloudScenarioRunsWithPersistence({
  profileId,
  proposalSelectionId,
  persistence,
}: {
  profileId: string;
  proposalSelectionId?: string;
  persistence: CloudScenarioPersistence;
}) {
  if (
    proposalSelectionId &&
    !uuid.safeParse(proposalSelectionId).success
  )
    throw new ResourceNotFoundError("採用企画が見つかりません。");
  const result = await persistence.listRuns(profileId, proposalSelectionId);
  if (result.error)
    throw internal("シナリオ履歴を取得できませんでした。", result.error);
  return result.data ?? [];
}

export async function getCloudScenarioRunWithPersistence({
  profileId,
  runId,
  persistence,
}: {
  profileId: string;
  runId: string;
  persistence: CloudScenarioPersistence;
}) {
  if (!uuid.safeParse(runId).success)
    throw new ResourceNotFoundError("シナリオRunが見つかりません。");
  const result = await persistence.findRun(profileId, runId);
  if (result.error)
    throw internal("シナリオRunを取得できませんでした。", result.error);
  if (!result.data)
    throw new ResourceNotFoundError("シナリオRunが見つかりません。");
  return result.data;
}

export async function confirmCloudScenarioWithPersistence({
  profileId,
  run,
  persistence,
}: {
  profileId: string;
  run: CloudScenarioRun;
  persistence: CloudScenarioPersistence;
}) {
  const existing = await persistence.findConfirmation(
    profileId,
    run.proposal_selection_id,
  );
  if (existing.error)
    throw internal("確定状況を確認できませんでした。", existing.error);
  if (existing.data)
    throw new ValidationError("この企画ではシナリオを確定済みです。");
  const saved = await persistence.insertConfirmation({
    owner_profile_id: profileId,
    proposal_selection_id: run.proposal_selection_id,
    scenario_run_id: run.id,
    scenario_snapshot: run.result,
  });
  if (saved.error || !saved.data)
    throw internal("シナリオを確定できませんでした。", saved.error);
  return saved.data.id;
}

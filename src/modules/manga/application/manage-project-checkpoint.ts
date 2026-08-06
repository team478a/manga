import { ValidationError } from "../../../lib/domain-errors.ts";

export type ProjectCheckpointCommandRepository = {
  create(input: {
    projectId: string;
    label: string;
    kind: "checkpoint" | "release";
  }): Promise<string>;
  restore(input: { projectId: string; checkpointId: string }): Promise<string>;
};

export async function createProjectCheckpoint(input: {
  projectId: string;
  label: string;
  kind: "checkpoint" | "release";
  repository: ProjectCheckpointCommandRepository;
  inspectRelease: (projectId: string) => Promise<{ ready: boolean }>;
}) {
  if (input.kind === "release") {
    const report = await input.inspectRelease(input.projectId);
    if (!report.ready)
      throw new ValidationError(
        "原稿チェックを解消し、すべてのページを確定してから完成版を固定してください。",
      );
  }
  return input.repository.create(input);
}

export async function restoreProjectCheckpoint(input: {
  projectId: string;
  checkpointId: string;
  repository: ProjectCheckpointCommandRepository;
}) {
  return input.repository.restore(input);
}

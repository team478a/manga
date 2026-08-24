export type GenerationRunTarget = {
  targetId: string;
  pageId: string;
  panelId: string;
  sourcePageRevision: number;
};

export type GenerationRunCheckpoint = GenerationRunTarget & {
  jobId: string;
  outputAssetId: string;
  outputSha256: string;
};

export function planGenerationRunResume(input: {
  targets: readonly GenerationRunTarget[];
  checkpoints: readonly GenerationRunCheckpoint[];
}) {
  const checkpointByTarget = new Map(input.checkpoints.map((item) => [item.targetId, item]));
  const completed: GenerationRunCheckpoint[] = [];
  const pending: GenerationRunTarget[] = [];

  for (const target of input.targets) {
    const checkpoint = checkpointByTarget.get(target.targetId);
    if (
      checkpoint &&
      checkpoint.pageId === target.pageId &&
      checkpoint.panelId === target.panelId &&
      checkpoint.sourcePageRevision === target.sourcePageRevision &&
      /^[0-9a-f]{64}$/.test(checkpoint.outputSha256)
    ) completed.push(checkpoint);
    else pending.push(target);
  }

  return { completed, pending } as const;
}

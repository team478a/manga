export type PanelReferenceSubjectKind =
  | "character"
  | "style"
  | "location"
  | "prop";

export type PanelReferenceAsset = {
  subjectKind: PanelReferenceSubjectKind;
  subjectId: string;
  assetId: string;
};

const PER_SUBJECT_LIMIT: Record<PanelReferenceSubjectKind, number> = {
  character: 2,
  style: 1,
  location: 1,
  prop: 1,
};

export function selectPanelReferenceAssets(input: {
  references: readonly PanelReferenceAsset[];
  orderedSubjects: ReadonlyArray<{
    kind: PanelReferenceSubjectKind;
    id: string;
  }>;
  maxAssets?: number;
}) {
  const maxAssets = Math.max(0, Math.min(8, input.maxAssets ?? 8));
  const selected: PanelReferenceAsset[] = [];
  const selectedAssetIds = new Set<string>();

  for (const subject of input.orderedSubjects) {
    let subjectCount = 0;
    for (const reference of input.references) {
      if (
        reference.subjectKind !== subject.kind ||
        reference.subjectId !== subject.id ||
        selectedAssetIds.has(reference.assetId)
      )
        continue;
      selected.push(reference);
      selectedAssetIds.add(reference.assetId);
      subjectCount += 1;
      if (
        selected.length >= maxAssets ||
        subjectCount >= PER_SUBJECT_LIMIT[subject.kind]
      )
        break;
    }
    if (selected.length >= maxAssets) break;
  }

  return selected;
}

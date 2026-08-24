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

export const CHARACTER_REFERENCE_RESOLVER_VERSION = "character-reference-v1";
export type CharacterReferenceRole =
  | "front" | "side" | "back" | "face" | "full_body"
  | "expression" | "costume_detail";
export type CharacterReferenceBinding = PanelReferenceAsset & {
  subjectKind: "character";
  characterVersionId: string;
  profileVersion: number;
  role: CharacterReferenceRole;
  priority: number;
};

const ROLE_ORDER: Record<CharacterReferenceRole, number> = {
  front: 0, face: 1, full_body: 2, side: 3, back: 4,
  costume_detail: 5, expression: 6,
};

export function resolveVersionedCharacterReferences(input: {
  characters: ReadonlyArray<{ profileId: string; versionId: string; version: number }>;
  bindings: readonly CharacterReferenceBinding[];
  policy: "warn" | "block";
}) {
  const resolved: CharacterReferenceBinding[] = [];
  const missingProfileIds: string[] = [];
  for (const character of input.characters) {
    const matches = input.bindings
      .filter((binding) =>
        binding.subjectId === character.profileId &&
        binding.characterVersionId === character.versionId &&
        binding.profileVersion === character.version,
      )
      .sort((left, right) =>
        ROLE_ORDER[left.role] - ROLE_ORDER[right.role] ||
        right.priority - left.priority ||
        left.assetId.localeCompare(right.assetId),
      );
    if (!matches.some((binding) => binding.role === "front" || binding.role === "face"))
      missingProfileIds.push(character.profileId);
    for (const match of matches.slice(0, 2)) {
      if (resolved.length < 8 && !resolved.some((item) => item.assetId === match.assetId))
        resolved.push(match);
    }
  }
  const warnings = missingProfileIds.map((profileId) => ({
    code: "major_character_identity_reference_missing" as const,
    profileId,
  }));
  return {
    resolverVersion: CHARACTER_REFERENCE_RESOLVER_VERSION,
    bundleVersion: 1 as const,
    policy: input.policy,
    references: resolved,
    warnings,
    blocked: input.policy === "block" && warnings.length > 0,
  };
}

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

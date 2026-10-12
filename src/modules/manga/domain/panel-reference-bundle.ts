import type { PanelReferenceAsset } from "./panel-reference-policy.ts";

export function resolvePanelReferenceBundle(input: {
  references: readonly PanelReferenceAsset[];
  orderedSubjects: readonly { kind: PanelReferenceAsset["subjectKind"]; id: string }[];
  sourceAssetId?: string;
  maxAssets: number;
  fillOnly?: boolean;
}) {
  const bundles: { assetId: string; editSource: boolean; roles: PanelReferenceAsset[] }[] = [];
  const cap = Math.max(0, Math.min(8, input.maxAssets));
  const add = (assetId: string, role?: PanelReferenceAsset) => {
    let bundle = bundles.find((item) => item.assetId === assetId);
    if (!bundle) {
      if (bundles.length >= cap) return;
      bundle = { assetId, editSource: assetId === input.sourceAssetId, roles: [] };
      bundles.push(bundle);
    }
    if (role && !bundle.roles.some((item) => item.subjectKind === role.subjectKind && item.subjectId === role.subjectId))
      bundle.roles.push(role);
  };
  if (input.sourceAssetId) add(input.sourceAssetId);
  if (!input.fillOnly) {
    for (const subject of input.orderedSubjects) {
      const matches = input.references.filter((item) => item.subjectKind === subject.kind && item.subjectId === subject.id);
      const unique = [...new Map(matches.map((item) => [item.assetId, item])).values()];
      for (const role of unique.slice(0, subject.kind === "character" ? 2 : 1)) add(role.assetId, role);
    }
  }
  return bundles.map((item, index) => ({
    ...item, inputName: index === 0 ? "input_image" : `input_image_${index + 1}`,
  }));
}

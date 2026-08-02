export type CloudCheckpointDiff = {
  available: boolean;
  pagesToRestore: number;
  pagesToRemove: number;
  structureChanges: number;
  assetChanges: number;
  projectSettingsChanged: boolean;
  hasChanges: boolean;
};

type RevisionRow = { id: string; revision: number };
type IdRow = { id: string };

export type CurrentCheckpointComparable = {
  project: {
    title: string;
    description: string;
    readingDirection: string;
    width: number;
    height: number;
    dpi: number;
  };
  pages: RevisionRow[];
  chapters: IdRow[];
  episodes: IdRow[];
  scenes: IdRow[];
  assets: IdRow[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function array(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function idSet(values: unknown[], key = "id"): Set<string> | null {
  const result = new Set<string>();
  for (const value of values) {
    const item = record(value);
    if (typeof item?.[key] !== "string" || item[key].length === 0) return null;
    result.add(item[key]);
  }
  return result;
}

function symmetricDifferenceSize(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const value of left) if (!right.has(value)) count += 1;
  for (const value of right) if (!left.has(value)) count += 1;
  return count;
}

export function summarizeCloudCheckpointDiff(manifest: unknown, current: CurrentCheckpointComparable): CloudCheckpointDiff {
  const root = record(manifest);
  const project = record(root?.project);
  const pages = array(root?.pages);
  const chapters = array(root?.chapters);
  const episodes = array(root?.episodes);
  const scenes = array(root?.scenes);
  const assets = array(root?.assets);
  if (!root || !project || !pages || !chapters || !episodes || !scenes || !assets) {
    return { available: false, pagesToRestore: 0, pagesToRemove: 0, structureChanges: 0, assetChanges: 0, projectSettingsChanged: false, hasChanges: false };
  }

  const targetPages = new Map<string, number>();
  for (const value of pages) {
    const item = record(value);
    if (typeof item?.id !== "string" || item.id.length === 0 || typeof item.revision !== "number" || !Number.isFinite(item.revision)) {
      return { available: false, pagesToRestore: 0, pagesToRemove: 0, structureChanges: 0, assetChanges: 0, projectSettingsChanged: false, hasChanges: false };
    }
    targetPages.set(item.id, item.revision);
  }
  const targetChapters = idSet(chapters);
  const targetEpisodes = idSet(episodes);
  const targetScenes = idSet(scenes);
  const targetAssets = idSet(assets);
  if (!targetChapters || !targetEpisodes || !targetScenes || !targetAssets) {
    return { available: false, pagesToRestore: 0, pagesToRemove: 0, structureChanges: 0, assetChanges: 0, projectSettingsChanged: false, hasChanges: false };
  }
  const currentPages = new Map(current.pages.map((item) => [item.id, Number(item.revision)]));
  let pagesToRestore = 0;
  let pagesToRemove = 0;
  for (const [id, revision] of targetPages) if (currentPages.get(id) !== revision) pagesToRestore += 1;
  for (const id of currentPages.keys()) if (!targetPages.has(id)) pagesToRemove += 1;

  const structureChanges = symmetricDifferenceSize(targetChapters, new Set(current.chapters.map((item) => item.id)))
    + symmetricDifferenceSize(targetEpisodes, new Set(current.episodes.map((item) => item.id)))
    + symmetricDifferenceSize(targetScenes, new Set(current.scenes.map((item) => item.id)));
  const assetChanges = symmetricDifferenceSize(targetAssets, new Set(current.assets.map((item) => item.id)));
  const projectSettingsChanged = project.title !== current.project.title
    || (project.description ?? "") !== current.project.description
    || project.readingDirection !== current.project.readingDirection
    || Number(project.width) !== current.project.width
    || Number(project.height) !== current.project.height
    || Number(project.dpi) !== current.project.dpi;
  const hasChanges = pagesToRestore > 0 || pagesToRemove > 0 || structureChanges > 0 || assetChanges > 0 || projectSettingsChanged;
  return { available: true, pagesToRestore, pagesToRemove, structureChanges, assetChanges, projectSettingsChanged, hasChanges };
}

export const maximumMarketplacePublicationFixationWorks = 100;
export const maximumMarketplacePublicationFixationProducts = 100;
export const maximumMarketplacePublicationFixationCheckpoints = 100;
export const maximumMarketplacePublicationFixationCheckpointPages = 10_000;

export type MarketplacePublicationFixationWork = {
  id?: unknown;
  creator_id?: unknown;
  source_project_id?: unknown;
  current_publication_id?: unknown;
  content_class?: unknown;
  status?: unknown;
  is_public?: unknown;
};

export type MarketplacePublicationFixationProduct = {
  work_id?: unknown;
  creator_id?: unknown;
  status?: unknown;
};

export type MarketplacePublicationFixationProject = {
  id?: unknown;
  owner_profile_id?: unknown;
  content_class?: unknown;
  deleted_at?: unknown;
};

export type MarketplacePublicationFixationCheckpoint = {
  id?: unknown;
  project_id?: unknown;
  created_by_profile_id?: unknown;
  kind?: unknown;
  page_count?: unknown;
  manifest_sha256?: unknown;
};

export type MarketplacePublicationFixationCheckpointPage = {
  checkpoint_id?: unknown;
  page_number?: unknown;
};

export type MarketplacePublicationFixationCheckId =
  | "bounded-inventory"
  | "mutable-cloud-works"
  | "owner-alignment"
  | "release-checkpoints"
  | "complete-checkpoint-pages"
  | "fixation-targets";

export type MarketplacePublicationFixationReadinessReport = {
  passed: boolean;
  checks: Array<{
    id: MarketplacePublicationFixationCheckId;
    label: string;
    ready: boolean;
    missing: string[];
  }>;
  counts: {
    checkedCloudWorks: number;
    unpinnedMutableCloudWorks: number;
    ownerAlignedCloudWorks: number;
    pausedProductCloudWorks: number;
    releaseCheckpoints: number;
    completeReleaseCheckpoints: number;
    fixationReadyWorks: number;
    fixationReadyProducts: number;
  };
  safety: {
    identifiersPrinted: false;
    personalDataSelected: false;
    productionMutation: false;
    requestMethods: ["GET"];
    storageObjectRead: false;
    syncRpcCalled: false;
  };
};

const check = (
  id: MarketplacePublicationFixationCheckId,
  label: string,
  ready: boolean,
  missing: string,
) => ({ id, label, ready, missing: ready ? [] : [missing] });

const stringValue = (value: unknown) =>
  typeof value === "string" && value ? value : null;

const isValidManifest = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

export function assessMarketplacePublicationFixationReadiness({
  checkpointPages = [],
  checkpoints = [],
  products = [],
  projects = [],
  works = [],
}: {
  checkpointPages?: MarketplacePublicationFixationCheckpointPage[];
  checkpoints?: MarketplacePublicationFixationCheckpoint[];
  products?: MarketplacePublicationFixationProduct[];
  projects?: MarketplacePublicationFixationProject[];
  works?: MarketplacePublicationFixationWork[];
}): MarketplacePublicationFixationReadinessReport {
  const inventoryComplete =
    works.length <= maximumMarketplacePublicationFixationWorks &&
    products.length <= maximumMarketplacePublicationFixationProducts &&
    checkpoints.length <= maximumMarketplacePublicationFixationCheckpoints &&
    checkpointPages.length <=
      maximumMarketplacePublicationFixationCheckpointPages;
  const inspectedWorks = inventoryComplete ? works : [];
  const inspectedProducts = inventoryComplete ? products : [];
  const inspectedProjects = inventoryComplete ? projects : [];
  const inspectedCheckpoints = inventoryComplete ? checkpoints : [];
  const inspectedCheckpointPages = inventoryComplete ? checkpointPages : [];

  const projectsById = new Map(
    inspectedProjects.flatMap((project) => {
      const id = stringValue(project.id);
      return id ? [[id, project] as const] : [];
    }),
  );
  const pagesByCheckpoint = new Map<string, Set<number>>();
  for (const page of inspectedCheckpointPages) {
    const checkpointId = stringValue(page.checkpoint_id);
    const pageNumber = Number(page.page_number);
    if (!checkpointId || !Number.isInteger(pageNumber) || pageNumber < 1) continue;
    const numbers = pagesByCheckpoint.get(checkpointId) ?? new Set<number>();
    numbers.add(pageNumber);
    pagesByCheckpoint.set(checkpointId, numbers);
  }
  const completeCheckpointIds = new Set<string>();
  for (const checkpoint of inspectedCheckpoints) {
    const checkpointId = stringValue(checkpoint.id);
    const pageCount = Number(checkpoint.page_count);
    const pageNumbers = checkpointId
      ? pagesByCheckpoint.get(checkpointId)
      : undefined;
    if (
      checkpointId &&
      checkpoint.kind === "release" &&
      Number.isInteger(pageCount) &&
      pageCount >= 1 &&
      pageCount <= 100 &&
      isValidManifest(checkpoint.manifest_sha256) &&
      pageNumbers?.size === pageCount &&
      Array.from({ length: pageCount }, (_, index) => index + 1).every(
        (pageNumber) => pageNumbers.has(pageNumber),
      )
    ) {
      completeCheckpointIds.add(checkpointId);
    }
  }

  const mutableWorks = inspectedWorks.filter(
    (work) =>
      stringValue(work.id) &&
      stringValue(work.creator_id) &&
      stringValue(work.source_project_id) &&
      !stringValue(work.current_publication_id) &&
      work.content_class === "general" &&
      work.status === "draft" &&
      work.is_public === false,
  );
  const ownerAlignedWorks = mutableWorks.filter((work) => {
    const projectId = stringValue(work.source_project_id);
    const project = projectId ? projectsById.get(projectId) : undefined;
    return Boolean(
      project &&
        project.owner_profile_id === work.creator_id &&
        project.content_class === "general" &&
        project.deleted_at == null,
    );
  });
  const productsByWorkId = new Map<string, number>();
  const pausedProductsByWorkId = new Map<string, number>();
  for (const product of inspectedProducts) {
    const workId = stringValue(product.work_id);
    if (!workId) continue;
    const work = ownerAlignedWorks.find((candidate) => candidate.id === workId);
    if (!work || product.creator_id !== work.creator_id) continue;
    productsByWorkId.set(workId, (productsByWorkId.get(workId) ?? 0) + 1);
    if (product.status !== "paused") continue;
    pausedProductsByWorkId.set(
      workId,
      (pausedProductsByWorkId.get(workId) ?? 0) + 1,
    );
  }
  const completeCheckpointProjectIds = new Set(
    inspectedCheckpoints.flatMap((checkpoint) => {
      const id = stringValue(checkpoint.id);
      const projectId = stringValue(checkpoint.project_id);
      const project = projectId ? projectsById.get(projectId) : undefined;
      return id &&
        projectId &&
        completeCheckpointIds.has(id) &&
        project &&
        checkpoint.created_by_profile_id === project.owner_profile_id
        ? [projectId]
        : [];
    }),
  );
  const fixationReadyWorks = ownerAlignedWorks.filter((work) => {
    const projectId = stringValue(work.source_project_id);
    const workId = stringValue(work.id);
    return Boolean(
      projectId &&
        workId &&
        completeCheckpointProjectIds.has(projectId) &&
        productsByWorkId.get(workId) === 1 &&
        pausedProductsByWorkId.get(workId) === 1,
    );
  });
  const fixationReadyProducts = fixationReadyWorks.reduce(
    (count, work) => count + (pausedProductsByWorkId.get(String(work.id)) ?? 0),
    0,
  );
  const releaseCheckpoints = inspectedCheckpoints.filter(
    (checkpoint) => checkpoint.kind === "release",
  ).length;
  const completeReleaseCheckpoints = inspectedCheckpoints.filter((checkpoint) => {
    const id = stringValue(checkpoint.id);
    return Boolean(id && completeCheckpointIds.has(id));
  }).length;
  const checks = [
    check(
      "bounded-inventory",
      "Bounded complete inventory",
      inventoryComplete,
      "more than the bounded Cloud work, product, checkpoint, or page inventory requires pagination",
    ),
    check(
      "mutable-cloud-works",
      "Unpublished mutable Cloud works",
      mutableWorks.length > 0,
      "an unpublished private general Cloud work without a selected publication",
    ),
    check(
      "owner-alignment",
      "Work and project ownership alignment",
      ownerAlignedWorks.length > 0,
      "a Cloud work owned by the same profile as its active general project",
    ),
    check(
      "release-checkpoints",
      "Release checkpoint availability",
      releaseCheckpoints > 0,
      "at least one release checkpoint for an audited Cloud project",
    ),
    check(
      "complete-checkpoint-pages",
      "Complete release checkpoint pages",
      completeReleaseCheckpoints > 0,
      "a release checkpoint with a valid manifest and contiguous page inventory",
    ),
    check(
      "fixation-targets",
      "Publication fixation targets",
      fixationReadyWorks.length > 0,
      "a mutable Cloud work with exactly one paused product and a complete release checkpoint",
    ),
  ];

  return {
    passed: checks.every((item) => item.ready),
    checks,
    counts: {
      checkedCloudWorks: inventoryComplete ? inspectedWorks.length : 0,
      unpinnedMutableCloudWorks: mutableWorks.length,
      ownerAlignedCloudWorks: ownerAlignedWorks.length,
      pausedProductCloudWorks: pausedProductsByWorkId.size,
      releaseCheckpoints,
      completeReleaseCheckpoints,
      fixationReadyWorks: fixationReadyWorks.length,
      fixationReadyProducts,
    },
    safety: {
      identifiersPrinted: false,
      personalDataSelected: false,
      productionMutation: false,
      requestMethods: ["GET"],
      storageObjectRead: false,
      syncRpcCalled: false,
    },
  };
}

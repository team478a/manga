export const maximumMarketplaceProductionCanaryProducts = 100;
export const maximumMarketplaceProductionCanaryWorks = 100;

export type MarketplaceProductionCanaryRuntimeEnvironment = {
  VERCEL_ENV?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export function assertMarketplaceProductionCanaryRuntime(
  environment: MarketplaceProductionCanaryRuntimeEnvironment,
) {
  if (environment.VERCEL_ENV !== "production") {
    throw new Error("Production runtime is required.");
  }
  let origin: string;
  try {
    origin = new URL(environment.NEXT_PUBLIC_SITE_URL ?? "").origin;
  } catch {
    throw new Error("Production site origin is invalid.");
  }
  if (origin !== "https://app.mang-ai.com") {
    throw new Error("Production site origin is invalid.");
  }
}

export type MarketplaceProductionCanaryWork = {
  id?: unknown;
  creator_id?: unknown;
  status?: unknown;
  is_public?: unknown;
  content_class?: unknown;
  source_project_id?: unknown;
  current_publication_id?: unknown;
};

export type MarketplaceProductionCanaryProduct = {
  work_id?: unknown;
  creator_id?: unknown;
  price?: unknown;
  status?: unknown;
  file_url?: unknown;
  works?: MarketplaceProductionCanaryWork | MarketplaceProductionCanaryWork[] | null;
};

export function attachMarketplaceProductionCanaryWorks(
  products: MarketplaceProductionCanaryProduct[],
  works: MarketplaceProductionCanaryWork[],
): MarketplaceProductionCanaryProduct[] {
  const worksById = new Map(
    works.flatMap((work) =>
      typeof work.id === "string" && work.id ? [[work.id, work] as const] : [],
    ),
  );

  return products.map((product) => ({
    ...product,
    works:
      typeof product.work_id === "string"
        ? (worksById.get(product.work_id) ?? null)
        : null,
  }));
}

export type MarketplaceProductionCanaryProfile = {
  id?: unknown;
  role?: unknown;
};

export type MarketplaceProductionCanaryInventoryCheck = {
  id: "bounded-inventory" | "eligible-products";
  label: string;
  ready: boolean;
  missing: string[];
};

export type MarketplaceProductionCanaryInventoryReport = {
  passed: boolean;
  counts: {
    checkedActiveProducts: number;
    eligibleProducts: number;
    eligibleSellers: number;
  };
  preparation: {
    ready: boolean;
    checkedProducts: number;
    pausedProducts: number;
    activationReadyPausedProducts: number;
    activationReadySellers: number;
  };
  preparationDiagnostics: {
    audited: boolean;
    priceReadyPausedProducts: number;
    fileReadyPausedProducts: number;
    linkedWorkReadyPausedProducts: number;
    publicGeneralWorkReadyPausedProducts: number;
    publicationReadyPausedProducts: number;
    sellerRoleReadyPausedProducts: number;
  };
  preparationRemediation: {
    audited: boolean;
    activationReadyPausedProducts: number;
    workPublicationReviewPausedProducts: number;
    cloudPublicationReviewPausedProducts: number;
    workAndCloudPublicationReviewPausedProducts: number;
    otherBlockerPausedProducts: number;
  };
  sourcePreparation: {
    audited: boolean;
    complete: boolean;
    ready: boolean;
    checkedWorks: number;
    unregisteredWorks: number;
    registrationReadyWorks: number;
    registrationReadySellers: number;
  };
  checks: MarketplaceProductionCanaryInventoryCheck[];
};

const check = (
  id: MarketplaceProductionCanaryInventoryCheck["id"],
  label: string,
  ready: boolean,
  missing: string,
): MarketplaceProductionCanaryInventoryCheck => ({
  id,
  label,
  ready,
  missing: ready ? [] : [missing],
});

const isEligibleWork = (
  work: MarketplaceProductionCanaryWork | null,
  expectedCreatorId?: unknown,
) => {
  return Boolean(
    work &&
      typeof work.id === "string" &&
      typeof work.creator_id === "string" &&
      (expectedCreatorId === undefined || work.creator_id === expectedCreatorId) &&
      work.status === "published" &&
      work.is_public === true &&
      work.content_class === "general" &&
      (!work.source_project_id || work.current_publication_id),
  );
};

const hasEligibleWork = (product: MarketplaceProductionCanaryProduct) => {
  const work =
    product.works && !Array.isArray(product.works) ? product.works : null;
  return isEligibleWork(work, product.creator_id);
};

export function assessMarketplaceProductionCanaryInventory(input: {
  products: MarketplaceProductionCanaryProduct[];
  profiles: MarketplaceProductionCanaryProfile[];
  sourceWorks?: MarketplaceProductionCanaryWork[];
}): MarketplaceProductionCanaryInventoryReport {
  if (input.products.length > maximumMarketplaceProductionCanaryProducts) {
    const checks = [
      check(
        "bounded-inventory",
        "Bounded complete inventory",
        false,
        "no more than 100 active products per operator review batch",
      ),
      check(
        "eligible-products",
        "Eligible canary products",
        false,
        "a complete inventory before candidate counting",
      ),
    ];
    return {
      passed: false,
      counts: {
        checkedActiveProducts: maximumMarketplaceProductionCanaryProducts,
        eligibleProducts: 0,
        eligibleSellers: 0,
      },
      preparation: {
        ready: false,
        checkedProducts: maximumMarketplaceProductionCanaryProducts,
        pausedProducts: 0,
        activationReadyPausedProducts: 0,
        activationReadySellers: 0,
      },
      preparationDiagnostics: {
        audited: false,
        priceReadyPausedProducts: 0,
        fileReadyPausedProducts: 0,
        linkedWorkReadyPausedProducts: 0,
        publicGeneralWorkReadyPausedProducts: 0,
        publicationReadyPausedProducts: 0,
        sellerRoleReadyPausedProducts: 0,
      },
      preparationRemediation: {
        audited: false,
        activationReadyPausedProducts: 0,
        workPublicationReviewPausedProducts: 0,
        cloudPublicationReviewPausedProducts: 0,
        workAndCloudPublicationReviewPausedProducts: 0,
        otherBlockerPausedProducts: 0,
      },
      sourcePreparation: {
        audited: false,
        complete: false,
        ready: false,
        checkedWorks: 0,
        unregisteredWorks: 0,
        registrationReadyWorks: 0,
        registrationReadySellers: 0,
      },
      checks,
    };
  }

  const eligibleSellerIds = new Set(
    input.profiles.flatMap((profile) =>
      typeof profile.id === "string" &&
      ["creator", "admin"].includes(String(profile.role))
        ? [profile.id]
        : [],
    ),
  );
  const productWork = (product: MarketplaceProductionCanaryProduct) =>
    product.works && !Array.isArray(product.works) ? product.works : null;
  const hasReadyPrice = (product: MarketplaceProductionCanaryProduct) => {
    const price = Number(product.price);
    return Number.isInteger(price) && price >= 50 && price <= 1000;
  };
  const hasReadyFile = (product: MarketplaceProductionCanaryProduct) =>
    typeof product.file_url === "string" && Boolean(product.file_url.trim());
  const hasReadyLinkedWork = (product: MarketplaceProductionCanaryProduct) => {
    const work = productWork(product);
    return Boolean(
      work &&
        typeof work.id === "string" &&
        typeof work.creator_id === "string" &&
        work.creator_id === product.creator_id,
    );
  };
  const hasReadyPublicGeneralWork = (
    product: MarketplaceProductionCanaryProduct,
  ) => {
    const work = productWork(product);
    return Boolean(
      hasReadyLinkedWork(product) &&
        work?.status === "published" &&
        work.is_public === true &&
        work.content_class === "general",
    );
  };
  const hasReadyGeneralWork = (product: MarketplaceProductionCanaryProduct) => {
    const work = productWork(product);
    return Boolean(
      hasReadyLinkedWork(product) && work?.content_class === "general",
    );
  };
  const hasReadyPublication = (product: MarketplaceProductionCanaryProduct) => {
    const work = productWork(product);
    return Boolean(
      hasReadyLinkedWork(product) &&
        work &&
        (!work.source_project_id || work.current_publication_id),
    );
  };
  const hasReadySellerRole = (product: MarketplaceProductionCanaryProduct) =>
    typeof product.creator_id === "string" &&
    eligibleSellerIds.has(product.creator_id);
  const hasEligibleProductDetails = (
    product: MarketplaceProductionCanaryProduct,
  ) =>
    hasReadyPrice(product) &&
    hasReadyFile(product) &&
    hasReadyPublicGeneralWork(product) &&
    hasReadyPublication(product) &&
    hasReadySellerRole(product) &&
    hasEligibleWork(product);
  const eligibleProducts = input.products.filter(
    (product) =>
      product.status === "active" && hasEligibleProductDetails(product),
  );
  const pausedProducts = input.products.filter(
    (product) => product.status === "paused",
  );
  const activationReadyPausedProducts = pausedProducts.filter(
    hasEligibleProductDetails,
  );
  const hasReadyRemediationBase = (
    product: MarketplaceProductionCanaryProduct,
  ) =>
    hasReadyPrice(product) &&
    hasReadyFile(product) &&
    hasReadyLinkedWork(product) &&
    hasReadyGeneralWork(product) &&
    hasReadySellerRole(product);
  const workPublicationReviewPausedProducts = pausedProducts.filter(
    (product) =>
      hasReadyRemediationBase(product) &&
      !hasReadyPublicGeneralWork(product) &&
      hasReadyPublication(product),
  );
  const cloudPublicationReviewPausedProducts = pausedProducts.filter(
    (product) =>
      hasReadyRemediationBase(product) &&
      hasReadyPublicGeneralWork(product) &&
      !hasReadyPublication(product),
  );
  const workAndCloudPublicationReviewPausedProducts = pausedProducts.filter(
    (product) =>
      hasReadyRemediationBase(product) &&
      !hasReadyPublicGeneralWork(product) &&
      !hasReadyPublication(product),
  );
  const classifiedRemediationProducts =
    activationReadyPausedProducts.length +
    workPublicationReviewPausedProducts.length +
    cloudPublicationReviewPausedProducts.length +
    workAndCloudPublicationReviewPausedProducts.length;
  const eligibleSellers = new Set(
    eligibleProducts.map((product) => String(product.creator_id)),
  ).size;
  const activationReadySellers = new Set(
    activationReadyPausedProducts.map((product) => String(product.creator_id)),
  ).size;
  const sourceWorks = input.sourceWorks;
  const sourceInventoryAudited = sourceWorks !== undefined;
  const sourceInventoryComplete = Boolean(
    sourceWorks && sourceWorks.length <= maximumMarketplaceProductionCanaryWorks,
  );
  const completeSourceWorks = sourceInventoryComplete ? (sourceWorks ?? []) : [];
  const registeredWorkIds = new Set(
    input.products.flatMap((product) =>
      typeof product.work_id === "string" && product.work_id
        ? [product.work_id]
        : [],
    ),
  );
  const unregisteredWorks = sourceInventoryComplete
    ? completeSourceWorks.filter(
        (work) =>
          isEligibleWork(work) &&
          typeof work.id === "string" &&
          !registeredWorkIds.has(work.id),
      )
    : [];
  const registrationReadyWorks = unregisteredWorks.filter(
    (work) =>
      typeof work.creator_id === "string" &&
      eligibleSellerIds.has(work.creator_id),
  );
  const registrationReadySellers = new Set(
    registrationReadyWorks.map((work) => String(work.creator_id)),
  ).size;
  const checks = [
    check(
      "bounded-inventory",
      "Bounded complete inventory",
      true,
      "no more than 100 active products per operator review batch",
    ),
    check(
      "eligible-products",
      "Eligible canary products",
      eligibleProducts.length > 0,
      "at least one 50-1,000 JPY active product with an eligible seller, file, and published public general-audience work",
    ),
  ];

  return {
    passed: checks.every((item) => item.ready),
    counts: {
      checkedActiveProducts: input.products.filter(
        (product) => product.status === "active",
      ).length,
      eligibleProducts: eligibleProducts.length,
      eligibleSellers,
    },
    preparation: {
      ready: activationReadyPausedProducts.length > 0,
      checkedProducts: input.products.length,
      pausedProducts: pausedProducts.length,
      activationReadyPausedProducts: activationReadyPausedProducts.length,
      activationReadySellers,
    },
    preparationDiagnostics: {
      audited: true,
      priceReadyPausedProducts: pausedProducts.filter(hasReadyPrice).length,
      fileReadyPausedProducts: pausedProducts.filter(hasReadyFile).length,
      linkedWorkReadyPausedProducts: pausedProducts.filter(hasReadyLinkedWork)
        .length,
      publicGeneralWorkReadyPausedProducts: pausedProducts.filter(
        hasReadyPublicGeneralWork,
      ).length,
      publicationReadyPausedProducts: pausedProducts.filter(hasReadyPublication)
        .length,
      sellerRoleReadyPausedProducts: pausedProducts.filter(hasReadySellerRole)
        .length,
    },
    preparationRemediation: {
      audited: true,
      activationReadyPausedProducts: activationReadyPausedProducts.length,
      workPublicationReviewPausedProducts:
        workPublicationReviewPausedProducts.length,
      cloudPublicationReviewPausedProducts:
        cloudPublicationReviewPausedProducts.length,
      workAndCloudPublicationReviewPausedProducts:
        workAndCloudPublicationReviewPausedProducts.length,
      otherBlockerPausedProducts:
        pausedProducts.length - classifiedRemediationProducts,
    },
    sourcePreparation: {
      audited: sourceInventoryAudited,
      complete: sourceInventoryComplete,
      ready: sourceInventoryComplete && registrationReadyWorks.length > 0,
      checkedWorks: sourceInventoryComplete
        ? completeSourceWorks.length
        : sourceInventoryAudited
          ? maximumMarketplaceProductionCanaryWorks
          : 0,
      unregisteredWorks: unregisteredWorks.length,
      registrationReadyWorks: registrationReadyWorks.length,
      registrationReadySellers,
    },
    checks,
  };
}

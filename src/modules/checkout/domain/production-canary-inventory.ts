export const maximumMarketplaceProductionCanaryProducts = 100;

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

const hasEligibleWork = (product: MarketplaceProductionCanaryProduct) => {
  const work =
    product.works && !Array.isArray(product.works) ? product.works : null;
  return Boolean(
    work &&
      work.creator_id === product.creator_id &&
      work.status === "published" &&
      work.is_public === true &&
      work.content_class === "general" &&
      (!work.source_project_id || work.current_publication_id),
  );
};

export function assessMarketplaceProductionCanaryInventory(input: {
  products: MarketplaceProductionCanaryProduct[];
  profiles: MarketplaceProductionCanaryProfile[];
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
  const eligibleProducts = input.products.filter((product) => {
    const price = Number(product.price);
    return Boolean(
      product.status === "active" &&
        typeof product.creator_id === "string" &&
        eligibleSellerIds.has(product.creator_id) &&
        Number.isInteger(price) &&
        price >= 50 &&
        price <= 1000 &&
        typeof product.file_url === "string" &&
        product.file_url.trim() &&
        hasEligibleWork(product),
    );
  });
  const eligibleSellers = new Set(
    eligibleProducts.map((product) => String(product.creator_id)),
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
      checkedActiveProducts: input.products.length,
      eligibleProducts: eligibleProducts.length,
      eligibleSellers,
    },
    checks,
  };
}

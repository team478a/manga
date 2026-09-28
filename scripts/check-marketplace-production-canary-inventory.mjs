import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveMarketplaceProductionTargetEnvironment } from "./check-marketplace-production-canary-target.mjs";
import {
  parseEnvironmentFile,
  resolveCandidateEnvironmentPath,
} from "./check-marketplace-staging-deployment.mjs";
import {
  assessMarketplaceProductionCanaryInventory,
  maximumMarketplaceProductionCanaryProducts,
} from "../src/modules/checkout/domain/production-canary-inventory.ts";

const authorizedHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

const readRows = async ({ fetchFn, label, serviceRoleKey, url }) => {
  let response;
  try {
    response = await fetchFn(url, {
      headers: authorizedHeaders(serviceRoleKey),
      method: "GET",
    });
  } catch {
    throw new Error(`${label} request failed.`);
  }
  if (!response.ok)
    throw new Error(`${label} request failed with HTTP ${response.status}.`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`${label} returned an invalid shape.`);
  return rows;
};

export async function runMarketplaceProductionCanaryInventory({
  environment,
  fetchFn = fetch,
}) {
  const { serviceRoleKey, supabaseUrl } =
    resolveMarketplaceProductionTargetEnvironment(environment);
  const productsUrl = new URL("/rest/v1/digital_products", supabaseUrl);
  productsUrl.searchParams.set(
    "select",
    "id,creator_id,price,status,file_url,works:work_id(id,creator_id,status,is_public,content_class,source_project_id,current_publication_id)",
  );
  productsUrl.searchParams.set("status", "eq.active");
  productsUrl.searchParams.set("order", "created_at.asc,id.asc");
  productsUrl.searchParams.set(
    "limit",
    String(maximumMarketplaceProductionCanaryProducts + 1),
  );

  const products = await readRows({
    fetchFn,
    label: "Production product inventory",
    serviceRoleKey,
    url: productsUrl,
  });
  const inventoryComplete =
    products.length <= maximumMarketplaceProductionCanaryProducts;
  if (!inventoryComplete) {
    const report = assessMarketplaceProductionCanaryInventory({
      products,
      profiles: [],
    });
    return {
      ...report,
      safety: {
        requestMethods: ["GET"],
        identifiersPrinted: false,
        personalDataSelected: false,
        productFileDownloaded: false,
        productionMutation: false,
        stripeRequest: false,
        paymentCreated: false,
      },
    };
  }

  const sellerIds = [
    ...new Set(
      products
        .map((product) => product?.creator_id)
        .filter((value) => typeof value === "string" && value),
    ),
  ];
  let profiles = [];
  if (sellerIds.length > 0) {
    const profilesUrl = new URL("/rest/v1/profiles", supabaseUrl);
    profilesUrl.searchParams.set("select", "id,role");
    profilesUrl.searchParams.set("id", `in.(${sellerIds.join(",")})`);
    profilesUrl.searchParams.set(
      "limit",
      String(maximumMarketplaceProductionCanaryProducts),
    );
    profiles = await readRows({
      fetchFn,
      label: "Production seller inventory",
      serviceRoleKey,
      url: profilesUrl,
    });
  }
  const report = assessMarketplaceProductionCanaryInventory({
    products,
    profiles,
  });

  return {
    ...report,
    safety: {
      requestMethods: sellerIds.length > 0 ? ["GET", "GET"] : ["GET"],
      identifiersPrinted: false,
      personalDataSelected: false,
      productFileDownloaded: false,
      productionMutation: false,
      stripeRequest: false,
      paymentCreated: false,
    },
  };
}

const printReport = (report) => {
  console.log("MANGAI Marketplace Production canary inventory");
  console.log("===============================================");
  console.log("Product, seller, work, and personal identifiers: hidden");
  for (const item of report.checks) {
    console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
    for (const missing of item.missing) console.log(`  [missing] ${missing}`);
  }
  console.log(`\nChecked active products: ${report.counts.checkedActiveProducts}`);
  console.log(`Eligible canary products: ${report.counts.eligibleProducts}`);
  console.log(`Eligible sellers: ${report.counts.eligibleSellers}`);
  console.log(
    "\nGET requests only. No Production mutation, Stripe request, file download, environment update, or payment was performed.",
  );
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const argumentsList = process.argv.slice(2);
    if (
      argumentsList.length !== 0 &&
      (argumentsList.length !== 2 || argumentsList[0] !== "--candidate")
    ) {
      throw new Error("Use no arguments or --candidate with one environment file.");
    }
    const candidatePath =
      argumentsList.length === 2
        ? resolveCandidateEnvironmentPath({ argument: argumentsList[1] })
        : null;
    const report = await runMarketplaceProductionCanaryInventory({
      environment: candidatePath
        ? parseEnvironmentFile(fs.readFileSync(candidatePath, "utf8"))
        : process.env,
    });
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to inspect Production canary inventory.",
    );
    process.exitCode = 1;
  }
}

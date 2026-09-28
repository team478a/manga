import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessMarketplaceProductionCanaryPlan } from "./check-marketplace-production-canary-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optionNames = new Set([
  "--output",
  "--product-id",
  "--seller-profile-id",
  "--buyer-profile-id",
  "--amount-jpy",
  "--duration-hours",
]);

const isPathInside = (parentPath, candidatePath) => {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};

export const parseCanaryPlanCreateArguments = (argumentsList) => {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!optionNames.has(name)) throw new Error("Unknown canary plan option.");
    if (!value || value.startsWith("--"))
      throw new Error("Each canary plan option requires a value.");
    if (Object.hasOwn(options, name))
      throw new Error("Duplicate canary plan option.");
    options[name] = value;
  }
  if (Object.keys(options).length !== optionNames.size)
    throw new Error("All canary plan options are required.");
  return options;
};

const parseInteger = (value, label) => {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an integer.`);
  return Number(value);
};

export const createMarketplaceProductionCanaryPlan = (
  options,
  { now = Date.now() } = {},
) => {
  const productId = options["--product-id"]?.trim();
  const sellerProfileId = options["--seller-profile-id"]?.trim();
  const buyerProfileId = options["--buyer-profile-id"]?.trim();
  if (
    !uuidPattern.test(productId ?? "") ||
    !uuidPattern.test(sellerProfileId ?? "") ||
    !uuidPattern.test(buyerProfileId ?? "")
  ) {
    throw new Error("Product, seller, and buyer must use valid UUIDs.");
  }
  if (sellerProfileId.toLowerCase() === buyerProfileId.toLowerCase())
    throw new Error("Seller and buyer must be different profiles.");

  const expectedAmountJpy = parseInteger(options["--amount-jpy"], "Amount");
  if (expectedAmountJpy < 50 || expectedAmountJpy > 1000)
    throw new Error("Amount must be between 50 and 1,000 JPY.");
  const durationHours = parseInteger(
    options["--duration-hours"],
    "Duration hours",
  );
  if (durationHours < 1 || durationHours > 24)
    throw new Error("Duration must be between 1 and 24 hours.");

  const plan = {
    schemaVersion: 1,
    purpose: "marketplace-production-canary",
    environment: "production",
    productionOrigin: "https://app.mang-ai.com",
    checkoutMode: "live",
    productId,
    sellerProfileId,
    buyerProfileId,
    currency: "jpy",
    expectedAmountJpy,
    maxPurchaseCount: 1,
    refundOnAcceptanceFailure: true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + durationHours * 60 * 60 * 1000).toISOString(),
  };
  const report = assessMarketplaceProductionCanaryPlan(plan, { now });
  if (!report.passed || !report.fingerprint)
    throw new Error("Generated canary plan did not pass validation.");
  return { fingerprint: report.fingerprint, plan };
};

export const resolveCanaryPlanOutputPath = ({
  argument,
  repositoryRoot = root,
  existsSync = fs.existsSync,
  realpathSync = fs.realpathSync,
}) => {
  if (!argument || !path.isAbsolute(argument))
    throw new Error("Canary plan output must use an absolute path.");
  if (path.extname(argument).toLowerCase() !== ".json")
    throw new Error("Canary plan output must use a .json extension.");

  const outputPath = path.resolve(argument);
  if (existsSync(outputPath))
    throw new Error("Canary plan output already exists; overwrite is not allowed.");
  const parentPath = path.dirname(outputPath);
  if (!existsSync(parentPath))
    throw new Error("Canary plan output directory was not found.");

  const realRepositoryRoot = realpathSync(repositoryRoot);
  const realParentPath = realpathSync(parentPath);
  if (
    isPathInside(realRepositoryRoot, outputPath) ||
    isPathInside(realRepositoryRoot, realParentPath)
  ) {
    throw new Error("Canary plan output must be stored outside the repository.");
  }
  return path.join(realParentPath, path.basename(outputPath));
};

export const writeMarketplaceProductionCanaryPlan = ({ outputPath, plan }) => {
  const descriptor = fs.openSync(outputPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  try {
    const options = parseCanaryPlanCreateArguments(process.argv.slice(2));
    const outputPath = resolveCanaryPlanOutputPath({
      argument: options["--output"],
    });
    const { fingerprint, plan } = createMarketplaceProductionCanaryPlan(options);
    writeMarketplaceProductionCanaryPlan({ outputPath, plan });
    console.log("Validated canary plan created outside the repository.");
    console.log("Plan identifiers and output path: hidden");
    console.log(`Approval fingerprint (SHA-256): ${fingerprint}`);
    console.log(
      "No Production connection, mutation, Stripe request, environment update, or payment was performed.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to create Production canary plan.",
    );
    process.exitCode = 1;
  }
}

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { validateRightsReviewPackage } from "./lib/manga-quality-rights-review.mjs";

const REVIEW_BUCKET = "manga-quality-review";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BATCH_CODE = /^batch_[a-z0-9][a-z0-9_-]{2,63}$/;
const ALLOWED_DEFECT_CATEGORIES = [
  "anatomy_hand_error", "anatomy_body_distortion", "object_fusion",
  "unwanted_text", "unwanted_ui", "unwanted_logo", "crop_error",
  "orientation_error", "gravity_error", "low_readability", "other",
];

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`monitor_review_admission_argument_required:${name}`);
  return value;
}

function projectRefFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("monitor_review_staging_url_invalid");
  }
  const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  if (url.protocol !== "https:" || !match) throw new Error("monitor_review_staging_url_invalid");
  return match[1];
}

function isoTimestamp(value, errorCode) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error(errorCode);
  return new Date(value).toISOString();
}

const packagePath = path.resolve(requiredArgument("--package"));
const batchCode = requiredArgument("--batch-code");
const createdByProfileId = requiredArgument("--created-by-profile-id");
const expiresAt = isoTimestamp(requiredArgument("--expires-at"), "monitor_review_admission_expiry_invalid");
const startsAt = isoTimestamp(argument("--starts-at") ?? new Date().toISOString(), "monitor_review_admission_start_invalid");
const expectedCount = Number(argument("--expected-count") ?? "28");
const apply = process.argv.includes("--apply");
if (!BATCH_CODE.test(batchCode)) throw new Error("monitor_review_admission_batch_code_invalid");
if (!UUID.test(createdByProfileId)) throw new Error("monitor_review_admission_actor_invalid");
if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0 || expectedCount > 140)
  throw new Error("monitor_review_admission_expected_count_invalid");
if (Date.parse(expiresAt) <= Date.parse(startsAt)) throw new Error("monitor_review_admission_window_invalid");

const packageBytes = await readFile(packagePath);
const validated = await validateRightsReviewPackage(packageBytes, { requireComplete: true, expectedCount });
const orderedCases = [...validated.cases].sort((left, right) => left.imageId.localeCompare(right.imageId));
const batchId = randomUUID();
const cases = orderedCases.map((item, index) => ({
  id: randomUUID(),
  batch_id: batchId,
  case_key: `case_${String(index + 1).padStart(6, "0")}`,
  display_order: index + 1,
  review_mode: "intrinsic_only",
  allowed_defect_categories: ALLOWED_DEFECT_CATEGORIES,
  candidate_storage_path: `${batchId}/case_${String(index + 1).padStart(6, "0")}.png`,
  candidate_sha256: item.sha256,
  candidate_width: item.width,
  candidate_height: item.height,
  bytes: item.bytes,
}));

if (!apply) {
  process.stdout.write(`${JSON.stringify({
    status: "STAGING_BATCH_ADMISSION_READY",
    mode: "dry_run",
    batchCode,
    cases: cases.length,
    sourcePackageSha256: validated.packageSha256,
    rightsCompletionChecked: true,
    imageChecksumsAndDimensionsChecked: true,
    databaseChanged: false,
    storageChanged: false,
    productionChanged: false,
  }, null, 2)}\n`);
  process.exit(0);
}

const stagingUrl = process.env.MANGAI_MONITOR_REVIEW_STAGING_SUPABASE_URL ?? "";
const stagingServiceRole = process.env.MANGAI_MONITOR_REVIEW_STAGING_SERVICE_ROLE_KEY ?? "";
const expectedProjectRef = process.env.MANGAI_MONITOR_REVIEW_STAGING_PROJECT_REF ?? "";
const productionProjectRef = process.env.MANGAI_MONITOR_REVIEW_PRODUCTION_PROJECT_REF ?? "";
const confirmedProjectRef = argument("--confirm-staging-project") ?? "";
if (stagingServiceRole.length < 20) throw new Error("monitor_review_staging_service_role_required");
const projectRef = projectRefFromUrl(stagingUrl);
if (!/^[a-z0-9]+$/i.test(expectedProjectRef) || projectRef !== expectedProjectRef || confirmedProjectRef !== expectedProjectRef)
  throw new Error("monitor_review_staging_project_confirmation_failed");
if (!/^[a-z0-9]+$/i.test(productionProjectRef))
  throw new Error("monitor_review_production_project_ref_required");
if (productionProjectRef === projectRef)
  throw new Error("monitor_review_production_project_forbidden");

const client = createClient(stagingUrl, stagingServiceRole, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const bucket = await client.storage.getBucket(REVIEW_BUCKET);
if (bucket.error || !bucket.data || bucket.data.public === true)
  throw new Error("monitor_review_private_bucket_unavailable");
const [sameCode, samePackage] = await Promise.all([
  client.from("cloud_monitor_quality_review_batches").select("id").eq("batch_code", batchCode).limit(1),
  client.from("cloud_monitor_quality_review_batches").select("id").eq("source_package_sha256", validated.packageSha256).limit(1),
]);
if (sameCode.error || samePackage.error) throw new Error("monitor_review_batch_preflight_failed");
if ((sameCode.data?.length ?? 0) > 0) throw new Error("monitor_review_batch_code_already_exists");
if ((samePackage.data?.length ?? 0) > 0) throw new Error("monitor_review_source_package_already_admitted");

const batchRow = {
  id: batchId,
  batch_code: batchCode,
  status: "draft",
  review_scope: "PILOT_INTRINSIC_ONLY",
  source_package_sha256: validated.packageSha256,
  rights_reviewed_at: new Date(validated.response.verified_at).toISOString(),
  rights_reviewed_by: validated.response.verified_by.trim(),
  starts_at: startsAt,
  expires_at: expiresAt,
  created_by_profile_id: createdByProfileId,
};
const insertedBatch = await client.from("cloud_monitor_quality_review_batches").insert(batchRow);
if (insertedBatch.error) throw new Error("monitor_review_batch_insert_failed");

const uploadedPaths = [];
try {
  for (const reviewCase of cases) {
    const upload = await client.storage.from(REVIEW_BUCKET).upload(
      reviewCase.candidate_storage_path,
      reviewCase.bytes,
      { contentType: "image/png", upsert: false, cacheControl: "0" },
    );
    if (upload.error) throw new Error(`monitor_review_case_upload_failed:${reviewCase.case_key}`);
    uploadedPaths.push(reviewCase.candidate_storage_path);
  }
  const caseRows = cases.map(({ bytes: _bytes, ...row }) => row);
  const insertedCases = await client.from("cloud_monitor_quality_review_cases").insert(caseRows);
  if (insertedCases.error) throw new Error("monitor_review_cases_insert_failed");
} catch (error) {
  const cleanupResults = await Promise.allSettled([
    uploadedPaths.length > 0 ? client.storage.from(REVIEW_BUCKET).remove(uploadedPaths) : Promise.resolve(),
    client.from("cloud_monitor_quality_review_batches").delete().eq("id", batchId),
  ]);
  if (cleanupResults.some((result) => result.status === "rejected" || result.value?.error))
    throw new AggregateError([error], "monitor_review_admission_cleanup_failed");
  throw error;
}

process.stdout.write(`${JSON.stringify({
  status: "STAGING_BATCH_ADMITTED_AS_DRAFT",
  batchId,
  batchCode,
  projectRef,
  cases: cases.length,
  sourcePackageSha256: validated.packageSha256,
  rightsCompletionChecked: true,
  databaseChanged: true,
  storageChanged: true,
  productionChanged: false,
}, null, 2)}\n`);

import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  QUALITY_BENCHMARK_ROOT_ENV,
  inspectQualityBenchmarkAssembly,
  qualityBenchmarkAssemblyManifestSchema,
  qualityBenchmarkReviewLedgerSchema,
  qualityBenchmarkRightsLedgerSchema,
} from "../src/modules/manga-quality/domain/quality-benchmark-assembly.ts";
import { qualityBenchmarkIntendedSchema } from "../src/modules/manga-quality/domain/quality-benchmark-fixture.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const defaultRoot = path.join(repositoryRoot, "tests", "fixtures", "manga-quality", "v2.1");
const rootArgumentIndex = process.argv.indexOf("--root");
const fixtureRoot = path.resolve(
  rootArgumentIndex >= 0 ? process.argv[rootArgumentIndex + 1] : process.env[QUALITY_BENCHMARK_ROOT_ENV] ?? defaultRoot,
);
const strict = process.argv.includes("--strict");
const write = process.argv.includes("--write");
const forbiddenPrivateValue = /https?:\/\/|(?:^|[^a-z])sk-(?:proj-)?[a-z0-9_-]{8,}|(?:token|signature|signed_url|x-amz-signature)\s*[:=]/i;
const forbiddenPngMetadata = /prompt|workflow|comment|parameters|negative prompt|seed|sampler/i;

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("benchmark_path_outside_private_root");
  return resolved;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPrivateJson(relativePath) {
  const text = await readFile(resolveInside(fixtureRoot, relativePath), "utf8");
  if (forbiddenPrivateValue.test(text)) throw new Error(`benchmark_private_value_forbidden:${relativePath}`);
  return JSON.parse(text);
}

function inspectPngTextChunks(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("benchmark_image_must_be_png");
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("benchmark_png_chunk_invalid");
    if (["tEXt", "zTXt", "iTXt"].includes(type)) {
      const content = bytes.subarray(offset + 8, offset + 8 + length).toString("utf8");
      if (forbiddenPngMetadata.test(content)) throw new Error("benchmark_png_contains_generation_metadata");
    }
    offset = end;
    if (type === "IEND") break;
  }
}

async function perceptualHashes(bytes) {
  const variants = [
    sharp(bytes),
    sharp(bytes).flop(),
    sharp(bytes).flip(),
  ];
  return Promise.all(variants.map(async (image) => {
    const pixels = await image.resize(16, 16, { fit: "fill" }).grayscale().normalise().raw().toBuffer();
    const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
    return Uint8Array.from(pixels, (value) => value >= mean ? 1 : 0);
  }));
}

function hamming(left, right) {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1)
    if (left[index] !== right[index]) distance += 1;
  return distance;
}

function assertSafeRoot() {
  if (fixtureRoot === repositoryRoot) throw new Error("benchmark_root_cannot_be_repository_root");
  const relative = path.relative(repositoryRoot, fixtureRoot);
  if (!relative.startsWith("..") && relative !== path.join("tests", "fixtures", "manga-quality", "v2.1"))
    throw new Error("benchmark_repo_root_must_use_ignored_v2_1_directory");
}

async function verifyPrivateFiles(manifest, rights) {
  const profiles = new Map(manifest.image_profiles.map((profile) => [profile.id, profile]));
  const visualHashes = [];
  for (const item of manifest.items) {
    const bytes = await readFile(resolveInside(fixtureRoot, item.source_file));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== item.sha256) throw new Error(`benchmark_image_hash_mismatch:${item.id}`);
    inspectPngTextChunks(bytes);
    const metadata = await sharp(bytes).metadata();
    const profile = profiles.get(item.image_profile_id);
    if (!profile || metadata.width !== profile.width || metadata.height !== profile.height)
      throw new Error(`benchmark_image_profile_mismatch:${item.id}`);
    visualHashes.push({ id: item.id, hashes: await perceptualHashes(bytes) });
    qualityBenchmarkIntendedSchema.parse(await readPrivateJson(item.intended));
    for (const reference of item.refs) {
      const referenceBytes = await readFile(resolveInside(fixtureRoot, reference));
      inspectPngTextChunks(referenceBytes);
    }
  }
  for (let left = 0; left < visualHashes.length; left += 1) {
    for (let right = left + 1; right < visualHashes.length; right += 1) {
      const distance = Math.min(...visualHashes[right].hashes.map((candidate) =>
        hamming(visualHashes[left].hashes[0], candidate),
      ));
      if (distance <= 8)
        throw new Error(`benchmark_near_duplicate_detected:${visualHashes[left].id}:${visualHashes[right].id}`);
    }
  }
  for (const record of rights.records) await readPrivateJson(record.evidence_file);
}

async function writePackage(root, packageData, sourceItems) {
  await mkdir(path.join(root, "images"), { recursive: true });
  await mkdir(path.join(root, "intended"), { recursive: true });
  await mkdir(path.join(root, "refs"), { recursive: true });
  for (const item of sourceItems) {
    await copyFile(resolveInside(fixtureRoot, item.source_file), path.join(root, "images", `${item.id}.png`));
    await copyFile(resolveInside(fixtureRoot, item.intended), path.join(root, "intended", `${item.id}.json`));
    for (const reference of item.refs) {
      const relative = reference.replace(/^assembly\//, "");
      const destination = path.join(root, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(resolveInside(fixtureRoot, reference), destination);
    }
  }
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(packageData.manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "cases.json"), `${JSON.stringify(packageData.cases, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "labels.private.json"), `${JSON.stringify(packageData.privateLabels, null, 2)}\n`, "utf8");
}

async function assemble(manifest, packages) {
  const targets = {
    dev: path.join(fixtureRoot, "dev"),
    holdout: path.join(fixtureRoot, "holdout-private"),
  };
  if (await exists(targets.dev) || await exists(targets.holdout))
    throw new Error("benchmark_output_exists_no_overwrite");
  const staging = path.join(fixtureRoot, "assembly", `.output-${process.pid}`);
  await mkdir(staging, { recursive: true });
  try {
    await writePackage(
      path.join(staging, "dev"),
      packages.dev,
      manifest.items.filter((item) => item.split === "dev"),
    );
    await writePackage(
      path.join(staging, "holdout-private"),
      packages.holdout,
      manifest.items.filter((item) => item.split === "holdout_private"),
    );
    await rename(path.join(staging, "dev"), targets.dev);
    await rename(path.join(staging, "holdout-private"), targets.holdout);
  } finally {
    if (await exists(staging)) await rm(staging, { recursive: true });
  }
}

function shortageResult() {
  return {
    status: "BLOCKED_FIXTURE_SHORTAGE",
    benchmarkVersion: "2.1",
    required: { images: 140, independentHumanReviews: 280, rightsRecords: 140 },
    source: process.env[QUALITY_BENCHMARK_ROOT_ENV] ? "environment" : "default_ignored_root",
    note: "Create local-only assembly manifests; never use customer, Production, monitor, v1, adult, PII, unlicensed, or placeholder images.",
  };
}

try {
  assertSafeRoot();
  const required = [
    "assembly/manifest.private.json",
    "assembly/rights.private.json",
    "assembly/reviews.private.json",
  ];
  const present = await Promise.all(required.map((file) => exists(resolveInside(fixtureRoot, file))));
  if (present.some((value) => !value)) {
    process.stdout.write(`${JSON.stringify(shortageResult(), null, 2)}\n`);
    if (strict || write) process.exitCode = 1;
  } else {
    const manifest = qualityBenchmarkAssemblyManifestSchema.parse(await readPrivateJson(required[0]));
    const rights = qualityBenchmarkRightsLedgerSchema.parse(await readPrivateJson(required[1]));
    const reviews = qualityBenchmarkReviewLedgerSchema.parse(await readPrivateJson(required[2]));
    await verifyPrivateFiles(manifest, rights);
    const inspection = inspectQualityBenchmarkAssembly({ manifest, rights, reviews });
    if (write && inspection.ready && inspection.packages) await assemble(manifest, inspection.packages);
    const status = write && inspection.ready ? "ASSEMBLED" : inspection.ready ? "READY_TO_ASSEMBLE" : "BLOCKED_FIXTURE_CONTRACT";
    process.stdout.write(`${JSON.stringify({
      status,
      benchmarkVersion: "2.1",
      counts: {
        images: inspection.itemCount,
        rights: inspection.rightsCount,
        reviews: inspection.reviewCount,
        families: inspection.familyCount,
      },
      reviewMetrics: inspection.reviewMetrics,
      reasons: inspection.reasons,
      productionChanged: false,
    }, null, 2)}\n`);
    if ((strict || write) && !inspection.ready) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`manga quality benchmark assembly failed: ${error instanceof Error ? error.message : "unknown_error"}\n`);
  process.exitCode = 1;
}

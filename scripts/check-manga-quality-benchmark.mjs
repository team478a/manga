import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  inspectQualityBenchmarkReadiness,
  qualityBenchmarkCasesSchema,
  qualityBenchmarkIntendedSchema,
  qualityBenchmarkManifestSchema,
  qualityBenchmarkPrivateLabelsSchema,
} from "../src/modules/manga-quality/domain/quality-benchmark-fixture.ts";

const strict = process.argv.includes("--strict");
const fixtureRoot = path.resolve(
  process.env.MANGAI_QUALITY_BENCHMARK_ROOT ?? "tests/fixtures/manga-quality/v2.1",
);
const splitRoots = {
  dev: path.join(fixtureRoot, "dev"),
  holdout: path.join(fixtureRoot, "holdout-private"),
};
const forbiddenPngMetadata = /prompt|workflow|comment|parameters|negative prompt|seed|sampler/i;

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`))
    throw new Error("benchmark_path_outside_package");
  return resolved;
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
      if (forbiddenPngMetadata.test(content))
        throw new Error("benchmark_png_contains_generation_metadata");
    }
    offset = end;
    if (type === "IEND") break;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadPackage(root, expectedSplit) {
  const manifest = qualityBenchmarkManifestSchema.parse(
    await readJson(path.join(root, "manifest.json")),
  );
  const cases = qualityBenchmarkCasesSchema.parse(
    await readJson(path.join(root, "cases.json")),
  );
  const privateLabels = qualityBenchmarkPrivateLabelsSchema.parse(
    await readJson(path.join(root, "labels.private.json")),
  );
  if (manifest.split !== expectedSplit)
    throw new Error(`benchmark_split_mismatch:${expectedSplit}`);

  const imageById = new Map(manifest.images.map((image) => [image.id, image]));
  const profileById = new Map(manifest.image_profiles.map((profile) => [profile.id, profile]));
  for (const benchmarkCase of cases) {
    const image = imageById.get(benchmarkCase.id);
    if (!image || image.file !== benchmarkCase.file || image.image_profile_id !== benchmarkCase.image_profile_id)
      throw new Error(`benchmark_case_manifest_mismatch:${benchmarkCase.id}`);
    const bytes = await readFile(resolveInside(root, image.file));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== image.sha256)
      throw new Error(`benchmark_image_hash_mismatch:${image.id}`);
    inspectPngTextChunks(bytes);
    const metadata = await sharp(bytes).metadata();
    const profile = profileById.get(image.image_profile_id);
    if (!profile || metadata.width !== profile.width || metadata.height !== profile.height)
      throw new Error(`benchmark_image_profile_mismatch:${image.id}`);
    const intended = qualityBenchmarkIntendedSchema.parse(
      await readJson(resolveInside(root, benchmarkCase.intended)),
    );
    const caseReferences = [...benchmarkCase.refs].sort();
    const boundReferences = intended.referenceBindings.map((binding) => binding.file).sort();
    if (JSON.stringify(caseReferences) !== JSON.stringify(boundReferences))
      throw new Error(`benchmark_reference_binding_mismatch:${benchmarkCase.id}`);
    for (const reference of benchmarkCase.refs)
      await access(resolveInside(root, reference));
  }
  const actualImages = (await readdir(path.join(root, "images")))
    .filter((entry) => entry.toLowerCase().endsWith(".png"))
    .map((entry) => `images/${entry}`)
    .sort();
  const inventoryImages = manifest.images.map((image) => image.file).sort();
  if (JSON.stringify(actualImages) !== JSON.stringify(inventoryImages))
    throw new Error("benchmark_image_inventory_mismatch");
  return { manifest, cases, privateLabels };
}

function shortageResult() {
  return {
    status: "BLOCKED_FIXTURE_SHORTAGE",
    benchmarkVersion: "2.1",
    required: {
      dev: { good: 48, bad: 48, borderline: 16, total: 112 },
      holdoutPrivate: { good: 12, bad: 12, borderline: 4, total: 28 },
      combinedBadCategoryMinimum: 10,
    },
    missingRoots: Object.values(splitRoots),
    note: "v1 images are a negative control and cannot satisfy the v2.1 candidate benchmark",
  };
}

try {
  const rootsPresent = await Promise.all(
    Object.values(splitRoots).map((root) => fileExists(path.join(root, "manifest.json"))),
  );
  if (rootsPresent.some((present) => !present)) {
    process.stdout.write(`${JSON.stringify(shortageResult(), null, 2)}\n`);
    if (strict) process.exitCode = 1;
  } else {
    const dev = await loadPackage(splitRoots.dev, "dev");
    const holdout = await loadPackage(splitRoots.holdout, "holdout_private");
    const readiness = inspectQualityBenchmarkReadiness({ dev, holdout });
    const result = {
      status: readiness.ready ? "READY" : "BLOCKED_FIXTURE_CONTRACT",
      benchmarkVersion: "2.1",
      dev: readiness.dev,
      holdout: readiness.holdout,
      categoryCounts: readiness.categoryCounts,
      missingCategoryCases: readiness.missingCategoryCases,
      noCrossSplitDuplicates: readiness.noCrossSplitDuplicates,
      labelsPrivate: readiness.labelsPrivate,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (strict && !readiness.ready) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `manga quality benchmark fixture is invalid: ${error instanceof Error ? error.message : "unknown_error"}\n`,
  );
  process.exitCode = 1;
}

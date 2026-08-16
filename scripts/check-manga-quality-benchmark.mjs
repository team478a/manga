import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { qualityBenchmarkManifestSchema, inspectQualityBenchmarkReadiness } from "../src/modules/manga-quality/domain/quality-benchmark-fixture.ts";

const strict = process.argv.includes("--strict");
const fixtureDirectory = path.resolve("tests/fixtures/manga-quality");
const manifestPath = path.join(fixtureDirectory, "manifest.json");

async function validateAsset(asset) {
  const assetPath = path.resolve(fixtureDirectory, asset.path);
  if (!assetPath.startsWith(`${fixtureDirectory}${path.sep}`))
    throw new Error("fixture_asset_outside_private_directory");
  const bytes = await readFile(assetPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) throw new Error("fixture_asset_hash_mismatch");
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== asset.width || metadata.height !== asset.height)
    throw new Error("fixture_asset_dimensions_mismatch");
  const mimeType = metadata.format === "jpg" ? "image/jpeg" : `image/${metadata.format}`;
  if (mimeType !== asset.mimeType) throw new Error("fixture_asset_mime_mismatch");
}

try {
  const manifest = qualityBenchmarkManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  for (const fixture of manifest.fixtures) await validateAsset(fixture.asset);
  const readiness = inspectQualityBenchmarkReadiness(manifest);
  const result = {
    status: readiness.ready ? "READY" : "BLOCKED_FIXTURE_SHORTAGE",
    datasetId: manifest.datasetId,
    fixtureCount: readiness.fixtureCount,
    adoptableCount: readiness.adoptableCount,
    categoryCounts: readiness.categoryCounts,
    missingTotalCases: readiness.missingTotalCases,
    missingAdoptableCases: readiness.missingAdoptableCases,
    missingCategoryCases: readiness.missingCategoryCases,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (strict && !readiness.ready) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`manga quality benchmark fixture is invalid: ${error instanceof Error ? error.message : "unknown_error"}\n`);
  process.exitCode = 1;
}

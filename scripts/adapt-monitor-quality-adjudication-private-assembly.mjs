import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adaptMonitorQualityReviewToPrivateAssembly,
} from "../src/modules/manga-quality/domain/monitor-quality-review-private-assembly.ts";
import { QUALITY_BENCHMARK_ROOT_ENV } from "../src/modules/manga-quality/domain/quality-benchmark-assembly.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const ignoredFixtureRoot = path.join(repositoryRoot, "tests", "fixtures", "manga-quality", "v2.1");
const rootIndex = process.argv.indexOf("--root");
const sourceIndex = process.argv.indexOf("--source");
const outputIndex = process.argv.indexOf("--output");
const rootValue = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.env[QUALITY_BENCHMARK_ROOT_ENV];
const sourceValue = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : undefined;
const outputValue = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
const forbiddenPrivateValue = /https?:\/\/|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32}|(?:^|[^a-z])sk-(?:proj-)?[a-z0-9_-]{8,}|(?:token|signature|signed_url|x-amz-signature)\s*[:=]/i;

function resolveInside(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath))
    throw new Error("monitor_adjudication_adapter_path_must_be_relative");
  const resolved = path.resolve(root, relativePath);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`))
    throw new Error("monitor_adjudication_adapter_path_outside_private_root");
  return resolved;
}

function assertSafeRoot(root) {
  if (root === repositoryRoot)
    throw new Error("monitor_adjudication_adapter_root_cannot_be_repository_root");
  const relative = path.relative(repositoryRoot, root);
  if (!relative.startsWith("..") && root !== ignoredFixtureRoot)
    throw new Error("monitor_adjudication_adapter_repo_root_must_use_ignored_fixture");
}

try {
  if (!rootValue || !sourceValue || !outputValue)
    throw new Error("monitor_adjudication_adapter_requires_root_source_output");
  const privateRoot = path.resolve(rootValue);
  assertSafeRoot(privateRoot);
  const sourcePath = resolveInside(privateRoot, sourceValue);
  const outputPath = resolveInside(privateRoot, outputValue);
  if (sourcePath === outputPath)
    throw new Error("monitor_adjudication_adapter_source_output_must_differ");
  if (path.basename(outputPath).toLowerCase() === "reviews.private.json")
    throw new Error("monitor_adjudication_adapter_cannot_write_canonical_ledger");

  const sourceText = await readFile(sourcePath, "utf8");
  if (forbiddenPrivateValue.test(sourceText))
    throw new Error("monitor_adjudication_adapter_private_value_forbidden");
  const output = adaptMonitorQualityReviewToPrivateAssembly(JSON.parse(sourceText));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    status: "PRIVATE_ADAPTER_OUTPUT_WRITTEN",
    recordCount: output.records.length,
    pilotOnly: true,
    formalBenchmarkEligible: false,
    automaticImport: false,
    productionChanged: false,
  }, null, 2)}\n`);
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const message = code === "EEXIST"
    ? "monitor_adjudication_adapter_output_exists_no_overwrite"
    : error instanceof Error ? error.message : "unknown_error";
  process.stderr.write(`monitor adjudication private assembly adapter failed: ${message}\n`);
  process.exitCode = 1;
}

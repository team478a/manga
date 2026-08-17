import { createHash, randomInt } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import {
  HUMAN_REVIEW_PACKAGE_VERSION,
  HUMAN_REVIEW_TEMPLATE_VERSION,
  MOBILE_OFFLINE_REVIEW_UI_VERSION,
  allowedDefectCategoriesForCase,
  humanReviewPackageManifestSchema,
  humanReviewPackageSourceSchema,
  humanReviewPackageSourceSidecarSchema,
  humanReviewResponseTemplateSchema,
} from "../src/modules/manga-quality/domain/human-review-package.ts";
import { buildMangaQualityMobileReviewHtml } from "./lib/build-manga-quality-mobile-review-html.mjs";
import { panelSpecificationSchema } from "../src/modules/manga-quality/domain/panel-specification.ts";
import { qualityBenchmarkIntendedSchema } from "../src/modules/manga-quality/domain/quality-benchmark-fixture.ts";
import { QUALITY_BENCHMARK_ROOT_ENV } from "../src/modules/manga-quality/domain/quality-benchmark-assembly.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const defaultRoot = path.join(repositoryRoot, "tests", "fixtures", "manga-quality", "v2.1");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const option = (name) => argument(name) ?? process.env[`npm_config_${name.slice(2).replaceAll("-", "_")}`];
const positional = process.argv.slice(2).filter((value, index, values) => !value.startsWith("--") && !values[index - 1]?.startsWith("--"));
const fixtureRoot = path.resolve(option("--root") ?? positional[0] ?? process.env[QUALITY_BENCHMARK_ROOT_ENV] ?? defaultRoot);
const sourcePath = path.resolve(option("--source") ?? positional[1] ?? path.join(fixtureRoot, "assembly", "review-package.private.json"));
const slot = option("--slot") ?? positional[2];
if (slot !== "reviewer_a" && slot !== "reviewer_b") throw new Error("review_package_slot_required");
const outputPath = path.resolve(option("--output") ?? positional[3] ?? path.join(fixtureRoot, "human-review-packages", `${slot}-r4-3a4.zip`));
const sourceSidecarPath = outputPath.replace(/\.zip$/i, ".source-metadata.private.json");
const forbiddenPrivateValue = /https?:\/\/|(?:^|[^a-z])sk-(?:proj-)?[a-z0-9_-]{8,}|(?:token|signature|signed_url|x-amz-signature)\s*[:=]/i;

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("review_package_path_outside_private_root");
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function inspectPngChunks(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return new Set();
  const chunkTypes = new Set();
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    chunkTypes.add(type);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("review_package_png_chunk_invalid");
    if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(type))
      throw new Error("review_package_image_metadata_forbidden");
    offset = end;
    if (type === "IEND") break;
  }
  return chunkTypes;
}

async function inspectImage(bytes, label, requiredProvenanceChunks = []) {
  const chunkTypes = inspectPngChunks(bytes);
  for (const required of requiredProvenanceChunks)
    if (!chunkTypes.has(required))
      throw new Error(`review_package_required_provenance_missing:${label}:${required}`);
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error(`review_package_image_format_forbidden:${label}`);
  if (metadata.exif || metadata.xmp || metadata.iptc) throw new Error(`review_package_image_metadata_forbidden:${label}`);
  await image.clone().raw().toBuffer();
  return metadata.format === "jpeg" ? "jpg" : metadata.format;
}

function neutralUuid(seed) {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sanitizePanelSpecification(input, caseId, references) {
  const wrapper = qualityBenchmarkIntendedSchema.safeParse(input);
  const direct = panelSpecificationSchema.safeParse(input);
  if (!wrapper.success && !direct.success) throw new Error(`review_package_intended_invalid:${caseId}`);
  const specification = structuredClone(wrapper.success ? wrapper.data.panelSpecification : direct.data);
  specification.panelId = neutralUuid(`${caseId}:panel`);
  specification.characterIdentities = specification.characterIdentities.map((identity, identityIndex) => ({
    ...identity,
    characterId: neutralUuid(`${caseId}:character:${identityIndex}`),
    identityReferenceImages: [],
    expressionReferenceImages: [],
    fullBodyReferenceImages: [],
  }));
  for (const reference of references.filter((item) => item.role.startsWith("character_"))) {
    const identity = specification.characterIdentities[reference.character_index];
    if (!identity) throw new Error(`review_package_character_reference_target_missing:${caseId}:${reference.reference_id}`);
    const bindingId = neutralUuid(`${caseId}:reference:${reference.reference_id}`);
    if (reference.role === "character_identity") identity.identityReferenceImages.push(bindingId);
    if (reference.role === "character_expression") identity.expressionReferenceImages.push(bindingId);
    if (reference.role === "character_full_body") identity.fullBodyReferenceImages.push(bindingId);
  }
  return panelSpecificationSchema.parse(specification);
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function readme(scope) {
  return `# MANGAI Candidate Visual Benchmark 人間レビュー\n\n` +
    `このパッケージは\`${scope}\`です。Reviewer A/Bは互いの回答、正解ラベル、AI監査を見ずに独立評価してください。\n\n` +
    `スマートフォンまたはブラウザでは、ZIPを展開して\`review.html\`を開きます。外部通信は行わず、回答JSONを端末へ保存できます。手作業でJSONを記入する場合は次の手順に従います。\n\n` +
    `## 判定手順\n\n` +
    `1. \`review-order.txt\`の順に各\`candidate\`を確認します。\n` +
    `2. 各caseの\`review_mode\`と\`allowed_defect_categories\`だけを使用します。\n` +
    `3. \`intrinsic_only\`は画像単体だけで判定し、人物同一性、指定構図、背景、propを推測しません。\n` +
    `4. \`referential\`は\`intended.json\`と\`references/\`を比較して判定します。\n` +
    `5. \`review-response.private.json\`を同じschemaのまま記入します。\n\n` +
    `## 画像内文字\n\n` +
    `Panel Specificationが物語上必要な環境文字を明示していない限り、生成された可読文字、疑似文字、ページ番号、SAMPLE、UI、ロゴ、操作パネルは欠陥です。\n\n` +
    `## verdict\n\n` +
    `- good: defectsは空\n` +
    `- bad: defectsが1件以上\n` +
    `- borderline: defectまたはoverall_commentが必要\n\n` +
    `bboxは左上原点の\`[x, y, width, height]\`正規化座標です。画像全体の問題はnullにできます。未記入のtemplateはレビュー完了ではありません。\n`;
}

async function main() {
  if (fixtureRoot === repositoryRoot) throw new Error("review_package_root_cannot_be_repository_root");
  if (!outputPath.toLowerCase().endsWith(".zip")) throw new Error("review_package_output_must_be_zip");
  if (await exists(outputPath) || await exists(sourceSidecarPath)) throw new Error("review_package_output_exists_no_overwrite");
  const sourceText = await readFile(sourcePath, "utf8");
  if (forbiddenPrivateValue.test(sourceText)) throw new Error("review_package_source_contains_forbidden_private_value");
  const source = humanReviewPackageSourceSchema.parse(JSON.parse(sourceText));
  const zip = new JSZip();
  const cases = [];
  const intendedByCase = {};
  for (const item of source.cases) {
    const candidateBytes = await readFile(resolveInside(fixtureRoot, item.candidate_file));
    const candidateExtension = await inspectImage(candidateBytes, item.review_case_id, item.required_provenance_chunks);
    const candidateFile = `cases/${item.review_case_id}/candidate.${candidateExtension}`;
    zip.file(candidateFile, candidateBytes);
    let intendedFile = null;
    let intendedSha256 = null;
    if (item.review_mode === "referential") {
      const rawIntended = JSON.parse(await readFile(resolveInside(fixtureRoot, item.intended_file), "utf8"));
      const intended = sanitizePanelSpecification(rawIntended, item.review_case_id, item.references);
      const intendedBytes = Buffer.from(`${JSON.stringify(intended, null, 2)}\n`, "utf8");
      intendedFile = `cases/${item.review_case_id}/intended.json`;
      intendedSha256 = sha256(intendedBytes);
      zip.file(intendedFile, intendedBytes);
      intendedByCase[item.review_case_id] = intended;
    }
    const references = [];
    for (const [index, reference] of item.references.entries()) {
      const bytes = await readFile(resolveInside(fixtureRoot, reference.file));
      const extension = await inspectImage(bytes, `${item.review_case_id}:${reference.reference_id}`);
      const file = `cases/${item.review_case_id}/references/${reference.reference_id}.${extension}`;
      zip.file(file, bytes);
      references.push({
        reference_id: reference.reference_id,
        role: reference.role,
        binding_id: reference.role.startsWith("character_")
          ? neutralUuid(`${item.review_case_id}:reference:${reference.reference_id}`)
          : null,
        file,
        sha256: sha256(bytes),
      });
    }
    cases.push({
      case_id: item.review_case_id,
      review_mode: item.review_mode,
      candidate_file: candidateFile,
      candidate_sha256: sha256(candidateBytes),
      intended_file: intendedFile,
      intended_sha256: intendedSha256,
      references,
      allowed_defect_categories: allowedDefectCategoriesForCase({
        reviewMode: item.review_mode,
        referenceRoles: item.references.map((reference) => reference.role),
      }),
    });
  }
  const manifest = humanReviewPackageManifestSchema.parse({
    package_version: HUMAN_REVIEW_PACKAGE_VERSION,
    benchmark_version: "2.1",
    package_id: source.package_id,
    slot,
    package_status: source.review_scope === "PILOT_INTRINSIC_ONLY" ? "PILOT_PACKAGE_STRUCTURE_READY" : "FORMAL_REVIEW_READY",
    review_scope: source.review_scope,
    formal_benchmark_eligible: source.formal_benchmark_eligible,
    review_ui: {
      version: MOBILE_OFFLINE_REVIEW_UI_VERSION,
      entry_file: "review.html",
      network_access: false,
    },
    case_count: cases.length,
    cases,
  });
  const order = shuffled(cases.map((item) => item.case_id));
  const responseTemplate = humanReviewResponseTemplateSchema.parse({
    template_version: HUMAN_REVIEW_TEMPLATE_VERSION,
    slot,
    reviewer_id: "",
    reviewer_kind: "human",
    independent: true,
    reviewed_at: "",
    records: order.map((caseId) => ({ case_id: caseId, verdict: null, confidence: null, defects: [], overall_comment: "" })),
  });
  zip.file("README_JA.md", readme(source.review_scope));
  zip.file("package-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  zip.file("review-order.txt", `${order.join("\n")}\n`);
  zip.file("review-response.private.json", `${JSON.stringify(responseTemplate, null, 2)}\n`);
  zip.file("review.html", buildMangaQualityMobileReviewHtml({
    manifest,
    template: responseTemplate,
    order,
    intended: intendedByCase,
  }));
  const packageBytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, packageBytes, { flag: "wx" });
  const sidecar = humanReviewPackageSourceSidecarSchema.parse({
    source_version: 1,
    package_id: source.package_id,
    package_sha256: sha256(packageBytes),
    review_scope: source.review_scope,
    formal_benchmark_eligible: source.formal_benchmark_eligible,
    formal_benchmark_status: source.formal_benchmark_eligible ? "AWAITING_DUAL_HUMAN_REVIEW" : "NOT_COUNTED_IN_FORMAL_BENCHMARK",
    cases: source.cases.map((item) => ({
      case_id: item.review_case_id,
      source_case_id: item.source_case_id,
      required_provenance_chunks: item.required_provenance_chunks,
      source_group_id: item.source_group_id,
      source_family: item.source_family,
      character_group_id: item.character_group_id,
      reference_group_id: item.reference_group_id,
      target_split: item.target_split,
    })),
  });
  await writeFile(sourceSidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    status: "REVIEW_PACKAGE_CREATED",
    package: outputPath,
    sourceMetadata: sourceSidecarPath,
    slot,
    cases: cases.length,
    reviewScope: source.review_scope,
    formalBenchmarkEligible: source.formal_benchmark_eligible,
    productionChanged: false,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`manga quality review package build failed: ${error instanceof Error ? error.message : "unknown_error"}\n`);
  process.exitCode = 1;
});

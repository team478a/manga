import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { MangaiDatabase } from "../database.js";
import type {
  DezgoGenerationMetadata,
  DezgoTextToImageRequest,
  DezgoTextToImageResult,
} from "./providers/dezgo.js";

export type DezgoImagePipelineStore = Pick<
  MangaiDatabase,
  | "bundle"
  | "deleteAsset"
  | "getGenerationJob"
  | "recordCreatedAssetsHistory"
  | "registerGeneratedAsset"
  | "saveAssetLibraryMetadata"
  | "updateGenerationJob"
>;

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;
const MAX_DIMENSION = 4096;

export async function sanitizeDezgoImage(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > MAX_INPUT_BYTES)
    throw new Error("Dezgo生成画像のサイズが不正です。");
  const image = sharp(bytes, {
    failOn: "warning",
    limitInputPixels: MAX_INPUT_PIXELS,
    animated: false,
  });
  const metadata = await image.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_DIMENSION ||
    metadata.height > MAX_DIMENSION ||
    (metadata.pages ?? 1) !== 1 ||
    !["png", "jpeg", "webp"].includes(metadata.format ?? "")
  )
    throw new Error("Dezgo生成画像の形式または寸法が不正です。");
  const output = await image.rotate().png({ compressionLevel: 9 }).toBuffer();
  const sanitizedMetadata = await sharp(output).metadata();
  if (!sanitizedMetadata.width || !sanitizedMetadata.height)
    throw new Error("Dezgo生成画像を検証できませんでした。");
  return {
    bytes: new Uint8Array(output),
    width: sanitizedMetadata.width,
    height: sanitizedMetadata.height,
    mimeType: "image/png" as const,
  };
}

export type PersistDezgoGenerationInput = {
  jobId: string;
  projectId: string;
  request: DezgoTextToImageRequest;
  result: DezgoTextToImageResult;
  durationMs: number;
  accountedCostUsd?: number;
  billingAmountSource?: "provider_header" | "authorization_ceiling";
  jobType?: "background" | "prop" | "effect";
  libraryTags?: string[];
};

export async function persistDezgoGenerationResult(
  store: DezgoImagePipelineStore,
  input: PersistDezgoGenerationInput,
) {
  if (input.result.images.length !== 1)
    throw new Error("Dezgo Phase 1では生成画像を1枚だけ受け付けます。");
  const job = store.getGenerationJob(input.jobId) as
    { project_id?: unknown } | undefined;
  if (!job || job.project_id !== input.projectId)
    throw new Error("Dezgo生成ジョブとProjectの参照が一致しません。");

  const image = input.result.images[0];
  const sanitized = await sanitizeDezgoImage(image.bytes);
  const project = store.bundle(input.projectId).project;
  const directory = path.join(
    project.storagePath,
    "generated",
    "dezgo",
    input.jobId,
  );
  const file = path.join(directory, "output.png");
  const metadata: DezgoGenerationMetadata & Record<string, unknown> = {
    ...input.result.metadata,
    provider: "dezgo",
    endpoint: "/text2image",
    model: input.request.model,
    width: sanitized.width,
    height: sanitized.height,
    requestedWidth: input.request.width,
    requestedHeight: input.request.height,
    guidance: input.request.guidance,
    steps: input.request.steps,
    sampler: input.request.sampler,
    requestedSeed: input.request.seed,
    responseSeed: input.result.metadata.seed,
    outputFormat: "png",
    originalMimeType: image.mimeType,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    accountedCostUsd: input.accountedCostUsd,
    billingAmountSource: input.billingAmountSource,
    jobType: input.jobType,
    libraryTags: input.libraryTags ?? [],
    createdAt: new Date().toISOString(),
  };
  let createdAssetId: string | null = null;
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, sanitized.bytes);
    const registered = store.registerGeneratedAsset(
      input.projectId,
      path.relative(project.storagePath, file),
      input.jobId,
      metadata,
    );
    if (registered.created) {
      createdAssetId = registered.assetId;
      if (input.jobType)
        store.saveAssetLibraryMetadata({
          assetId: registered.assetId,
          category: input.jobType,
          tags: input.libraryTags ?? [],
          favorite: false,
        });
      store.recordCreatedAssetsHistory(input.projectId, "Dezgo生成素材を追加", [
        registered.assetId,
      ]);
    }
    store.updateGenerationJob(input.jobId, "completed", {
      providerJobId: input.result.providerJobId,
      output: {
        assetId: registered.assetId,
        ...metadata,
      },
    });
    return {
      bundle: store.bundle(input.projectId),
      assetId: registered.assetId,
      metadata,
    };
  } catch (error) {
    if (createdAssetId)
      try {
        store.deleteAsset(createdAssetId);
      } catch {
        // Preserve the original pipeline error.
      }
    try {
      fs.rmSync(directory, { recursive: true, force: true });
    } catch {
      // Preserve the original pipeline error.
    }
    throw error;
  }
}

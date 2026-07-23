import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCloudAssetSignedUrl,
  listCloudAssets,
  uploadCloudAsset,
} from "@/lib/cloud-creator-server";
import {
  CloudAssetPayloadTooLargeError,
  cloudAssetUploadErrorStatus,
  declaredCloudAssetUploadTooLarge,
  parseCloudAssetUploadForm,
} from "@/lib/cloud-asset-upload";
import { CloudAssetBytesTooLargeError } from "@/lib/cloud-creator-contract";
import { enforceCloudAssetUploadRateLimit } from "@/lib/cloud-ai-rate-limit";
import { getCurrentProfile } from "@/lib/auth";

const uuidSchema = z.string().uuid();
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const projectId = search.get("projectId");
    if (projectId)
      return NextResponse.json(
        await listCloudAssets(uuidSchema.parse(projectId)),
      );
    const assetId = uuidSchema.parse(search.get("id"));
    return NextResponse.json({ url: await createCloudAssetSignedUrl(assetId) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Assetを取得できません。",
      },
      { status: 404 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (declaredCloudAssetUploadTooLarge(request))
      throw new CloudAssetPayloadTooLargeError();
    const { user, profile } = await getCurrentProfile();
    if (!user)
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    if (!profile)
      return NextResponse.json(
        { error: "プロフィールが必要です。" },
        { status: 403 },
      );
    const rateLimit = await enforceCloudAssetUploadRateLimit(request, user.id);
    if (!rateLimit.allowed)
      return NextResponse.json(
        { error: "画像Uploadが集中しています。1分後に再試行してください。" },
        {
          status: 429,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    const formData = await parseCloudAssetUploadForm(request);
    const projectId = uuidSchema.parse(formData.get("projectId"));
    const rawAssetId = formData.get("assetId");
    const rawExpectedSha256 = formData.get("expectedSha256");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("画像ファイルが必要です。");
    const asset = await uploadCloudAsset({
      projectId,
      assetId: rawAssetId ? uuidSchema.parse(rawAssetId) : undefined,
      expectedSha256: rawExpectedSha256
        ? sha256Schema.parse(rawExpectedSha256)
        : undefined,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    const normalizedError =
      error instanceof CloudAssetBytesTooLargeError
        ? new CloudAssetPayloadTooLargeError()
        : error;
    return NextResponse.json(
      {
        error:
          normalizedError instanceof Error
            ? normalizedError.message
            : "Uploadに失敗しました。",
      },
      { status: cloudAssetUploadErrorStatus(normalizedError) },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCloudAssetSignedUrl,
  listCloudAssets,
  uploadCloudAsset,
} from "@/lib/cloud-creator-server";
import {
  CloudAssetPayloadTooLargeError,
  declaredCloudAssetUploadTooLarge,
  parseCloudAssetUploadForm,
} from "@/lib/cloud-asset-upload";
import { enforceCloudAssetUploadRateLimit } from "@/lib/cloud-ai-rate-limit";
import { getCurrentProfile } from "@/lib/auth";
import { toApiError } from "@/lib/api-errors";
import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  RateLimitedError,
  ValidationError,
} from "@/lib/domain-errors";
import { actionIdSchema } from "@/lib/action-contracts";

const uuidSchema = actionIdSchema;
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
    const response = toApiError(error, "Assetを取得できません。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    if (declaredCloudAssetUploadTooLarge(request))
      throw new CloudAssetPayloadTooLargeError();
    const { user, profile } = await getCurrentProfile();
    if (!user) throw new AuthenticationRequiredError();
    if (!profile) throw new PermissionDeniedError("プロフィールが必要です。");
    const rateLimit = await enforceCloudAssetUploadRateLimit(request, user.id);
    if (!rateLimit.allowed) {
      const error = new RateLimitedError(
        "画像Uploadが集中しています。1分後に再試行してください。",
      );
      const response = toApiError(error, "Uploadに失敗しました。");
      return NextResponse.json(response.body, {
        status: response.status,
        headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
      });
    }
    const formData = await parseCloudAssetUploadForm(request);
    const projectId = uuidSchema.parse(formData.get("projectId"));
    const rawAssetId = formData.get("assetId");
    const rawExpectedSha256 = formData.get("expectedSha256");
    const file = formData.get("file");
    if (!(file instanceof File))
      throw new ValidationError("画像ファイルが必要です。");
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
    const response = toApiError(error, "Uploadに失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

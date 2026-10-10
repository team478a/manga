import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "@/lib/api-errors";
import {
  EXTERNAL_SUBMISSION_UPLOAD_MAX_REQUEST_BYTES,
  uploadExternalSubmissionSource,
} from "@/lib/external-submission-upload";
import { PayloadTooLargeError, ValidationError } from "@/lib/domain-errors";
import { readCloudAssetUploadBody } from "@/lib/cloud-asset-upload";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  try {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > EXTERNAL_SUBMISSION_UPLOAD_MAX_REQUEST_BYTES)
      throw new PayloadTooLargeError("Uploadは50MB以下にしてください。");
    const { submissionId } = await context.params;
    z.string().uuid().parse(submissionId);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
      throw new ValidationError("multipart/form-data形式が必要です。");
    const body = await readCloudAssetUploadBody(
      request,
      EXTERNAL_SUBMISSION_UPLOAD_MAX_REQUEST_BYTES,
    );
    const data = await new Response(body, {
      headers: { "content-type": contentType },
    }).formData();
    const file = data.get("file");
    if (!(file instanceof File)) throw new ValidationError("ファイルが必要です。");
    return NextResponse.json(
      await uploadExternalSubmissionSource({ submissionId, file }),
      { status: 201 },
    );
  } catch (error) {
    const response = toApiError(error, "Uploadに失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextResponse } from "next/server";
import { setCloudProjectDeleted } from "@/lib/cloud-creator-server";
import { toApiError } from "@/lib/api-errors";
import { ValidationError } from "@/lib/domain-errors";
import { z } from "zod";

const uuidSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const projectId = uuidSchema.parse((await context.params).projectId);
    return NextResponse.json({
      projectId: await setCloudProjectDeleted(projectId, true),
    });
  } catch (error) {
    const response = toApiError(error, "削除に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const body = (await request.json()) as { action?: unknown };
    if (body.action !== "restore")
      throw new ValidationError("未対応の操作です。");
    const projectId = uuidSchema.parse((await context.params).projectId);
    return NextResponse.json({
      projectId: await setCloudProjectDeleted(projectId, false),
    });
  } catch (error) {
    const response = toApiError(error, "復元に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

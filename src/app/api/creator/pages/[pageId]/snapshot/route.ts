import { NextResponse } from "next/server";
import { z } from "zod";
import { pageCanvasSchema } from "@mangai/canvas-core";
import {
  getCloudPageSnapshot,
  saveCloudPageSnapshot,
} from "@/lib/cloud-creator-server";
import { CLOUD_CANVAS_MAX_BYTES } from "@/lib/cloud-creator-contract";
import { toApiError } from "@/lib/api-errors";
import { ValidationError } from "@/lib/domain-errors";

const saveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  canvas: pageCanvasSchema,
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    return NextResponse.json(
      await getCloudPageSnapshot((await context.params).pageId),
    );
  } catch (error) {
    const response = toApiError(error, "読込に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > CLOUD_CANVAS_MAX_BYTES)
      throw new ValidationError("Canvas snapshotは2MB以下にしてください。");
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > CLOUD_CANVAS_MAX_BYTES)
      throw new ValidationError("Canvas snapshotは2MB以下にしてください。");
    const input = saveSchema.parse(JSON.parse(body));
    const pageId = (await context.params).pageId;
    if (input.canvas.pageId !== pageId)
      throw new ValidationError("Canvasと保存先Pageが一致しません。");
    const data = await saveCloudPageSnapshot({
      pageId,
      ...input,
    });
    return NextResponse.json(data[0]);
  } catch (error) {
    const response = toApiError(error, "保存に失敗しました。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

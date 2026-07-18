import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCloudPageSnapshot,
  saveCloudPageSnapshot,
} from "@/lib/cloud-creator-server";
import { CLOUD_CANVAS_MAX_BYTES } from "@/lib/cloud-creator-contract";

const saveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  canvas: z.record(z.string(), z.unknown()),
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "読込に失敗しました。",
      },
      { status: 404 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > CLOUD_CANVAS_MAX_BYTES)
      throw new Error("Canvas snapshotは2MB以下にしてください。");
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > CLOUD_CANVAS_MAX_BYTES)
      throw new Error("Canvas snapshotは2MB以下にしてください。");
    const input = saveSchema.parse(JSON.parse(body));
    const data = await saveCloudPageSnapshot({
      pageId: (await context.params).pageId,
      ...input,
    });
    return NextResponse.json(data[0]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "保存に失敗しました。";
    return NextResponse.json(
      { error: message },
      { status: message.includes("競合") ? 409 : 400 },
    );
  }
}

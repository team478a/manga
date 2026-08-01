import { NextResponse } from "next/server";
import { z } from "zod";
import { acquireCloudPageEditLock, releaseCloudPageEditLock } from "@/modules/cloud-creator/canvas/page-lock-service";
import { toApiError } from "@/lib/api-errors";

const bodySchema = z.object({ lockToken: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ pageId: string }> }) {
  try {
    const pageId = z.string().uuid().parse((await context.params).pageId);
    const body = bodySchema.parse(await request.json());
    const leaseExpiresAt = await acquireCloudPageEditLock(pageId, body.lockToken);
    return NextResponse.json({ available: leaseExpiresAt !== null, leaseExpiresAt });
  } catch (error) {
    const response = toApiError(error, "ページの編集状態を確認できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ pageId: string }> }) {
  try {
    const pageId = z.string().uuid().parse((await context.params).pageId);
    const body = bodySchema.parse(await request.json());
    return NextResponse.json({ released: await releaseCloudPageEditLock(pageId, body.lockToken) });
  } catch (error) {
    const response = toApiError(error, "ページの編集状態を解除できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

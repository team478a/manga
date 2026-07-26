import { NextResponse } from "next/server";
import { z } from "zod";
import { toApiError } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import {
  attachHubRequestId,
  createHubRequestContext,
  logHubError,
  logHubEvent,
} from "@/lib/hub-logger";
import { createPurchaseDownloadUrl } from "@/lib/purchases";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const logContext = createHubRequestContext(request);
  const { profile } = await requireProfile();
  try {
    const parsedOrderId = z.string().uuid().safeParse((await params).orderId);
    if (!parsedOrderId.success)
      throw new ResourceNotFoundError("注文が見つかりません。");
    const signedUrl = await createPurchaseDownloadUrl({
      orderId: parsedOrderId.data,
      buyerProfileId: profile.id,
    });
    logHubEvent("info", "purchase_download_issued", {
      ...logContext,
      orderId: parsedOrderId.data,
      profileId: profile.id,
    });
    return attachHubRequestId(
      NextResponse.redirect(signedUrl, 303),
      logContext,
    );
  } catch (error) {
    logHubError("purchase_download_failed", error, logContext);
    const response = toApiError(
      error,
      "購入済みファイルを準備できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}

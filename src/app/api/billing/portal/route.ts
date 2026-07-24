import { NextResponse } from "next/server";
import { createCloudBillingPortal } from "@/lib/cloud-subscriptions";
import { safeDomainErrorMessage } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    return NextResponse.redirect(await createCloudBillingPortal(request), 303);
  } catch (error) {
    const url = new URL("/dashboard/billing", request.url);
    url.searchParams.set(
      "error",
      safeDomainErrorMessage(error, "請求画面を開けませんでした。"),
    );
    return NextResponse.redirect(url, 303);
  }
}

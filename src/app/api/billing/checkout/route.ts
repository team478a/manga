import { NextResponse } from "next/server";
import { createCloudSubscriptionCheckout } from "@/lib/cloud-subscriptions";
import { safeDomainErrorMessage } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    return NextResponse.redirect(
      await createCloudSubscriptionCheckout(request),
      303,
    );
  } catch (error) {
    const url = new URL("/dashboard/billing", request.url);
    url.searchParams.set(
      "error",
      safeDomainErrorMessage(error, "申込みを開始できませんでした。"),
    );
    return NextResponse.redirect(url, 303);
  }
}

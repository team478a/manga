import { NextResponse } from "next/server";
import { createCloudSubscriptionCheckout } from "@/lib/cloud-subscriptions";

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
      error instanceof Error ? error.message : "申込みを開始できませんでした。",
    );
    return NextResponse.redirect(url, 303);
  }
}

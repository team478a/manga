import { NextResponse } from "next/server";
import { createCloudBillingPortal } from "@/lib/cloud-subscriptions";

export async function POST(request: Request) {
  try {
    return NextResponse.redirect(await createCloudBillingPortal(request), 303);
  } catch (error) {
    const url = new URL("/dashboard/billing", request.url);
    url.searchParams.set(
      "error",
      error instanceof Error ? error.message : "請求画面を開けませんでした。",
    );
    return NextResponse.redirect(url, 303);
  }
}

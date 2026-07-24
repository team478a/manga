import { NextResponse } from "next/server";
import { getMyCloudAiQuota } from "@/lib/cloud-creator-server";
import { toApiError } from "@/lib/api-errors";

export async function GET() {
  try {
    return NextResponse.json(await getMyCloudAiQuota());
  } catch (error) {
    const response = toApiError(error, "利用枠を取得できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextResponse } from "next/server";
import { getMyCloudAiQuota } from "@/lib/cloud-creator-server";

export async function GET() {
  try {
    return NextResponse.json(await getMyCloudAiQuota());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "利用枠を取得できませんでした。",
      },
      { status: 400 },
    );
  }
}

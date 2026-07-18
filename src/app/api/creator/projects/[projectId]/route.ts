import { NextResponse } from "next/server";
import { setCloudProjectDeleted } from "@/lib/cloud-creator-server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    return NextResponse.json({
      projectId: await setCloudProjectDeleted(
        (await context.params).projectId,
        true,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "削除に失敗しました。",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const body = (await request.json()) as { action?: unknown };
    if (body.action !== "restore") throw new Error("未対応の操作です。");
    return NextResponse.json({
      projectId: await setCloudProjectDeleted(
        (await context.params).projectId,
        false,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "復元に失敗しました。",
      },
      { status: 400 },
    );
  }
}

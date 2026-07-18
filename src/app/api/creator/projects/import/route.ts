import { NextResponse } from "next/server";
import { importDesktopCloudProject } from "@/lib/cloud-creator-server";
import { CLOUD_IMPORT_MAX_BYTES } from "@/lib/cloud-creator-contract";

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > CLOUD_IMPORT_MAX_BYTES)
      throw new Error("Import manifestは10MB以下にしてください。");
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > CLOUD_IMPORT_MAX_BYTES)
      throw new Error("Import manifestは10MB以下にしてください。");
    const projectId = await importDesktopCloudProject(JSON.parse(body));
    return NextResponse.json({ projectId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Importに失敗しました。",
      },
      { status: 400 },
    );
  }
}

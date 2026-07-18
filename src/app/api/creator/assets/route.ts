import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCloudAssetSignedUrl,
  uploadCloudAsset,
} from "@/lib/cloud-creator-server";

const uuidSchema = z.string().uuid();
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export async function GET(request: Request) {
  try {
    const assetId = uuidSchema.parse(
      new URL(request.url).searchParams.get("id"),
    );
    return NextResponse.json({ url: await createCloudAssetSignedUrl(assetId) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Assetを取得できません。",
      },
      { status: 404 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const projectId = uuidSchema.parse(formData.get("projectId"));
    const rawAssetId = formData.get("assetId");
    const rawExpectedSha256 = formData.get("expectedSha256");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("画像ファイルが必要です。");
    const asset = await uploadCloudAsset({
      projectId,
      assetId: rawAssetId ? uuidSchema.parse(rawAssetId) : undefined,
      expectedSha256: rawExpectedSha256
        ? sha256Schema.parse(rawExpectedSha256)
        : undefined,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Uploadに失敗しました。",
      },
      { status: 400 },
    );
  }
}

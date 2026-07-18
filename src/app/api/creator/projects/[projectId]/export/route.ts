import { NextResponse } from "next/server";
import { z } from "zod";
import { createCloudProjectExport } from "@/lib/cloud-canvas-export";

const formatSchema = z.enum(["pdf", "images", "package"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const format = formatSchema.parse(
      new URL(request.url).searchParams.get("format"),
    );
    const projectId = z
      .string()
      .uuid()
      .parse((await context.params).projectId);
    const output = await createCloudProjectExport(projectId, format);
    const fileName = `mangai-cloud-${projectId}-${format}.${output.extension}`;
    return new Response(output.bytes, {
      headers: {
        "content-type": output.mimeType,
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Exportに失敗しました。",
      },
      { status: 400 },
    );
  }
}

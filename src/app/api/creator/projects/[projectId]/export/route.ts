import fs from "node:fs";
import { Readable } from "node:stream";
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
    const byteSize = fs.statSync(output.filePath).size;
    const input = fs.createReadStream(output.filePath);
    const cleanup = () =>
      fs.rmSync(output.cleanupPath, { recursive: true, force: true });
    input.once("close", cleanup);
    try {
      return new Response(
        Readable.toWeb(input) as ReadableStream<Uint8Array>,
        {
          headers: {
            "content-type": output.mimeType,
            "content-length": String(byteSize),
            "content-disposition": `attachment; filename="${fileName}"`,
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      input.destroy();
      cleanup();
      throw error;
    }
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

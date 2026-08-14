import {
  renderCloudPageCompletionPng,
} from "@/modules/cloud-creator/projects/page-completion-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; pageId: string }> },
) {
  const { projectId, pageId } = await params;
  try {
    const rendered = await renderCloudPageCompletionPng(projectId, pageId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(Buffer.from(rendered.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/png",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="page-${rendered.completion.pageNumber}.png"`,
        "X-Mangai-Page-Revision": String(rendered.completion.savedRevision ?? ""),
      },
    });
  } catch {
    return Response.json(
      { error: "ページ画像を表示できませんでした。" },
      { status: 422, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

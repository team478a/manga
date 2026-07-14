import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ sourceProjectId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ sourceProjectId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json(
      { linked: false, message: "公開作品は見つかりません。" },
      { status: 404 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: work, error } = await supabase
      .from("works")
      .select("id, title, updated_at")
      .eq("source_project_id", parsed.data.sourceProjectId)
      .eq("status", "published")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; title: string; updated_at: string }>();

    if (error) throw new Error(error.message);
    if (!work) {
      return NextResponse.json(
        { linked: false, message: "公開作品は見つかりません。" },
        { status: 404 },
      );
    }

    const { count, error: productError } = await supabase
      .from("digital_products")
      .select("id", { count: "exact", head: true })
      .eq("work_id", work.id)
      .eq("status", "active");
    if (productError) throw new Error(productError.message);

    return NextResponse.json({
      linked: true,
      projectId: parsed.data.sourceProjectId,
      work: {
        id: work.id,
        title: work.title,
        updatedAt: work.updated_at,
        path: `/works/${work.id}`,
      },
      sales: {
        activeProductCount: count ?? 0,
        available: (count ?? 0) > 0,
      },
    });
  } catch (cause) {
    console.error("Desktop Hub status lookup failed", cause);
    return NextResponse.json(
      { linked: false, message: "Hubの公開状況を確認できませんでした。" },
      { status: 503 },
    );
  }
}

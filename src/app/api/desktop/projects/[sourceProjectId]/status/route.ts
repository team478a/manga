import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeDesktopRequest } from "@/lib/desktop-auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ sourceProjectId: z.string().uuid() });

export async function GET(
  request: Request,
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
    if (request.headers.has("authorization")) {
      const authorization = await authorizeDesktopRequest(request);
      if (!authorization)
        return NextResponse.json(
          { message: "端末認証が無効または期限切れです。" },
          { status: 401 },
        );
      const admin = createAdminClient();
      const { data: work, error } = await admin
        .from("works")
        .select("id, title, status, is_public, updated_at")
        .eq("creator_id", authorization.profileId)
        .eq("source_project_id", parsed.data.sourceProjectId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          title: string;
          status: "draft" | "published" | "archived";
          is_public: boolean;
          updated_at: string;
        }>();
      if (error) throw new Error(error.message);
      if (!work)
        return NextResponse.json(
          {
            linked: false,
            message: "このProjectに対応するHub作品はありません。",
          },
          { status: 404 },
        );
      const { data: products, error: productError } = await admin
        .from("digital_products")
        .select("status")
        .eq("creator_id", authorization.profileId)
        .eq("work_id", work.id)
        .returns<Array<{ status: "active" | "paused" | "archived" }>>();
      if (productError) throw new Error(productError.message);
      const activeProductCount =
        products?.filter((product) => product.status === "active").length ?? 0;
      const pausedProductCount =
        products?.filter((product) => product.status === "paused").length ?? 0;
      return NextResponse.json({
        linked: true,
        projectId: parsed.data.sourceProjectId,
        authorized: true,
        work: {
          id: work.id,
          title: work.title,
          status: work.status,
          isPublic: work.is_public,
          updatedAt: work.updated_at,
          path: `/works/${work.id}`,
        },
        sales: {
          activeProductCount,
          pausedProductCount,
          available: activeProductCount > 0 && work.is_public,
        },
      });
    }

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
        status: "published",
        isPublic: true,
        updatedAt: work.updated_at,
        path: `/works/${work.id}`,
      },
      sales: {
        activeProductCount: count ?? 0,
        pausedProductCount: 0,
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

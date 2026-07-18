import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeDesktopRequest } from "@/lib/desktop-auth";
import { DESKTOP_DRAFT_WRITE_SCOPE } from "@/lib/desktop-auth";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ sourceProjectId: z.string().uuid() });
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sourceProjectId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  const input = updateSchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !input.success)
    return NextResponse.json(
      { message: "更新内容が不正です。" },
      { status: 400 },
    );

  try {
    const authorization = await authorizeDesktopRequest(
      request,
      DESKTOP_DRAFT_WRITE_SCOPE,
    );
    if (!authorization)
      return NextResponse.json(
        { message: "下書き更新の端末権限がありません。" },
        { status: 403 },
      );

    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("works")
      .select("id, status, is_public, updated_at")
      .eq("creator_id", authorization.profileId)
      .eq("source_project_id", params.data.sourceProjectId)
      .eq("content_class", "general")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        status: "draft" | "published" | "archived";
        is_public: boolean;
        updated_at: string;
      }>();
    if (currentError) throw new Error(currentError.message);
    if (!current)
      return NextResponse.json(
        { message: "対応するHub作品がありません。" },
        { status: 404 },
      );
    if (current.status !== "draft" || current.is_public)
      return NextResponse.json(
        { message: "Desktopから更新できるのは非公開下書きだけです。" },
        { status: 409 },
      );
    if (current.updated_at !== input.data.expectedUpdatedAt)
      return NextResponse.json(
        {
          message:
            "Hub側で作品が更新されています。再確認してからやり直してください。",
        },
        { status: 409 },
      );

    const { data: updated, error: updateError } = await admin
      .from("works")
      .update({
        title: input.data.title,
        description: input.data.description || null,
      })
      .eq("id", current.id)
      .eq("creator_id", authorization.profileId)
      .eq("content_class", "general")
      .eq("status", "draft")
      .eq("is_public", false)
      .eq("updated_at", input.data.expectedUpdatedAt)
      .select("id, title, description, updated_at")
      .maybeSingle<{
        id: string;
        title: string;
        description: string | null;
        updated_at: string;
      }>();
    if (updateError) throw new Error(updateError.message);
    if (!updated)
      return NextResponse.json(
        {
          message:
            "Hub側で作品が更新されています。再確認してからやり直してください。",
        },
        { status: 409 },
      );
    return NextResponse.json({
      updated: true,
      work: {
        id: updated.id,
        title: updated.title,
        description: updated.description ?? "",
        updatedAt: updated.updated_at,
      },
    });
  } catch (cause) {
    console.error("Desktop Hub draft update failed", cause);
    return NextResponse.json(
      { message: "Hub下書きを更新できませんでした。" },
      { status: 503 },
    );
  }
}

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
        .select("id, title, description, status, is_public, updated_at")
        .eq("creator_id", authorization.profileId)
        .eq("source_project_id", parsed.data.sourceProjectId)
        .eq("content_class", "general")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          title: string;
          description: string | null;
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
          description: work.description ?? "",
          status: work.status,
          isPublic: work.is_public,
          updatedAt: work.updated_at,
          path: `/works/${work.id}`,
          canWriteDraft: authorization.scopes.includes(
            DESKTOP_DRAFT_WRITE_SCOPE,
          ),
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
      .select("id, title, description, updated_at")
      .eq("source_project_id", parsed.data.sourceProjectId)
      .eq("content_class", "general")
      .eq("status", "published")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        title: string;
        description: string | null;
        updated_at: string;
      }>();

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
        description: work.description ?? "",
        status: "published",
        isPublic: true,
        updatedAt: work.updated_at,
        path: `/works/${work.id}`,
        canWriteDraft: false,
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

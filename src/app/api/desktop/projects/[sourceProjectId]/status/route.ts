import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorizeDesktopRequest } from "@/lib/desktop-auth";
import { DESKTOP_DRAFT_WRITE_SCOPE } from "@/lib/desktop-auth";
import { toMessageApiError } from "@/lib/api-errors";
import {
  PermissionDeniedError,
  ProviderUnavailableError,
  ResourceNotFoundError,
  RevisionConflictError,
  ValidationError,
} from "@/lib/domain-errors";
import {
  attachHubRequestId,
  createHubRequestContext,
  logHubError,
  logHubEvent,
} from "@/lib/hub-logger";
import { actionIdSchema } from "@/lib/action-contracts";
import { createDesktopProjectRepository } from "@/modules/desktop-project/infrastructure/desktop-project-repository";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ sourceProjectId: actionIdSchema });
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sourceProjectId: string }> },
) {
  const logContext = createHubRequestContext(request);
  const params = paramsSchema.safeParse(await context.params);
  const input = updateSchema.safeParse(await request.json().catch(() => null));
  try {
    if (!params.success || !input.success)
      throw new ValidationError("更新内容が不正です。");
    const authorization = await authorizeDesktopRequest(
      request,
      DESKTOP_DRAFT_WRITE_SCOPE,
    );
    if (!authorization)
      throw new PermissionDeniedError(
        "下書き更新の端末権限がありません。",
      );

    const repository = createDesktopProjectRepository();
    const { data: current, error: currentError } =
      await repository.findOwnedGeneralDraftCandidate(
        authorization.profileId,
        params.data.sourceProjectId,
      );
    if (currentError)
      throw new ProviderUnavailableError(
        "Hub下書きを確認できませんでした。",
      );
    if (!current)
      throw new ResourceNotFoundError("対応するHub作品がありません。");
    if (current.status !== "draft" || current.is_public)
      throw new RevisionConflictError(
        "Desktopから更新できるのは非公開下書きだけです。",
      );
    if (current.updated_at !== input.data.expectedUpdatedAt)
      throw new RevisionConflictError(
        "Hub側で作品が更新されています。再確認してからやり直してください。",
      );

    const { data: updated, error: updateError } =
      await repository.updateOwnedGeneralDraft({
        id: current.id,
        profileId: authorization.profileId,
        title: input.data.title,
        description: input.data.description,
        expectedUpdatedAt: input.data.expectedUpdatedAt,
      });
    if (updateError)
      throw new ProviderUnavailableError(
        "Hub下書きを更新できませんでした。",
      );
    if (!updated)
      throw new RevisionConflictError(
        "Hub側で作品が更新されています。再確認してからやり直してください。",
      );
    logHubEvent("info", "desktop_hub_draft_updated", {
      ...logContext,
      sourceProjectId: params.data.sourceProjectId,
      workId: updated.id,
    });
    return attachHubRequestId(
      NextResponse.json({
        updated: true,
        work: {
          id: updated.id,
          title: updated.title,
          description: updated.description ?? "",
          updatedAt: updated.updated_at,
        },
      }),
      logContext,
    );
  } catch (cause) {
    logHubError("desktop_hub_draft_update_failed", cause, logContext);
    const response = toMessageApiError(
      cause,
      "Hub下書きを更新できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sourceProjectId: string }> },
) {
  const logContext = createHubRequestContext(request);
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        linked: false,
        message: "公開作品は見つかりません。",
        errorCode: "RESOURCE_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  try {
    if (request.headers.has("authorization")) {
      const authorization = await authorizeDesktopRequest(request);
      if (!authorization)
        return NextResponse.json(
          {
            message: "端末認証が無効または期限切れです。",
            errorCode: "AUTHENTICATION_REQUIRED",
          },
          { status: 401 },
        );
      const repository = createDesktopProjectRepository();
      const { data: work, error } =
        await repository.findOwnedGeneralWorkStatus(
          authorization.profileId,
          parsed.data.sourceProjectId,
        );
      if (error)
        throw new ProviderUnavailableError(
          "Hub作品を確認できませんでした。",
        );
      if (!work)
        return NextResponse.json(
          {
            linked: false,
            message: "このProjectに対応するHub作品はありません。",
            errorCode: "RESOURCE_NOT_FOUND",
          },
          { status: 404 },
        );
      const { data: products, error: productError } =
        await repository.listOwnedProductStatuses(
          authorization.profileId,
          work.id,
        );
      if (productError)
        throw new ProviderUnavailableError(
          "Hub販売状況を確認できませんでした。",
        );
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

    if (error)
      throw new ProviderUnavailableError("Hub作品を確認できませんでした。");
    if (!work) {
      return NextResponse.json(
        {
          linked: false,
          message: "公開作品は見つかりません。",
          errorCode: "RESOURCE_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const { count, error: productError } = await supabase
      .from("digital_products")
      .select("id", { count: "exact", head: true })
      .eq("work_id", work.id)
      .eq("status", "active");
    if (productError)
      throw new ProviderUnavailableError(
        "Hub販売状況を確認できませんでした。",
      );

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
    logHubError("desktop_hub_status_lookup_failed", cause, logContext);
    const response = toMessageApiError(
      cause,
      "Hubの公開状況を確認できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(
        { linked: false, ...response.body },
        { status: response.status },
      ),
      logContext,
    );
  }
}

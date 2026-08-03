import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { toApiError } from "@/lib/api-errors";
import { getCurrentProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { DomainError } from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      throw new DomainError("PERMISSION_DENIED", "この操作は実行できません。");
    }

    const { user, profile } = await getCurrentProfile();
    if (!user || !profile) {
      throw new DomainError(
        "AUTHENTICATION_REQUIRED",
        "ログインし直してから、もう一度お試しください。",
      );
    }

    await requireCloudGeneralMonitor(profile.id);
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "complete_cloud_general_monitor_onboarding",
    );
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/monitor");
    return NextResponse.json({
      ok: true,
      redirectTo: "/dashboard?message=モニター利用を開始しました",
    });
  } catch (error) {
    const response = toApiError(
      error,
      "モニターを開始できませんでした。時間をおいてもう一度お試しください。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}

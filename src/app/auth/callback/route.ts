import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const destination = next === "/update-password" ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent("再設定リンクが無効です。もう一度メールを送信してください。")}`,
        requestUrl.origin,
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent("再設定リンクが無効または期限切れです。もう一度メールを送信してください。")}`,
        requestUrl.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}

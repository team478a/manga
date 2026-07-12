import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";

const protectedRoutes = ["/dashboard", "/admin"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  if (!hasSupabaseEnv()) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "Supabaseの環境変数を設定するとログインできます。");
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "マイページを見るにはログインしてください。");
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.searchParams.set("error", "管理者だけが閲覧できるページです。");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
};

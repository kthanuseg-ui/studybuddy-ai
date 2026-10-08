import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirectResponse = NextResponse.redirect(url);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

function getDashboardForRole(role: string) {
  if (role === "student") {
    return "/student/dashboard";
  }

  if (role === "tutor") {
    return "/tutor/dashboard";
  }

  if (role === "admin") {
    return "/admin/dashboard";
  }

  return "/login";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );

          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  const { data: claimsData } = await supabase.auth.getClaims();

const userId = claimsData?.claims.sub;
  const pathname = request.nextUrl.pathname;

  const isStudentRoute = pathname.startsWith("/student");
  const isTutorRoute = pathname.startsWith("/tutor");
  const isAdminRoute = pathname.startsWith("/admin");

  const isProtectedRoute =
    isStudentRoute || isTutorRoute || isAdminRoute;

  if (!userId) {
    if (isProtectedRoute) {
      return redirectWithCookies(request, supabaseResponse, "/login");
    }

    return supabaseResponse;
  }

  const needsRole =
    isProtectedRoute || pathname === "/login";

  if (!needsRole) {
    return supabaseResponse;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return redirectWithCookies(request, supabaseResponse, "/login");
  }

  const dashboard = getDashboardForRole(profile.role);

  if (pathname === "/login") {
    return redirectWithCookies(request, supabaseResponse, dashboard);
  }

  if (isAdminRoute && profile.role !== "admin") {
    return redirectWithCookies(request, supabaseResponse, dashboard);
  }

  if (
    isTutorRoute &&
    profile.role !== "tutor" &&
    profile.role !== "admin"
  ) {
    return redirectWithCookies(request, supabaseResponse, dashboard);
  }

  if (
    isStudentRoute &&
    profile.role !== "student" &&
    profile.role !== "admin"
  ) {
    return redirectWithCookies(request, supabaseResponse, dashboard);
  }

  return supabaseResponse;
}
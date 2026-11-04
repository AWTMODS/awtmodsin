import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin frontend routes (except /admin/login)
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  
  // Protect /api/admin backend endpoints (except /api/admin/auth)
  const isAdminApi = pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/auth");

  if (isAdminPage || isAdminApi) {
    const adminSession = request.cookies.get("awtmods_admin_session")?.value;

    if (!adminSession || adminSession !== "authenticated") {
      if (isAdminApi) {
        return NextResponse.json(
          { error: "Unauthorized: Administrator access required" },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};


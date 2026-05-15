import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, AUTH_COOKIE } from "@/lib/auth";

export const config = {
  // /admin ve alt rotalarını kapsa, login rotası dışarıda
  matcher: ["/admin/:path*", "/admin"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // login sayfası ve auth API'lerine dokunma
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const ok = token ? await verifyAdminToken(token) : false;
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname + (req.nextUrl.search ?? ""));
  return NextResponse.redirect(url);
}

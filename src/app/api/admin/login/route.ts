import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, cookieOptions, createAdminToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  if (!body.password || body.password !== adminPassword) {
    // sabit-zamanlı karşılaştırma yapmadan önce 500 ms bekleyerek
    // basit brute-force denemelerini biraz yavaşlat
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Parola yanlış" }, { status: 401 });
  }

  const token = await createAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, cookieOptions());
  return res;
}

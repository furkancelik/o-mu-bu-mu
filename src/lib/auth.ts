import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "omubumu_admin";
const COOKIE_DAYS = 14;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET ortam değişkeni ayarlı değil");
  }
  return new TextEncoder().encode(s);
}

export async function createAdminToken(): Promise<string> {
  return await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_DAYS}d`)
    .sign(secret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function getAdminFromCookies(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export async function getAdminFromRequest(req: Request): Promise<boolean> {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(/;\s*/)
    .map((s) => s.split("="))
    .find(([k]) => k === AUTH_COOKIE);
  const token = match?.[1];
  if (!token) return false;
  return verifyAdminToken(token);
}

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * COOKIE_DAYS,
  };
}

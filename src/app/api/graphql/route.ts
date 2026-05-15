import type { NextRequest } from "next/server";
import { handleRequest } from "@/lib/graphql/yoga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handle(req: NextRequest) {
  return handleRequest(req, {});
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;

import { NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/private-route-auth";
import { listSubastaRefreshStatuses } from "@/lib/subasta-refresh-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = await listSubastaRefreshStatuses();
  return Response.json({
    executionRegion: process.env.VERCEL_REGION ?? null,
    jobs,
  });
}


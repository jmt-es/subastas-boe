import { NextRequest } from "next/server";

export function isLocalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host")?.toLowerCase() || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function matchesBearerToken(request: NextRequest, expectedToken: string | undefined): boolean {
  const token = expectedToken?.trim();
  if (!token) return false;
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export function isAdminAuthorized(request: NextRequest): boolean {
  const adminToken = process.env.BOE_ADMIN_TOKEN?.trim();
  if (!adminToken) {
    return process.env.NODE_ENV !== "production" && isLocalRequest(request);
  }

  return request.headers.get("x-boe-admin-token") === adminToken;
}

export function isCronAuthorized(request: NextRequest): boolean {
  return matchesBearerToken(request, process.env.CRON_SECRET);
}

export function isAdminOrCronAuthorized(request: NextRequest): boolean {
  return isAdminAuthorized(request) || isCronAuthorized(request);
}


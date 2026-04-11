import { NextRequest } from "next/server";
import {
  getLatestBoeEmailOtp,
  isBoeEmailOtpConfigured,
  type BoeEmailOtpPurpose,
} from "@/lib/boe-email-otp";
import { isBoeCaptchaSolverConfigured } from "@/lib/boe-captcha";
import {
  BoeLoginError,
  isBoePasswordLoginConfigured,
  loginWithBoePassword,
} from "@/lib/boe-login";
import { isAdminAuthorized } from "@/lib/private-route-auth";
import { isBoeSessionActive, resolveBoeSession } from "@/lib/boe-session";
import { loadPersistedBoeSession } from "@/lib/boe-session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_PURPOSES = new Set<BoeEmailOtpPurpose>(["login", "password_reset", "any"]);

function parsePurpose(raw: string | null): BoeEmailOtpPurpose {
  if (!raw) return "login";
  if (VALID_PURPOSES.has(raw as BoeEmailOtpPurpose)) {
    return raw as BoeEmailOtpPurpose;
  }
  return "login";
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const purpose = parsePurpose(request.nextUrl.searchParams.get("purpose"));
  const includeCode = request.nextUrl.searchParams.get("includeCode") === "1";
  const session = resolveBoeSession();
  const persistedSession = await loadPersistedBoeSession();

  const [envSessionActive, persistedSessionActive, otp] = await Promise.all([
    isBoeSessionActive(session),
    persistedSession?.sessId
      ? isBoeSessionActive(persistedSession)
      : Promise.resolve(false),
    isBoeEmailOtpConfigured() ? getLatestBoeEmailOtp(purpose) : Promise.resolve(null),
  ]);

  return Response.json({
    executionRegion: process.env.VERCEL_REGION ?? null,
    gmailConfigured: isBoeEmailOtpConfigured(),
    captchaSolverConfigured: isBoeCaptchaSolverConfigured(),
    boeLoginConfigured: isBoePasswordLoginConfigured(),
    envSessionConfigured: Boolean(session.sessId),
    envSessionActive,
    persistedSessionConfigured: Boolean(persistedSession?.sessId),
    persistedSessionActive,
    otp: otp
      ? {
          found: true,
          purpose: otp.purpose,
          receivedAt: otp.receivedAt,
          subject: otp.subject,
          messageId: otp.messageId,
          ...(includeCode ? { code: otp.code } : {}),
        }
      : {
          found: false,
          purpose,
        },
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const includeSession =
      request.nextUrl.searchParams.get("includeSession") === "1" ||
      body.includeSession === true;
    const debug =
      request.nextUrl.searchParams.get("debug") === "1" || body.debug === true;

    const login = await loginWithBoePassword({
      username: typeof body.username === "string" ? body.username : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      debug,
    });

    return Response.json({
      success: true,
      executionRegion: process.env.VERCEL_REGION ?? null,
      gmailConfigured: isBoeEmailOtpConfigured(),
      captchaSolverConfigured: isBoeCaptchaSolverConfigured(),
      boeLoginConfigured: isBoePasswordLoginConfigured(),
      sessionActive: login.active,
      authenticatedAt: login.authenticatedAt,
      otp: login.otp,
      ...(includeSession
        ? {
            session: {
              sessId: login.sessId,
              simpleSaml: login.simpleSaml,
            },
          }
        : {}),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        executionRegion: process.env.VERCEL_REGION ?? null,
        error: error instanceof Error ? error.message : String(error),
        captchaSolverConfigured: isBoeCaptchaSolverConfigured(),
        ...(error instanceof BoeLoginError && error.details ? { debug: error.details } : {}),
      },
      { status: 500 }
    );
  }
}

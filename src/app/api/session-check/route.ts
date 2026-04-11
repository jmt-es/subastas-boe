import { isBoePasswordLoginConfigured } from "@/lib/boe-login";
import { isBoeCaptchaSolverConfigured } from "@/lib/boe-captcha";
import { hasBoeSession, isBoeSessionActive } from "@/lib/boe-session";
import { isBoeEmailOtpConfigured } from "@/lib/boe-email-otp";
import {
  getCachedBoeSession,
  getPersistedUsableBoeSession,
} from "@/lib/boe-session-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const autoLoginReady =
    isBoePasswordLoginConfigured() &&
    isBoeEmailOtpConfigured() &&
    isBoeCaptchaSolverConfigured();

  if (hasBoeSession()) {
    try {
      const active = await isBoeSessionActive();
      if (active) {
        return Response.json({
          active: true,
          ready: autoLoginReady,
          reason: "ok",
          executionRegion: process.env.VERCEL_REGION ?? null,
        });
      }
    } catch {
      return Response.json({
        active: false,
        ready: autoLoginReady,
        reason: "error",
        executionRegion: process.env.VERCEL_REGION ?? null,
      });
    }
  }

  try {
    const cached = getCachedBoeSession();
    if (cached?.sessId) {
      const active = await isBoeSessionActive(cached);
      if (active) {
        return Response.json({
          active: true,
          ready: autoLoginReady,
          reason: "memory_cache",
          executionRegion: process.env.VERCEL_REGION ?? null,
        });
      }
    }

    const stored = await getPersistedUsableBoeSession();
    if (stored?.sessId) {
      return Response.json({
        active: true,
        ready: autoLoginReady,
        reason: "persisted_session",
        executionRegion: process.env.VERCEL_REGION ?? null,
      });
    }

    return Response.json({
      active: false,
      ready: autoLoginReady,
      reason: autoLoginReady ? "auto_login_ready" : "expired",
      executionRegion: process.env.VERCEL_REGION ?? null,
    });
  } catch {
    return Response.json({
      active: false,
      ready: false,
      reason: "error",
      executionRegion: process.env.VERCEL_REGION ?? null,
    });
  }
}

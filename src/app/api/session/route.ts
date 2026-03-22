import { NextRequest } from "next/server";

// Store session in memory (resets on deploy, but that's fine)
let currentSession = process.env.BOE_SESSID || "";

export function getSession(): string {
  return currentSession || process.env.BOE_SESSID || "";
}

export async function POST(request: NextRequest) {
  const { sessId } = await request.json();
  if (!sessId || typeof sessId !== "string") {
    return Response.json({ error: "sessId required" }, { status: 400 });
  }

  currentSession = sessId.trim();

  // Update the env var so other routes pick it up
  process.env.BOE_SESSID = currentSession;

  return Response.json({ success: true });
}

export async function GET() {
  return Response.json({
    hasSession: !!getSession(),
    // Don't expose the actual session value
  });
}

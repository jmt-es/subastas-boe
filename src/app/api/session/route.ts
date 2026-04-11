import { NextRequest } from "next/server";
import {
  clearPersistedBoeSession,
  loadPersistedBoeSession,
  savePersistedBoeSession,
} from "@/lib/boe-session-store";
import { isAdminAuthorized } from "@/lib/private-route-auth";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessId, simpleSaml } = await request.json();

  if (sessId && typeof sessId === "string") {
    process.env.BOE_SESSID = sessId.trim();
  }
  if (simpleSaml && typeof simpleSaml === "string") {
    process.env.BOE_SIMPLESAML = simpleSaml.trim();
  }

  if (!sessId && !simpleSaml) {
    return Response.json({ error: "sessId or simpleSaml required" }, { status: 400 });
  }

  await savePersistedBoeSession(
    {
      sessId: typeof sessId === "string" ? sessId.trim() : process.env.BOE_SESSID,
      simpleSaml:
        typeof simpleSaml === "string" ? simpleSaml.trim() : process.env.BOE_SIMPLESAML,
    },
    { source: "manual", lastVerifiedAt: new Date().toISOString() }
  );

  return Response.json({ success: true });
}

export async function GET() {
  const persisted = await loadPersistedBoeSession();
  return Response.json({
    hasSession: !!process.env.BOE_SESSID,
    hasSimpleSaml: !!process.env.BOE_SIMPLESAML,
    hasPersistedSession: !!persisted?.sessId,
  });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  delete process.env.BOE_SESSID;
  delete process.env.BOE_SIMPLESAML;
  await clearPersistedBoeSession();
  return Response.json({ success: true });
}

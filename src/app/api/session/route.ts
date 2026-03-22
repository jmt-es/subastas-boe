import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
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

  return Response.json({ success: true });
}

export async function GET() {
  return Response.json({
    hasSession: !!process.env.BOE_SESSID,
    hasSimpleSaml: !!process.env.BOE_SIMPLESAML,
  });
}

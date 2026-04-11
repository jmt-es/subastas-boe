import { NextRequest } from "next/server";

import { getUsableBoeSession } from "@/lib/boe-session-runtime";
import {
  getStoredPdfBuffer,
  getSubastaDocument,
} from "@/lib/document-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function buildContentDisposition(filename: string, download: boolean): string {
  const type = download ? "attachment" : "inline";
  const safeName = filename.replace(/["\r\n]/g, "");
  return `${type}; filename="${safeName}"`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subastaId: string; docIndex: string }> }
) {
  const { subastaId, docIndex } = await params;
  const index = Number.parseInt(docIndex, 10);

  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: "invalid doc index" }, { status: 400 });
  }

  const selected = await getSubastaDocument(subastaId, index);
  if (!selected) {
    return Response.json({ error: "document not found" }, { status: 404 });
  }

  const session = await getUsableBoeSession();
  const buffer = await getStoredPdfBuffer(
    selected.doc.url,
    selected.doc.titulo,
    selected.subastaId,
    session
  );

  if (!buffer) {
    return Response.json({ error: "document unavailable" }, { status: 502 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": buildContentDisposition(selected.filename, download),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

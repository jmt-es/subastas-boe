import { NextRequest } from "next/server";
import { getSubastasCollection } from "@/lib/mongodb";
import { getUsableBoeSession } from "@/lib/boe-session-runtime";
import {
  getStoredPdfBuffer,
  inspectDocumentStorage,
  isBlobStorageConfigured,
} from "@/lib/document-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function downloadAndStore(
  url: string,
  titulo: string,
  subastaId: string,
  sessionId?: string
): Promise<{ ok: boolean; size: number }> {
  const buffer = await getStoredPdfBuffer(url, titulo, subastaId, {
    sessId: sessionId,
  });
  return { ok: Boolean(buffer), size: buffer?.length ?? 0 };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const session = await getUsableBoeSession({
    sessionId: body.sessionId,
    simpleSaml: body.simpleSaml,
  });

  if (!session.sessId && !isBlobStorageConfigured()) {
    return Response.json(
      { error: "No BOE session available and Blob storage is not configured" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        const subCol = await getSubastasCollection();

        // Get all subastas with docs
        const subastas = await subCol
          .find(
            { "documentos.0": { $exists: true } },
            { projection: { id: 1, documentos: 1 } }
          )
          .toArray();

        // Collect all unique doc URLs
        const allDocs: { url: string; titulo: string; subastaId: string }[] =
          [];
        const seen = new Set<string>();
        for (const s of subastas) {
          for (const d of s.documentos as { url: string; titulo: string }[]) {
            if (!seen.has(d.url)) {
              seen.add(d.url);
              allDocs.push({
                url: d.url,
                titulo: d.titulo,
                subastaId: s.id as string,
              });
            }
          }
        }

        const storageMode = isBlobStorageConfigured() ? "blob" : "local_or_mongo";
        const statuses = await Promise.all(
          allDocs.map(async (doc) => ({
            doc,
            status: await inspectDocumentStorage(doc.url, doc.subastaId),
          }))
        );
        const pending = statuses
          .filter(({ status }) =>
            storageMode === "blob"
              ? !status.blob
              : !status.local && !status.mongo
          )
          .map(({ doc }) => doc);

        send({
          type: "start",
          total: allDocs.length,
          storageMode,
          cached: allDocs.length - pending.length,
          pending: pending.length,
        });

        let downloaded = 0;
        let failed = 0;
        let totalSize = 0;

        // Process in batches of 5 concurrent downloads
        const BATCH_SIZE = 5;
        for (let i = 0; i < pending.length; i += BATCH_SIZE) {
          const batch = pending.slice(i, i + BATCH_SIZE);

          const results = await Promise.all(
            batch.map((d) =>
              downloadAndStore(d.url, d.titulo, d.subastaId, session.sessId)
            )
          );

          for (const r of results) {
            if (r.ok) {
              downloaded++;
              totalSize += r.size;
            } else {
              failed++;
            }
          }

          send({
            type: "progress",
            downloaded,
            failed,
            pending: pending.length - downloaded - failed,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
            pct:
              pending.length === 0
                ? 100
                : Math.round(((downloaded + failed) / pending.length) * 100),
          });

          // Small delay between batches to not hammer BOE
          await new Promise((r) => setTimeout(r, 300));
        }

        send({
          type: "done",
          downloaded,
          failed,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
        });
      } catch (error) {
        send({ type: "error", error: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

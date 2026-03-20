import { NextRequest } from "next/server";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import { getSubastasCollection, getDocumentsCollection } from "@/lib/mongodb";

export const maxDuration = 300;

const BOE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/pdf,*/*",
};

async function downloadAndStore(
  url: string,
  titulo: string,
  subastaId: string,
  sessionId: string,
  col: Awaited<ReturnType<typeof getDocumentsCollection>>
): Promise<{ ok: boolean; size: number; compressed: number }> {
  try {
    const resp = await fetch(url, {
      headers: { ...BOE_HEADERS, Cookie: `SESSID=${sessionId}` },
      redirect: "follow",
    });
    if (!resp.ok) return { ok: false, size: 0, compressed: 0 };

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 500) return { ok: false, size: 0, compressed: 0 };

    const compressed = gzipSync(buffer);

    await col.updateOne(
      { url },
      {
        $set: {
          url,
          subastaId,
          titulo,
          gzipData: new Binary(compressed),
          sizeBytes: buffer.length,
          compressedBytes: compressed.length,
          downloadedAt: new Date().toISOString(),
        },
        $unset: { base64: "" },
      },
      { upsert: true }
    );

    return { ok: true, size: buffer.length, compressed: compressed.length };
  } catch {
    return { ok: false, size: 0, compressed: 0 };
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionId = body.sessionId || process.env.BOE_SESSID;

  if (!sessionId) {
    return Response.json(
      { error: "No BOE session available" },
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
        const docCol = await getDocumentsCollection();

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

        // Check which are already cached
        const cachedUrls = new Set(await docCol.distinct("url"));
        const pending = allDocs.filter((d) => !cachedUrls.has(d.url));

        send({
          type: "start",
          total: allDocs.length,
          cached: cachedUrls.size,
          pending: pending.length,
        });

        let downloaded = 0;
        let failed = 0;
        let totalSize = 0;
        let totalCompressed = 0;

        // Process in batches of 5 concurrent downloads
        const BATCH_SIZE = 5;
        for (let i = 0; i < pending.length; i += BATCH_SIZE) {
          const batch = pending.slice(i, i + BATCH_SIZE);

          const results = await Promise.all(
            batch.map((d) =>
              downloadAndStore(d.url, d.titulo, d.subastaId, sessionId, docCol)
            )
          );

          for (const r of results) {
            if (r.ok) {
              downloaded++;
              totalSize += r.size;
              totalCompressed += r.compressed;
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
            compressedMB: (totalCompressed / 1024 / 1024).toFixed(1),
            pct: Math.round(
              ((downloaded + failed) / pending.length) * 100
            ),
          });

          // Small delay between batches to not hammer BOE
          await new Promise((r) => setTimeout(r, 300));
        }

        send({
          type: "done",
          downloaded,
          failed,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(1),
          compressedMB: (totalCompressed / 1024 / 1024).toFixed(1),
          savedMB: ((totalSize - totalCompressed) / 1024 / 1024).toFixed(1),
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

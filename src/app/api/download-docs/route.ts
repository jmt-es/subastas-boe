import { NextRequest } from "next/server";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getSubastasCollection } from "@/lib/mongodb";

export const maxDuration = 300;

const BOE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/pdf,*/*",
};

const PDF_DIR = join(process.cwd(), "data", "pdfs");

function getPdfPath(subastaId: string, url: string): string {
  const filename = url.replace(/[^a-zA-Z0-9]/g, "_").slice(-80) + ".pdf";
  return join(PDF_DIR, subastaId, filename);
}

async function downloadAndStore(
  url: string,
  _titulo: string,
  subastaId: string,
  sessionId: string
): Promise<{ ok: boolean; size: number }> {
  try {
    const pdfPath = getPdfPath(subastaId, url);

    // Skip if already downloaded
    if (existsSync(pdfPath)) {
      return { ok: true, size: 0 };
    }

    const resp = await fetch(url, {
      headers: { ...BOE_HEADERS, Cookie: `SESSID=${sessionId}` },
      redirect: "follow",
    });
    if (!resp.ok) return { ok: false, size: 0 };

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 500) return { ok: false, size: 0 };

    // Save to local filesystem
    mkdirSync(join(PDF_DIR, subastaId), { recursive: true });
    writeFileSync(pdfPath, buffer);

    return { ok: true, size: buffer.length };
  } catch {
    return { ok: false, size: 0 };
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

        // Check which are already cached locally
        const pending = allDocs.filter(
          (d) => !existsSync(getPdfPath(d.subastaId, d.url))
        );

        send({
          type: "start",
          total: allDocs.length,
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
              downloadAndStore(d.url, d.titulo, d.subastaId, sessionId)
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

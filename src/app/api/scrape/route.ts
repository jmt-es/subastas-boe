import { NextRequest } from "next/server";
import { scrapeSubastas, TIPO_BIEN, ESTADOS } from "@/lib/scraper";
import { getSubastasCollection } from "@/lib/mongodb";

export const maxDuration = 300;

async function saveToMongo(subastas: { id: string }[]) {
  if (subastas.length === 0) return;
  const col = await getSubastasCollection();
  const ops = subastas.map((s) => ({
    updateOne: {
      filter: { id: s.id },
      update: { $set: s },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tipoBien = "inmuebles",
    estado = "celebrandose",
    provincia = "",
    maxPaginas = 1,
    sessionId,
    stream = false,
  } = body;

  const tipoBienCode = TIPO_BIEN[tipoBien] ?? "I";
  const estadoCode = ESTADOS[estado] ?? "EJ";

  // Non-streaming mode
  if (!stream) {
    try {
      const subastas = await scrapeSubastas({
        tipoBien: tipoBienCode,
        estado: estadoCode,
        provincia,
        maxPaginas,
        sessionId,
      });

      // Save to MongoDB
      await saveToMongo(subastas);

      return Response.json({ success: true, subastas, count: subastas.length });
    } catch (error) {
      console.error("Error en scraping:", error);
      return Response.json(
        { success: false, error: String(error) },
        { status: 500 }
      );
    }
  }

  // Streaming mode — SSE with real-time progress + save to MongoDB
  const encoder = new TextEncoder();
  const batch: { id: string }[] = [];

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      try {
        await scrapeSubastas(
          {
            tipoBien: tipoBienCode,
            estado: estadoCode,
            provincia,
            maxPaginas,
            sessionId,
          },
          (progress) => {
            send("progress", progress);
          },
          async (subasta) => {
            send("subasta", subasta);
            batch.push(subasta);
            // Save in batches of 10
            if (batch.length >= 10) {
              await saveToMongo(batch.splice(0));
            }
          }
        );

        // Save remaining
        if (batch.length > 0) {
          await saveToMongo(batch.splice(0));
        }

        send("complete", { success: true });
      } catch (error) {
        // Save whatever we have
        if (batch.length > 0) {
          await saveToMongo(batch.splice(0)).catch(() => {});
        }
        send("error", { error: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

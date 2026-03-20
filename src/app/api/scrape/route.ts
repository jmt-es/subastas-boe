import { NextRequest } from "next/server";
import { scrapeSubastas, TIPO_BIEN, ESTADOS } from "@/lib/scraper";

export const maxDuration = 300;

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

  // Non-streaming mode (original behavior)
  if (!stream) {
    try {
      const subastas = await scrapeSubastas({
        tipoBien: tipoBienCode,
        estado: estadoCode,
        provincia,
        maxPaginas,
        sessionId,
      });
      return Response.json({ success: true, subastas, count: subastas.length });
    } catch (error) {
      console.error("Error en scraping:", error);
      return Response.json(
        { success: false, error: String(error) },
        { status: 500 }
      );
    }
  }

  // Streaming mode — SSE with real-time progress + subastas
  const encoder = new TextEncoder();

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
          (subasta) => {
            send("subasta", subasta);
          }
        );

        send("complete", { success: true });
      } catch (error) {
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

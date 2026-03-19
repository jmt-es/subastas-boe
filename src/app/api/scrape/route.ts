import { NextRequest, NextResponse } from "next/server";
import { scrapeSubastas, TIPO_BIEN, ESTADOS } from "@/lib/scraper";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tipoBien = "inmuebles",
      estado = "celebrandose",
      provincia = "",
      maxPaginas = 1,
    } = body;

    const tipoBienCode = TIPO_BIEN[tipoBien] ?? "I";
    const estadoCode = ESTADOS[estado] ?? "EJ";

    const subastas = await scrapeSubastas({
      tipoBien: tipoBienCode,
      estado: estadoCode,
      provincia,
      maxPaginas,
    });

    // Return data directly — client handles persistence
    return NextResponse.json({
      success: true,
      subastas,
      count: subastas.length,
    });
  } catch (error) {
    console.error("Error en scraping:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

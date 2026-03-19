import { NextRequest, NextResponse } from "next/server";
import { analizarSubasta } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { subasta } = await request.json();

    if (!subasta) {
      return NextResponse.json(
        { error: "subasta data requerido en el body" },
        { status: 400 }
      );
    }

    const analysis = await analizarSubasta(subasta);

    // Return analysis directly — client handles persistence
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error en análisis:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

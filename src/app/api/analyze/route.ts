import { NextRequest, NextResponse } from "next/server";
import { getSubasta, saveAnalysis, getAnalysis } from "@/lib/storage";
import { analizarSubasta } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { subastaId } = await request.json();

    if (!subastaId) {
      return NextResponse.json(
        { error: "subastaId requerido" },
        { status: 400 }
      );
    }

    const subasta = await getSubasta(subastaId);
    if (!subasta) {
      return NextResponse.json(
        { error: "Subasta no encontrada" },
        { status: 404 }
      );
    }

    const analysis = await analizarSubasta(subasta);
    await saveAnalysis(analysis);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error en análisis:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const subastaId = request.nextUrl.searchParams.get("subastaId");
  if (!subastaId) {
    return NextResponse.json(
      { error: "subastaId requerido" },
      { status: 400 }
    );
  }

  const analysis = await getAnalysis(subastaId);
  if (!analysis) {
    return NextResponse.json(
      { error: "Análisis no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(analysis);
}

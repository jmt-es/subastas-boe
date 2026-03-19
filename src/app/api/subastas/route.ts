import { NextRequest, NextResponse } from "next/server";
import { getSubastas, getSubasta } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (id) {
    const subasta = await getSubasta(id);
    if (!subasta) {
      return NextResponse.json(
        { error: "Subasta no encontrada" },
        { status: 404 }
      );
    }
    return NextResponse.json(subasta);
  }

  const subastas = await getSubastas();

  // Filtros
  const tipo = searchParams.get("tipo");
  const estado = searchParams.get("estado");
  const provincia = searchParams.get("provincia");
  const busqueda = searchParams.get("q");

  let filtradas = subastas;

  if (tipo && tipo !== "todos") {
    filtradas = filtradas.filter((s) =>
      s.tipoSubasta?.toLowerCase().includes(tipo.toLowerCase())
    );
  }

  if (estado && estado !== "todos") {
    filtradas = filtradas.filter((s) =>
      s.estado?.toLowerCase().includes(estado.toLowerCase())
    );
  }

  if (provincia) {
    filtradas = filtradas.filter((s) =>
      s.provincia?.toLowerCase().includes(provincia.toLowerCase())
    );
  }

  if (busqueda) {
    const q = busqueda.toLowerCase();
    filtradas = filtradas.filter(
      (s) =>
        s.descripcion?.toLowerCase().includes(q) ||
        s.direccion?.toLowerCase().includes(q) ||
        s.localidad?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }

  return NextResponse.json(filtradas);
}

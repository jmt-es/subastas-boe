import { NextRequest } from "next/server";
import { getSubastasCollection } from "@/lib/mongodb";
import { loadSubastasSnapshot } from "@/lib/result-snapshots";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  let subasta = null;

  try {
    const col = await getSubastasCollection();
    subasta = await col.findOne({ id: decodedId });
  } catch {
    subasta = null;
  }

  if (!subasta) {
    const snapshot = await loadSubastasSnapshot();
    subasta = snapshot?.find((item) => item.id === decodedId) ?? null;
  }

  if (!subasta) {
    return Response.json({ error: "No encontrada" }, { status: 404 });
  }

  return Response.json(subasta);
}

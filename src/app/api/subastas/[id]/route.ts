import { NextRequest } from "next/server";
import { getSubastasCollection } from "@/lib/mongodb";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const col = await getSubastasCollection();
  const subasta = await col.findOne({ id: decodeURIComponent(id) });

  if (!subasta) {
    return Response.json({ error: "No encontrada" }, { status: 404 });
  }

  return Response.json(subasta);
}

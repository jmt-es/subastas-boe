import { NextRequest } from "next/server";
import { getSubastasCollection } from "@/lib/mongodb";
import { getActiveSubastasFilter } from "@/lib/subasta-dates";

// GET — fetch all subastas (with optional search)
export async function GET(request: NextRequest) {
  const col = await getSubastasCollection();
  const search = request.nextUrl.searchParams.get("q");
  const includeHistorical = request.nextUrl.searchParams.get("all") === "1";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "0");

  const filters: Record<string, unknown>[] = [];
  if (!includeHistorical) {
    filters.push(getActiveSubastasFilter());
  }

  if (search) {
    filters.push({
      $or: [
        { descripcion: { $regex: search, $options: "i" } },
        { direccion: { $regex: search, $options: "i" } },
        { localidad: { $regex: search, $options: "i" } },
        { provincia: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } },
      ],
    });
  }

  const filter =
    filters.length === 0
      ? {}
      : filters.length === 1
        ? filters[0]
        : { $and: filters };

  const cursor = col.find(filter).sort({ scrapedAt: -1 });
  if (limit > 0) cursor.limit(limit);
  const subastas = await cursor.toArray();

  return Response.json({ subastas, count: subastas.length });
}

// POST — upsert batch of subastas
export async function POST(request: NextRequest) {
  const { subastas } = await request.json();

  if (!Array.isArray(subastas) || subastas.length === 0) {
    return Response.json({ error: "No subastas provided" }, { status: 400 });
  }

  const col = await getSubastasCollection();
  const ops = subastas.map((s: { id: string }) => ({
    updateOne: {
      filter: { id: s.id },
      update: { $set: s },
      upsert: true,
    },
  }));

  const result = await col.bulkWrite(ops);

  return Response.json({
    success: true,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
    total: subastas.length,
  });
}

// DELETE — clear all subastas
export async function DELETE() {
  const col = await getSubastasCollection();
  const result = await col.deleteMany({});
  return Response.json({ success: true, deleted: result.deletedCount });
}

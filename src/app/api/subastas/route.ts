import { NextRequest } from "next/server";
import { getSubastasCollection } from "@/lib/mongodb";
import {
  getActiveSubastasFilter,
  getInactiveSubastasFilter,
  isSubastaActive,
} from "@/lib/subasta-dates";
import { loadSubastasSnapshot } from "@/lib/result-snapshots";
import type { Subasta } from "@/lib/scraper";

type SubastaStatusFilter = "activas" | "inactivas" | "todas";

function parseStatusFilter(value: string | null, includeAll: boolean): SubastaStatusFilter {
  if (value === "activas") return "activas";
  if (value === "inactivas" || value === "todas") return value;
  return includeAll ? "todas" : "activas";
}

// GET — fetch all subastas (with optional search)
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("q");
  const statusFilter = parseStatusFilter(
    request.nextUrl.searchParams.get("estado"),
    request.nextUrl.searchParams.get("all") === "1"
  );
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "0");

  let subastas: Subasta[] = [];
  const filters: Record<string, unknown>[] = [];
  if (statusFilter === "activas") {
    filters.push(getActiveSubastasFilter());
  } else if (statusFilter === "inactivas") {
    filters.push(getInactiveSubastasFilter());
  }

  if (search) {
    filters.push({
      $or: [
        { descripcion: { $regex: search, $options: "i" } },
        { direccion: { $regex: search, $options: "i" } },
        { localidad: { $regex: search, $options: "i" } },
        { provincia: { $regex: search, $options: "i" } },
        { tipoSubasta: { $regex: search, $options: "i" } },
        { tipoBienDetalle: { $regex: search, $options: "i" } },
        { valorSubasta: { $regex: search, $options: "i" } },
        { tasacion: { $regex: search, $options: "i" } },
        { estado: { $regex: search, $options: "i" } },
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

  try {
    const col = await getSubastasCollection();
    const cursor = col.find(filter).sort({ scrapedAt: -1 });
    if (limit > 0) cursor.limit(limit);
    subastas = await cursor.toArray() as unknown as Subasta[];
  } catch {
    const snapshot = await loadSubastasSnapshot();
    subastas = snapshot || [];

    if (statusFilter === "activas") {
      subastas = subastas.filter((subasta) => isSubastaActive(subasta));
    } else if (statusFilter === "inactivas") {
      subastas = subastas.filter((subasta) => !isSubastaActive(subasta));
    }

    if (search) {
      const query = search.toLowerCase();
      subastas = subastas.filter((subasta) =>
        [
          subasta.descripcion,
          subasta.direccion,
          subasta.localidad,
          subasta.provincia,
          subasta.tipoSubasta,
          subasta.tipoBienDetalle,
          subasta.valorSubasta,
          subasta.tasacion,
          subasta.estado,
          subasta.id,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query))
      );
    }

    subastas.sort((a, b) => b.scrapedAt.localeCompare(a.scrapedAt));
    if (limit > 0) {
      subastas = subastas.slice(0, limit);
    }
  }

  return Response.json({ subastas, count: subastas.length, estado: statusFilter });
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

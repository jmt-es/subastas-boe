import { NextRequest } from "next/server";
import { getAnalysisCollection } from "@/lib/mongodb";
import { loadAnalysisSnapshot } from "@/lib/result-snapshots";

// GET — get analysis by subastaId or all
export async function GET(request: NextRequest) {
  const wantsAll = request.nextUrl.searchParams.has("all");

  try {
    const col = await getAnalysisCollection();

    // Return all analyses (for dashboard IA scores)
    if (wantsAll) {
      const all = await col
        .find({}, { projection: { subastaId: 1, oportunidad: 1, recomendacion: 1, _id: 0 } })
        .toArray();
      if (all.length > 0) {
        return Response.json(all);
      }
      throw new Error("Analysis summary not found in MongoDB");
    }

    const subastaId = request.nextUrl.searchParams.get("subastaId");
    if (!subastaId) {
      return Response.json({ error: "subastaId required" }, { status: 400 });
    }

    const analysis = await col.findOne({ subastaId });

    if (!analysis) {
      throw new Error(`Analysis not found in MongoDB for ${subastaId}`);
    }

    return Response.json(analysis);
  } catch {
    const allAnalysis = await loadAnalysisSnapshot();

    // Return all analyses (for dashboard IA scores)
    if (wantsAll) {
      const summary = (allAnalysis || []).map((analysis) => ({
        subastaId: analysis.subastaId,
        oportunidad: analysis.oportunidad,
        recomendacion: analysis.recomendacion,
      }));
      return Response.json(summary);
    }

    const subastaId = request.nextUrl.searchParams.get("subastaId");
    if (!subastaId) {
      return Response.json({ error: "subastaId required" }, { status: 400 });
    }

    const analysis = (allAnalysis || []).find((item) => item.subastaId === subastaId) || null;

    return Response.json(analysis);
  }
}

// POST — save analysis
export async function POST(request: NextRequest) {
  const analysis = await request.json();

  if (!analysis.subastaId) {
    return Response.json({ error: "subastaId required" }, { status: 400 });
  }

  const col = await getAnalysisCollection();
  await col.updateOne(
    { subastaId: analysis.subastaId },
    { $set: analysis },
    { upsert: true }
  );

  return Response.json({ success: true });
}

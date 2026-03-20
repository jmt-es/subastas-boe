import { NextRequest } from "next/server";
import { getAnalysisCollection } from "@/lib/mongodb";

// GET — get analysis by subastaId
export async function GET(request: NextRequest) {
  const subastaId = request.nextUrl.searchParams.get("subastaId");
  if (!subastaId) {
    return Response.json({ error: "subastaId required" }, { status: 400 });
  }

  const col = await getAnalysisCollection();
  const analysis = await col.findOne({ subastaId });

  if (!analysis) {
    return Response.json(null);
  }

  return Response.json(analysis);
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

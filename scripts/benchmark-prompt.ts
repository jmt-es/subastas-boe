/**
 * Benchmark: re-analyze a sample of subastas with the updated prompt
 * and compare new scores vs old scores.
 *
 * Usage:
 *   npx tsx scripts/benchmark-prompt.ts [--count=20] [--force]
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { MongoClient } from "mongodb";
import { analizarSubasta } from "../src/lib/gemini";
import type { Subasta } from "../src/lib/scraper";
import type { AnalysisResult } from "../src/lib/storage";

const MONGODB_URI = process.env.MONGODB_URI!;
const TIMEOUT_MS = 180_000;

function getCount(): number {
  const arg = process.argv.find((a) => a.startsWith("--count="));
  const n = arg ? Number.parseInt(arg.split("=")[1], 10) : 20;
  return Number.isFinite(n) && n > 0 ? n : 20;
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let tid: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, rej) => {
        tid = setTimeout(() => rej(new Error(`${label} timeout`)), TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (tid) clearTimeout(tid);
  }
}

async function main() {
  const count = getCount();
  console.log(`\n🔬 Benchmark: re-analyzing ${count} subastas with updated prompt\n`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  // Fetch subastas from the API snapshot (same source the app uses)
  const response = await fetch("https://subastas-boe.vercel.app/api/subastas?all=1&limit=200");
  const json = await response.json();
  const allSubastas: Subasta[] = json.subastas || json;
  console.log(`📦 Fetched ${allSubastas.length} subastas from API`);

  // Get old analyses from deployed API
  const oldAnalysisMap = new Map<string, AnalysisResult>();
  const analysisResp = await fetch("https://subastas-boe.vercel.app/api/analysis?all=1");
  const analysisJson = await analysisResp.json();
  const allOld: AnalysisResult[] = analysisJson.analyses || analysisJson;
  for (const a of allOld) {
    oldAnalysisMap.set(a.subastaId, a);
  }
  console.log(`📊 Found ${oldAnalysisMap.size} existing analyses\n`);

  // Pick a diverse sample: mix of old scores
  const withOldAnalysis = allSubastas.filter((s) => oldAnalysisMap.has(s.id));

  // Sort to get a mix of different old scores
  const scored = withOldAnalysis.map(s => ({
    subasta: s,
    oldScore: oldAnalysisMap.get(s.id)!.oportunidad,
    oldRec: oldAnalysisMap.get(s.id)!.recomendacion
  }));
  scored.sort((a, b) => a.oldScore - b.oldScore);

  // Take evenly spaced samples
  const step = Math.max(1, Math.floor(scored.length / count));
  const sample = [];
  for (let i = 0; i < scored.length && sample.length < count; i += step) {
    sample.push(scored[i]);
  }
  // Fill remaining slots if needed
  let fillIdx = 0;
  while (sample.length < count && fillIdx < scored.length) {
    if (!sample.includes(scored[fillIdx])) sample.push(scored[fillIdx]);
    fillIdx++;
  }

  console.log(`🎯 Selected ${sample.length} subastas for benchmark\n`);
  console.log("ID".padEnd(30) + "OLD".padStart(5) + "NEW".padStart(5) + "  DELTA" + "  OLD_REC".padEnd(14) + "NEW_REC");
  console.log("─".repeat(90));

  const results: Array<{
    id: string;
    oldScore: number;
    newScore: number;
    oldRec: string;
    newRec: string;
    delta: number;
  }> = [];

  // Process in batches of 3 (to not hammer the API)
  const BATCH = 3;
  for (let b = 0; b < sample.length; b += BATCH) {
    const batch = sample.slice(b, b + BATCH);
    const promises = batch.map(async ({ subasta, oldScore, oldRec }) => {
      try {
        const result = await withTimeout(
          analizarSubasta(subasta),
          subasta.id
        );
        const entry = {
          id: subasta.id,
          oldScore,
          newScore: result.oportunidad,
          oldRec,
          newRec: result.recomendacion,
          delta: result.oportunidad - oldScore,
        };
        results.push(entry);

        const deltaStr = entry.delta > 0 ? `+${entry.delta}` : `${entry.delta}`;
        console.log(
          `${entry.id.padEnd(30)}${String(entry.oldScore).padStart(5)}${String(entry.newScore).padStart(5)}  ${deltaStr.padStart(5)}  ${entry.oldRec.padEnd(12)}${entry.newRec}`
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ ${subasta.id}: ${message}`);
        return null;
      }
    });
    await Promise.all(promises);
  }

  // Summary statistics
  console.log("\n" + "═".repeat(90));
  console.log("📊 SUMMARY\n");

  const oldScores = results.map(r => r.oldScore);
  const newScores = results.map(r => r.newScore);

  const uniqueOld = new Set(oldScores);
  const uniqueNew = new Set(newScores);

  console.log(`Old scores: ${results.length} analyses, ${uniqueOld.size} unique values`);
  console.log(`New scores: ${results.length} analyses, ${uniqueNew.size} unique values`);

  // Distribution
  const distOld = new Map<number, number>();
  const distNew = new Map<number, number>();
  for (const s of oldScores) distOld.set(s, (distOld.get(s) || 0) + 1);
  for (const s of newScores) distNew.set(s, (distNew.get(s) || 0) + 1);

  console.log("\nOld distribution:");
  for (const [k, v] of [...distOld.entries()].sort((a, b) => a[0] - b[0])) {
    const pct = ((v / results.length) * 100).toFixed(1);
    console.log(`  ${k}: ${v} (${pct}%) ${"█".repeat(Math.round(v / results.length * 40))}`);
  }

  console.log("\nNew distribution:");
  for (const [k, v] of [...distNew.entries()].sort((a, b) => a[0] - b[0])) {
    const pct = ((v / results.length) * 100).toFixed(1);
    console.log(`  ${k}: ${v} (${pct}%) ${"█".repeat(Math.round(v / results.length * 40))}`);
  }

  // Recommendation changes
  const recChanges = results.filter(r => r.oldRec !== r.newRec);
  console.log(`\nRecommendation changes: ${recChanges.length}/${results.length}`);
  for (const r of recChanges) {
    console.log(`  ${r.id}: ${r.oldRec} → ${r.newRec} (${r.oldScore} → ${r.newScore})`);
  }

  // Check if the "65 problem" is fixed
  const old65pct = ((distOld.get(65) || 0) / results.length * 100).toFixed(1);
  const new65pct = ((distNew.get(65) || 0) / results.length * 100).toFixed(1);
  console.log(`\n🎯 "65 problem": ${old65pct}% → ${new65pct}%`);

  const avgOld = oldScores.reduce((a, b) => a + b, 0) / oldScores.length;
  const avgNew = newScores.reduce((a, b) => a + b, 0) / newScores.length;
  console.log(`📈 Average score: ${avgOld.toFixed(1)} → ${avgNew.toFixed(1)}`);

  // Write results to file for later analysis
  const outputPath = resolve(process.cwd(), "data", "benchmark-results.json");
  const { writeFileSync, mkdirSync } = await import("fs");
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    count: results.length,
    results,
    summary: {
      uniqueOldScores: uniqueOld.size,
      uniqueNewScores: uniqueNew.size,
      avgOld,
      avgNew,
      old65pct: parseFloat(old65pct),
      new65pct: parseFloat(new65pct)
    }
  }, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);

  await client.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

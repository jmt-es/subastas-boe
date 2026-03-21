/**
 * Analyze-only: reads saved subastas.json, runs Gemini in parallel, saves to MongoDB
 * Usage: npx tsx scripts/analyze-only.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { MongoClient } from "mongodb";
import { analizarSubasta } from "../src/lib/gemini";
import type { Subasta } from "../src/lib/scraper";
import type { AnalysisResult } from "../src/lib/storage";

const MONGODB_URI = process.env.MONGODB_URI!;
const BOE_SESSID = process.env.BOE_SESSID!;
const RESULTS_DIR = join(process.cwd(), "data", "results");
const BATCH_SIZE = 10; // 10 parallel Gemini calls

async function main() {
  // Load saved subastas
  const subastas: Subasta[] = JSON.parse(readFileSync(join(RESULTS_DIR, "subastas.json"), "utf-8"));
  console.log(`📋 ${subastas.length} subastas loaded\n`);

  // Connect to MongoDB
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("subastas_boe");
  const analysisCol = db.collection("analysis");

  // Load existing analyses
  let allAnalysis: Record<string, AnalysisResult> = {};
  const analysisFile = join(RESULTS_DIR, "analysis.json");
  if (existsSync(analysisFile)) {
    try {
      const existing = JSON.parse(readFileSync(analysisFile, "utf-8"));
      for (const a of (Array.isArray(existing) ? existing : Object.values(existing))) {
        allAnalysis[(a as AnalysisResult).subastaId] = a as AnalysisResult;
      }
    } catch { /* ignore */ }
  }

  let totalCost = 0, totalTokens = 0, analyzed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < subastas.length; i += BATCH_SIZE) {
    const batch = subastas.slice(i, i + BATCH_SIZE);
    const toAnalyze = batch.filter(s => !allAnalysis[s.id]);
    const skipCount = batch.length - toAnalyze.length;
    skipped += skipCount;

    if (toAnalyze.length === 0) {
      console.log(`  Batch ${Math.floor(i/BATCH_SIZE)+1}: all ${batch.length} already done, skipping`);
      continue;
    }

    console.log(`  Batch ${Math.floor(i/BATCH_SIZE)+1}: analyzing ${toAnalyze.length} (${skipCount} skipped)...`);

    const results = await Promise.allSettled(
      toAnalyze.map(async (subasta) => {
        const analysis = await analizarSubasta(subasta, BOE_SESSID);
        return { subasta, analysis };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        const { subasta, analysis } = r.value;
        allAnalysis[analysis.subastaId] = analysis;
        totalCost += analysis.usage?.costUsd ?? 0;
        totalTokens += analysis.usage?.totalTokens ?? 0;
        analyzed++;
        console.log(`    ✅ ${subasta.id}: ${analysis.oportunidad}/10 (${analysis.recomendacion}) | ${analysis.usage?.docsAttached ?? 0} docs | $${(analysis.usage?.costUsd ?? 0).toFixed(4)}`);
      } else {
        errors++;
        console.error(`    ❌ Error: ${r.reason}`);
      }
    }

    // Save progress
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(analysisFile, JSON.stringify(Object.values(allAnalysis), null, 2));

    // Batch write to MongoDB
    try {
      const ops = results
        .filter((r): r is PromiseFulfilledResult<{subasta: Subasta; analysis: AnalysisResult}> => r.status === "fulfilled")
        .map(r => ({
          updateOne: {
            filter: { subastaId: r.value.analysis.subastaId },
            update: { $set: r.value.analysis },
            upsert: true,
          }
        }));
      if (ops.length > 0) await analysisCol.bulkWrite(ops);
    } catch (err) {
      console.log(`    ⚠️ MongoDB write error: ${err}`);
    }

    console.log(`  --- ${analyzed + skipped}/${subastas.length} done | $${totalCost.toFixed(4)} ---\n`);
  }

  // Summary
  const sorted = Object.values(allAnalysis).sort((a, b) => b.oportunidad - a.oportunidad);
  console.log("=".repeat(60));
  console.log(`📊 DONE: ${analyzed} analyzed, ${skipped} skipped, ${errors} errors`);
  console.log(`💰 Cost: $${totalCost.toFixed(4)} | Tokens: ${totalTokens.toLocaleString()}`);
  console.log("\n🏆 TOP 10:");
  for (const a of sorted.slice(0, 10)) {
    const sub = subastas.find(s => s.id === a.subastaId);
    console.log(`  ${a.oportunidad}/10 (${a.recomendacion}) — ${a.subastaId} — ${sub?.valorSubasta ?? "?"}`);
  }
  console.log("=".repeat(60));

  await client.close();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });

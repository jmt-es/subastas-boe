/**
 * Re-scrape Alicante with session, then analyze with docs
 * Usage: npx tsx scripts/scrape-with-session.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { MongoClient } from "mongodb";
import { scrapeSubastas, type Subasta } from "../src/lib/scraper";
import { analizarSubasta } from "../src/lib/gemini";
import type { AnalysisResult } from "../src/lib/storage";

const MONGODB_URI = process.env.MONGODB_URI!;
const BOE_SESSID = process.env.BOE_SESSID!;
const DB_NAME = "subastas_boe";
const RESULTS_DIR = join(process.cwd(), "data", "results");
const BATCH_SIZE = 10;

function saveJson(filename: string, data: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, filename), JSON.stringify(data, null, 2));
}

async function main() {
  console.log("🚀 Full pipeline: scrape WITH session + analyze WITH docs\n");

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // 1. Scrape with session
  console.log("🔍 Scraping Alicante with session (docs + pujas)...\n");
  const subastas = await scrapeSubastas({
    tipoBien: "I",
    estado: "EJ",
    provincia: "03",
    maxPaginas: 0,
    sessionId: BOE_SESSID,
  }, (p) => {
    if (p.subastaActual) console.log(`  [${p.procesadas + 1}] ${p.subastaActual}`);
  });

  console.log(`\n✅ ${subastas.length} subastas scraped\n`);

  // Count docs
  let totalDocs = 0;
  let withPuja = 0;
  for (const s of subastas) {
    totalDocs += s.documentos?.length ?? 0;
    if (s.pujActual) withPuja++;
  }
  console.log(`📎 ${totalDocs} documents found | 💰 ${withPuja} with active bids\n`);

  // Save locally
  saveJson("subastas.json", subastas);

  // Save to MongoDB
  try {
    const ops = subastas.map(s => ({
      updateOne: { filter: { id: s.id }, update: { $set: s }, upsert: true }
    }));
    await db.collection("subastas").bulkWrite(ops);
    console.log(`💾 ${subastas.length} subastas saved to MongoDB\n`);
  } catch (e) {
    console.log(`⚠️ MongoDB write: ${e}\n`);
  }

  // 2. Analyze with docs
  console.log(`🤖 Analyzing ${subastas.length} subastas with Gemini (${BATCH_SIZE} parallel)...\n`);

  const allAnalysis: Record<string, AnalysisResult> = {};
  let totalCost = 0, totalTokens = 0, analyzed = 0, errors = 0;

  for (let i = 0; i < subastas.length; i += BATCH_SIZE) {
    const batch = subastas.slice(i, i + BATCH_SIZE);
    console.log(`  Batch ${Math.floor(i/BATCH_SIZE)+1}...`);

    const results = await Promise.allSettled(
      batch.map(s => analizarSubasta(s, BOE_SESSID))
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const s = batch[j];
      if (r.status === "fulfilled") {
        allAnalysis[r.value.subastaId] = r.value;
        totalCost += r.value.usage?.costUsd ?? 0;
        totalTokens += r.value.usage?.totalTokens ?? 0;
        analyzed++;
        console.log(`    ✅ ${s.id}: ${r.value.oportunidad}/10 (${r.value.recomendacion}) | ${r.value.usage?.docsAttached ?? 0} docs | $${(r.value.usage?.costUsd ?? 0).toFixed(4)}`);
      } else {
        errors++;
        console.error(`    ❌ ${s.id}: ${r.reason}`);
      }
    }

    // Save progress
    saveJson("analysis.json", Object.values(allAnalysis));

    // Batch write to MongoDB
    try {
      const ops = results
        .filter((r): r is PromiseFulfilledResult<AnalysisResult> => r.status === "fulfilled")
        .map(r => ({
          updateOne: { filter: { subastaId: r.value.subastaId }, update: { $set: r.value }, upsert: true }
        }));
      if (ops.length > 0) await db.collection("analysis").bulkWrite(ops);
    } catch { /* ignore */ }

    console.log(`  --- ${analyzed}/${subastas.length} | $${totalCost.toFixed(4)} ---\n`);
  }

  // Summary
  const sorted = Object.values(allAnalysis).sort((a, b) => b.oportunidad - a.oportunidad);
  console.log("=".repeat(60));
  console.log(`📊 DONE: ${analyzed} analyzed, ${errors} errors`);
  console.log(`💰 Cost: $${totalCost.toFixed(4)} | Tokens: ${totalTokens.toLocaleString()}`);
  console.log(`📎 Documents attached to analyses`);
  console.log("\n🏆 TOP 10:");
  for (const a of sorted.slice(0, 10)) {
    const sub = subastas.find(s => s.id === a.subastaId);
    console.log(`  ${a.oportunidad}/10 (${a.recomendacion}) — ${a.subastaId} — ${sub?.valorSubasta ?? "?"} — ${a.usage?.docsAttached ?? 0} docs`);
  }
  console.log("=".repeat(60));

  await client.close();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });

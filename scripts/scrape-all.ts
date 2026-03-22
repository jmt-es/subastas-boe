/**
 * Scrape multiple provinces + analyze all with Gemini + upload PDFs to MongoDB
 *
 * Usage: npx tsx scripts/scrape-all.ts
 * Env: .env.local with GEMINI_API_KEY, MONGODB_URI, BOE_SESSID, BOE_SIMPLESAML
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
const BATCH_SIZE = 5; // Parallel Gemini calls

// Provinces to scrape
const PROVINCES = [
  { code: "03", name: "Alicante" },
  { code: "30", name: "Murcia" },
  { code: "02", name: "Albacete" },
  { code: "46", name: "Valencia" },
];

function saveJson(filename: string, data: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, filename), JSON.stringify(data, null, 2));
}

async function main() {
  console.log("🚀 Multi-province pipeline\n");
  console.log(`📍 Provinces: ${PROVINCES.map(p => p.name).join(", ")}\n`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // 1. Scrape all provinces
  const allSubastas: Subasta[] = [];

  for (const prov of PROVINCES) {
    console.log(`\n🔍 Scraping ${prov.name} (${prov.code})...`);
    try {
      const subastas = await scrapeSubastas({
        tipoBien: "I",
        estado: "EJ",
        provincia: prov.code,
        maxPaginas: 0,
        sessionId: BOE_SESSID,
      }, (p) => {
        if (p.subastaActual) process.stdout.write(`\r  [${p.procesadas + 1}] ${p.subastaActual}                    `);
      });
      console.log(`\n  ✅ ${subastas.length} subastas from ${prov.name}`);
      allSubastas.push(...subastas);
    } catch (err) {
      console.error(`\n  ❌ Error scraping ${prov.name}: ${err}`);
    }
  }

  const totalDocs = allSubastas.reduce((n, s) => n + (s.documentos?.length ?? 0), 0);
  console.log(`\n📊 Total: ${allSubastas.length} subastas | ${totalDocs} documents\n`);

  // Save locally
  saveJson("subastas.json", allSubastas);

  // Save to MongoDB
  try {
    // Clear old data first
    await db.collection("subastas").deleteMany({});
    await db.collection("analysis").deleteMany({});
    const ops = allSubastas.map(s => ({
      updateOne: { filter: { id: s.id }, update: { $set: s }, upsert: true }
    }));
    if (ops.length > 0) await db.collection("subastas").bulkWrite(ops);
    console.log(`💾 ${allSubastas.length} subastas saved to MongoDB\n`);
  } catch (e) {
    console.log(`⚠️ MongoDB: ${e}\n`);
  }

  // 2. Analyze all with Gemini (parallel batches)
  console.log(`🤖 Analyzing ${allSubastas.length} subastas (${BATCH_SIZE} parallel, 0-100 scale)...\n`);

  // Load existing analyses
  const analysisFile = join(RESULTS_DIR, "analysis.json");
  const allAnalysis: Record<string, AnalysisResult> = {};
  if (existsSync(analysisFile)) {
    try {
      const existing = JSON.parse(readFileSync(analysisFile, "utf-8"));
      for (const a of (Array.isArray(existing) ? existing : Object.values(existing))) {
        allAnalysis[(a as AnalysisResult).subastaId] = a as AnalysisResult;
      }
    } catch { /* ignore */ }
  }

  let totalCost = 0, totalTokens = 0, analyzed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < allSubastas.length; i += BATCH_SIZE) {
    const batch = allSubastas.slice(i, i + BATCH_SIZE);
    const toAnalyze = batch.filter(s => !allAnalysis[s.id]);
    skipped += batch.length - toAnalyze.length;

    if (toAnalyze.length === 0) continue;

    const results = await Promise.allSettled(
      toAnalyze.map(s => analizarSubasta(s, BOE_SESSID))
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const s = toAnalyze[j];
      if (r.status === "fulfilled") {
        allAnalysis[r.value.subastaId] = r.value;
        totalCost += r.value.usage?.costUsd ?? 0;
        totalTokens += r.value.usage?.totalTokens ?? 0;
        analyzed++;
        console.log(`  ✅ ${s.id}: ${r.value.oportunidad}/100 (${r.value.recomendacion}) | ${r.value.usage?.docsAttached ?? 0} docs | $${(r.value.usage?.costUsd ?? 0).toFixed(4)}`);
      } else {
        errors++;
        console.error(`  ❌ ${s.id}: ${r.reason}`);
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

    const done = analyzed + skipped;
    if (done % 20 === 0 || done === allSubastas.length) {
      console.log(`  --- ${done}/${allSubastas.length} | $${totalCost.toFixed(4)} ---\n`);
    }
  }

  // Summary
  const sorted = Object.values(allAnalysis).sort((a, b) => b.oportunidad - a.oportunidad);
  console.log("\n" + "=".repeat(60));
  console.log(`📊 PIPELINE COMPLETE`);
  console.log(`Subastas: ${allSubastas.length} | Analyzed: ${analyzed} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`Cost: $${totalCost.toFixed(4)} | Tokens: ${totalTokens.toLocaleString()}`);
  console.log(`\n🏆 TOP 15:`);
  for (const a of sorted.slice(0, 15)) {
    const sub = allSubastas.find(s => s.id === a.subastaId);
    console.log(`  ${a.oportunidad}/100 (${a.recomendacion}) — ${a.subastaId} — ${sub?.valorSubasta ?? "?"} — ${sub?.provincia ?? "?"} — ${a.usage?.docsAttached ?? 0} docs`);
  }
  console.log("=".repeat(60));

  await client.close();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });

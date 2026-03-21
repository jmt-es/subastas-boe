/**
 * Local pipeline: Scrape active Alicante auctions → Download PDFs → Analyze with Gemini
 *
 * Usage: npx tsx scripts/run-pipeline.ts
 *
 * Requires .env.local with: GEMINI_API_KEY, MONGODB_URI, BOE_SESSID
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
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
const DATA_DIR = join(process.cwd(), "data");
const RESULTS_DIR = join(DATA_DIR, "results");

// Parallel batch size for Gemini analysis
const ANALYSIS_BATCH_SIZE = 5;

function saveLocalJson(filename: string, data: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, filename), JSON.stringify(data, null, 2));
}

async function tryMongoWrite(
  client: MongoClient,
  collection: string,
  ops: { filter: Record<string, unknown>; data: Record<string, unknown> }[]
): Promise<boolean> {
  try {
    const col = client.db(DB_NAME).collection(collection);
    const bulkOps = ops.map((op) => ({
      updateOne: {
        filter: op.filter,
        update: { $set: op.data },
        upsert: true,
      },
    }));
    await col.bulkWrite(bulkOps);
    return true;
  } catch (err) {
    const msg = String(err);
    if (msg.includes("space quota")) {
      console.log("    ⚠️  MongoDB quota exceeded — saving locally only");
      return false;
    }
    throw err;
  }
}

async function main() {
  console.log("🚀 Starting Alicante auction pipeline (parallel mode)\n");

  // 1. Connect to MongoDB
  console.log("📦 Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  let mongoAvailable = true;
  console.log("✅ Connected\n");

  // 2. Scrape active Alicante auctions with session for full access
  console.log("🔍 Scraping active auctions in Alicante (with session)...");
  const subastas = await scrapeSubastas(
    {
      tipoBien: "I",
      estado: "EJ",
      provincia: "03",
      maxPaginas: 0,
      sessionId: BOE_SESSID,
    },
    (progress) => {
      console.log(
        `   Page ${progress.pagina} | Total: ${progress.total ?? "?"} | Processed: ${progress.procesadas} | Current: ${progress.subastaActual}`
      );
    }
  );

  console.log(`\n✅ Scraped ${subastas.length} auctions\n`);

  if (subastas.length === 0) {
    console.log("No auctions found. Exiting.");
    await client.close();
    return;
  }

  // 3. Save subastas locally + MongoDB
  saveLocalJson("subastas.json", subastas);
  console.log(`💾 Saved subastas to data/results/subastas.json`);

  if (mongoAvailable) {
    const ops = subastas.map((s) => ({ filter: { id: s.id }, data: s as unknown as Record<string, unknown> }));
    mongoAvailable = await tryMongoWrite(client, "subastas", ops);
    if (mongoAvailable) console.log(`💾 Saved ${subastas.length} subastas to MongoDB`);
  }
  console.log();

  // 4. Analyze in parallel batches
  console.log(`🤖 Analyzing ${subastas.length} auctions with Gemini (${ANALYSIS_BATCH_SIZE} parallel)...\n`);

  // Load existing analyses
  const analysisFile = join(RESULTS_DIR, "analysis.json");
  let allAnalysis: Record<string, AnalysisResult> = {};
  if (existsSync(analysisFile)) {
    try {
      const existing = JSON.parse(readFileSync(analysisFile, "utf-8"));
      if (Array.isArray(existing)) {
        for (const a of existing) allAnalysis[a.subastaId] = a;
      } else {
        allAnalysis = existing;
      }
    } catch { /* ignore */ }
  }

  let totalCost = 0;
  let totalTokens = 0;
  let analyzed = 0;
  let skipped = 0;
  let errors = 0;

  // Process in parallel batches
  for (let i = 0; i < subastas.length; i += ANALYSIS_BATCH_SIZE) {
    const batch = subastas.slice(i, i + ANALYSIS_BATCH_SIZE);

    const promises = batch.map(async (subasta, batchIdx) => {
      const globalIdx = i + batchIdx + 1;
      const docCount = subasta.documentos?.length ?? 0;

      // Skip if already analyzed
      if (allAnalysis[subasta.id]) {
        console.log(`  [${globalIdx}/${subastas.length}] ${subasta.id} — ⏭️ already done`);
        skipped++;
        return;
      }

      console.log(
        `  [${globalIdx}/${subastas.length}] ${subasta.id} — ${subasta.tipoBienDetalle ?? "N/A"} — ${subasta.valorSubasta ?? "?"} — ${docCount} docs — analyzing...`
      );

      try {
        const analysis = await analizarSubasta(subasta, BOE_SESSID);

        allAnalysis[analysis.subastaId] = analysis;

        const cost = analysis.usage?.costUsd ?? 0;
        const tokens = analysis.usage?.totalTokens ?? 0;
        totalCost += cost;
        totalTokens += tokens;
        analyzed++;

        console.log(
          `    ✅ ${subasta.id}: ${analysis.oportunidad}/10 (${analysis.recomendacion}) | ${analysis.usage?.docsAttached ?? 0} docs | ${tokens} tok | $${cost.toFixed(4)}`
        );

        // Try MongoDB per analysis
        if (mongoAvailable) {
          mongoAvailable = await tryMongoWrite(client, "analysis", [
            { filter: { subastaId: analysis.subastaId }, data: analysis as unknown as Record<string, unknown> },
          ]);
        }
      } catch (err) {
        errors++;
        console.error(`    ❌ ${subasta.id}: ${err}`);
      }
    });

    await Promise.all(promises);

    // Save progress after each batch
    saveLocalJson("analysis.json", Object.values(allAnalysis));

    console.log(`  --- Batch done | ${analyzed + skipped}/${subastas.length} | Cost so far: $${totalCost.toFixed(4)} ---\n`);
  }

  // 5. Summary
  console.log("=".repeat(60));
  console.log("📊 PIPELINE COMPLETE");
  console.log("=".repeat(60));
  console.log(`Auctions scraped:    ${subastas.length}`);
  console.log(`Auctions analyzed:   ${analyzed}`);
  console.log(`Auctions skipped:    ${skipped} (already done)`);
  console.log(`Errors:              ${errors}`);
  console.log(`Total tokens:        ${totalTokens.toLocaleString()}`);
  console.log(`Total cost:          $${totalCost.toFixed(4)}`);
  console.log(`MongoDB available:   ${mongoAvailable ? "yes" : "no (quota exceeded)"}`);
  console.log(`Local data:          data/results/subastas.json, data/results/analysis.json`);

  // Top opportunities
  const sorted = Object.values(allAnalysis).sort((a, b) => b.oportunidad - a.oportunidad);
  console.log("\n🏆 TOP 10 OPORTUNIDADES:");
  for (const a of sorted.slice(0, 10)) {
    const sub = subastas.find(s => s.id === a.subastaId);
    console.log(`  ${a.oportunidad}/10 (${a.recomendacion}) — ${a.subastaId} — ${sub?.valorSubasta ?? "?"} — ${sub?.tipoBienDetalle ?? ""}`);
  }

  console.log("=".repeat(60));
  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

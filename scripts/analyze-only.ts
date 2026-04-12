/**
 * Analyze-only: reads saved subastas.json, runs Gemini in parallel, saves to MongoDB
 * Usage:
 *   npx tsx scripts/analyze-only.ts
 *   npx tsx scripts/analyze-only.ts --force
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
if (process.env.SUBASTA_EXTRA_ENV_FILE) {
  config({ path: resolve(process.env.SUBASTA_EXTRA_ENV_FILE), override: false });
}

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { MongoClient, type Collection } from "mongodb";
import { analizarSubasta } from "../src/lib/gemini";
import { getUsableBoeSession } from "../src/lib/boe-session-runtime";
import type { Subasta } from "../src/lib/scraper";
import type { AnalysisResult } from "../src/lib/storage";
import { saveSnapshotToBlob } from "../src/lib/result-snapshots";

const MONGODB_URI = process.env.MONGODB_URI!;
const RESULTS_DIR = join(process.cwd(), "data", "results");
const DEFAULT_BATCH_SIZE = 5;
const ANALYSIS_TIMEOUT_MS = 180_000;

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getBatchSize(): number {
  const batchArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
  const raw = batchArg?.split("=", 2)[1];
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_BATCH_SIZE;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number = ANALYSIS_TIMEOUT_MS
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function tryBulkWriteAnalysis(
  analysisCol: Collection<AnalysisResult>,
  analyses: AnalysisResult[]
): Promise<boolean> {
  if (analyses.length === 0) return true;

  try {
    const ops = analyses.map((analysis) => ({
      updateOne: {
        filter: { subastaId: analysis.subastaId },
        update: { $set: analysis },
        upsert: true,
      },
    }));
    await analysisCol.bulkWrite(ops);
    return true;
  } catch (err) {
    if (String(err).includes("space quota")) {
      console.log("⚠️ MongoDB quota exceeded — continuing with local analysis cache only\n");
      return false;
    }
    throw err;
  }
}

async function main() {
  const force = hasFlag("--force");
  const batchSize = getBatchSize();

  // Load saved subastas
  const subastas: Subasta[] = JSON.parse(readFileSync(join(RESULTS_DIR, "subastas.json"), "utf-8"));
  console.log(`📋 ${subastas.length} subastas loaded\n`);

  // Connect to MongoDB
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("subastas_boe");
  const analysisCol = db.collection<AnalysisResult>("analysis");
  let mongoAvailable = true;
  const session = await getUsableBoeSession();

  // Load existing analyses
  const allAnalysis: Record<string, AnalysisResult> = {};
  const analysisFile = join(RESULTS_DIR, "analysis.json");
  if (force) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(analysisFile, JSON.stringify([], null, 2));
  }
  if (!force && existsSync(analysisFile)) {
    try {
      const existing = JSON.parse(readFileSync(analysisFile, "utf-8"));
      for (const a of (Array.isArray(existing) ? existing : Object.values(existing))) {
        allAnalysis[(a as AnalysisResult).subastaId] = a as AnalysisResult;
      }
    } catch { /* ignore */ }
  }

  if (force) {
    await analysisCol.deleteMany({});
  }

  if (!force && mongoAvailable && Object.keys(allAnalysis).length > 0) {
    mongoAvailable = await tryBulkWriteAnalysis(analysisCol, Object.values(allAnalysis));
    if (mongoAvailable) {
      console.log(`💾 Rehydrated ${Object.keys(allAnalysis).length} existing analyses into MongoDB\n`);
    }
  }

  let totalCost = 0, totalTokens = 0, analyzed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < subastas.length; i += batchSize) {
    const batch = subastas.slice(i, i + batchSize);
    const toAnalyze = batch.filter(s => !allAnalysis[s.id]);
    const skipCount = batch.length - toAnalyze.length;
    skipped += skipCount;

    if (toAnalyze.length === 0) {
      console.log(`  Batch ${Math.floor(i / batchSize) + 1}: all ${batch.length} already done, skipping`);
      continue;
    }

    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: analyzing ${toAnalyze.length} (${skipCount} skipped)...`);

    const results = await Promise.allSettled(
      toAnalyze.map(async (subasta) => {
        const analysis = await withTimeout(
          analizarSubasta(subasta, session.sessId),
          `analysis ${subasta.id}`
        );
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
    await saveSnapshotToBlob("analysis", Object.values(allAnalysis)).catch(() => {});

    // Batch write to MongoDB
    try {
      if (mongoAvailable) {
        mongoAvailable = await tryBulkWriteAnalysis(
          analysisCol,
          results
            .filter((r): r is PromiseFulfilledResult<{subasta: Subasta; analysis: AnalysisResult}> => r.status === "fulfilled")
            .map((r) => r.value.analysis)
        );
      }
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
  console.log(`💾 MongoDB: ${mongoAvailable ? "updated" : "quota exceeded, local cache only"}`);
  console.log("\n🏆 TOP 10:");
  for (const a of sorted.slice(0, 10)) {
    const sub = subastas.find(s => s.id === a.subastaId);
    console.log(`  ${a.oportunidad}/10 (${a.recomendacion}) — ${a.subastaId} — ${sub?.valorSubasta ?? "?"}`);
  }
  console.log("=".repeat(60));

  await client.close();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });

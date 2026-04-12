/**
 * Scrape multiple provinces + prewarm PDFs + analyze all with Gemini.
 *
 * Usage:
 *   npx tsx scripts/scrape-all.ts
 *   npx tsx scripts/scrape-all.ts --force-reanalyze
 *
 * Env: .env.local with GEMINI_API_KEY, MONGODB_URI and BOE session or BOE_LOGIN_* + Gmail.
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
if (process.env.SUBASTA_EXTRA_ENV_FILE) {
  config({ path: resolve(process.env.SUBASTA_EXTRA_ENV_FILE), override: false });
}

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { MongoClient } from "mongodb";
import { scrapeSubastas, type Subasta } from "../src/lib/scraper";
import { analizarSubasta } from "../src/lib/gemini";
import { getUsableBoeSession } from "../src/lib/boe-session-runtime";
import {
  ensureSubastaDocumentsStored,
  isBlobStorageConfigured,
} from "../src/lib/document-storage";
import { saveSnapshotToBlob } from "../src/lib/result-snapshots";
import type { AnalysisResult } from "../src/lib/storage";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "subastas_boe";
const RESULTS_DIR = join(process.cwd(), "data", "results");
const DEFAULT_ANALYSIS_BATCH_SIZE = 5;
const DOC_BATCH_SIZE = 5;
const ANALYSIS_TIMEOUT_MS = 180_000;

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getAnalysisBatchSize(): number {
  const batchArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
  const raw = batchArg?.split("=", 2)[1];
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_ANALYSIS_BATCH_SIZE;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ANALYSIS_BATCH_SIZE;
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

async function main() {
  const forceReanalyze = hasFlag("--force-reanalyze");
  const skipDocWarm = hasFlag("--skip-doc-warm");
  const analysisBatchSize = getAnalysisBatchSize();
  const storageLabel = isBlobStorageConfigured()
    ? "Vercel Blob (private)"
    : "cache local + Mongo gzip";

  console.log("🚀 Multi-province pipeline\n");
  console.log(`📍 Provinces: ${PROVINCES.map(p => p.name).join(", ")}\n`);
  console.log(`📦 Document storage: ${storageLabel}`);
  console.log(`🧠 Reanalysis mode: ${forceReanalyze ? "full refresh" : "incremental"}\n`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const session = await getUsableBoeSession();

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
          sessionId: session.sessId,
          simpleSaml: session.simpleSaml,
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
  await saveSnapshotToBlob("subastas", allSubastas).catch(() => {});

  // Save to MongoDB
  try {
    // Clear old data first
    await db.collection("subastas").deleteMany({});
    if (forceReanalyze) {
      await db.collection("analysis").deleteMany({});
    }
    const ops = allSubastas.map(s => ({
      updateOne: { filter: { id: s.id }, update: { $set: s }, upsert: true }
    }));
    if (ops.length > 0) await db.collection("subastas").bulkWrite(ops);
    console.log(`💾 ${allSubastas.length} subastas saved to MongoDB\n`);
  } catch (e) {
    console.log(`⚠️ MongoDB: ${e}\n`);
  }

  if (!skipDocWarm && totalDocs > 0) {
    console.log(`📎 Precargando ${totalDocs} documentos en ${storageLabel}...\n`);

    let docsReady = 0;
    let docsFailed = 0;
    let docsBytes = 0;
    const withDocs = allSubastas.filter((subasta) => (subasta.documentos?.length ?? 0) > 0);

    for (let i = 0; i < withDocs.length; i += DOC_BATCH_SIZE) {
      const batch = withDocs.slice(i, i + DOC_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((subasta) => ensureSubastaDocumentsStored(subasta, session))
      );

      for (const result of results) {
        docsReady += result.ready;
        docsFailed += result.failed;
        docsBytes += result.bytes;
      }

      console.log(
        `  📎 ${Math.min(i + DOC_BATCH_SIZE, withDocs.length)}/${withDocs.length} subastas con docs | ${docsReady} docs listos | ${docsFailed} fallidos`
      );
    }

    console.log(
      `\n✅ Documentos precargados: ${docsReady} ok, ${docsFailed} fallidos, ${(docsBytes / 1024 / 1024).toFixed(1)} MB\n`
    );
  }

  // 2. Analyze all with Gemini (parallel batches)
  console.log(`🤖 Analyzing ${allSubastas.length} subastas (${analysisBatchSize} parallel, 0-100 scale)...\n`);

  // Load existing analyses
  const analysisFile = join(RESULTS_DIR, "analysis.json");
  const allAnalysis: Record<string, AnalysisResult> = {};
  if (forceReanalyze) {
    saveJson("analysis.json", []);
  }
  if (!forceReanalyze && existsSync(analysisFile)) {
    try {
      const existing = JSON.parse(readFileSync(analysisFile, "utf-8"));
      for (const a of (Array.isArray(existing) ? existing : Object.values(existing))) {
        allAnalysis[(a as AnalysisResult).subastaId] = a as AnalysisResult;
      }
    } catch { /* ignore */ }
  }

  if (!forceReanalyze && Object.keys(allAnalysis).length > 0) {
    try {
      const ops = Object.values(allAnalysis).map((analysis) => ({
        updateOne: {
          filter: { subastaId: analysis.subastaId },
          update: { $set: analysis },
          upsert: true,
        },
      }));
      if (ops.length > 0) {
        await db.collection("analysis").bulkWrite(ops);
        console.log(`💾 Rehydrated ${ops.length} existing analyses into MongoDB\n`);
      }
    } catch {
      // ignore Mongo rehydration errors
    }
  }

  let totalCost = 0, totalTokens = 0, analyzed = 0, skipped = 0, errors = 0;

  for (let i = 0; i < allSubastas.length; i += analysisBatchSize) {
    const batch = allSubastas.slice(i, i + analysisBatchSize);
    const toAnalyze = batch.filter(s => !allAnalysis[s.id]);
    skipped += batch.length - toAnalyze.length;

    if (toAnalyze.length === 0) continue;

    const results = await Promise.allSettled(
      toAnalyze.map((subasta) =>
        withTimeout(
          analizarSubasta(subasta, session.sessId),
          `analysis ${subasta.id}`
        )
      )
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
    await saveSnapshotToBlob("analysis", Object.values(allAnalysis)).catch(() => {});

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

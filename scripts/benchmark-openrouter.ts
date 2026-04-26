/**
 * Benchmark: Compare Gemini Flash-Lite vs GPT-4.1-mini (OpenRouter)
 * on the same subastas with the same prompt.
 *
 * Usage: npx tsx scripts/benchmark-openrouter.ts [--count=10]
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import type { Subasta } from "../src/lib/scraper";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY?.trim();
const TIMEOUT_MS = 180_000;

interface ExistingAnalysis {
  subastaId: string;
  oportunidad?: number;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
  usage?: unknown;
}

interface ModelResult {
  oportunidad?: number | string;
  error?: string;
  _usage?: unknown;
  _model?: string;
  [key: string]: unknown;
}

function getCount(): number {
  const arg = process.argv.find((a) => a.startsWith("--count="));
  const n = arg ? Number.parseInt(arg.split("=")[1], 10) : 10;
  return Number.isFinite(n) && n > 0 ? n : 10;
}

// We need to replicate the prompt-building logic from gemini.ts
function buildDataSections(subasta: Subasta): string {
  const field = (label: string, value?: string | null) =>
    value && value !== "No disponible" && value !== "no consta"
      ? `- ${label}: ${value}`
      : null;

  const sections: string[] = [];
  sections.push("## DATOS GENERALES DE LA SUBASTA");
  sections.push([
    field("Identificador", subasta.identificador || subasta.id),
    field("Estado", subasta.estado),
    field("Tipo de subasta", subasta.tipoSubasta),
    field("Anuncio BOE", subasta.anuncioBOE),
    field("Fecha inicio", subasta.fechaInicio),
    field("Fecha conclusión", subasta.fechaConclusion),
    field("Lotes", subasta.lotes),
  ].filter(Boolean).join("\n"));

  sections.push("\n## DATOS ECONÓMICOS");
  sections.push([
    field("Valor subasta", subasta.valorSubasta),
    field("Tasación", subasta.tasacion),
    field("Puja mínima", subasta.pujaMinima),
    field("Puja actual", subasta.pujActual),
    field("Tramos entre pujas", subasta.tramosEntrePujas),
    field("Importe depósito", subasta.importeDeposito),
    field("Cantidad reclamada", subasta.cantidadReclamada),
  ].filter(Boolean).join("\n"));

  sections.push("\n## DESCRIPCIÓN DEL BIEN");
  sections.push([
    field("Tipo de bien", subasta.tipoBienDetalle),
    field("Descripción completa", subasta.descripcion),
    field("Dirección", subasta.direccion),
    field("Código postal", subasta.codigoPostal),
    field("Localidad", subasta.localidad),
    field("Provincia", subasta.provincia),
    field("Vivienda habitual", subasta.viviendaHabitual),
    field("Situación posesoria", subasta.situacionPosesoria),
    field("Visitable", subasta.visitable),
    field("Referencia catastral", subasta.referenciaCatastral),
    field("Cargas", subasta.cargas),
    field("Información adicional", subasta.infoAdicional),
  ].filter(Boolean).join("\n"));

  if (subasta.acreedor) {
    sections.push("\n## ACREEDOR");
    sections.push([
      field("Nombre", subasta.acreedor.nombre),
      field("NIF", subasta.acreedor.nif),
      field("Localidad", subasta.acreedor.localidad),
      field("Provincia", subasta.acreedor.provincia),
    ].filter(Boolean).join("\n"));
  }

  if (subasta.documentos && subasta.documentos.length > 0) {
    sections.push("\n## DOCUMENTOS DISPONIBLES");
    sections.push(subasta.documentos.map((d) => `- ${d.titulo}`).join("\n"));
  }

  return sections.join("\n");
}

// Import the prompt from gemini.ts (we'll read it to get the current version)
function buildPrompt(subasta: Subasta): string {
  const data = buildDataSections(subasta);
  const numDocs = subasta.documentos?.length || 0;
  const hasCertCargas = subasta.documentos?.some(
    (d) => d.titulo.toLowerCase().includes("carga") || d.titulo.toLowerCase().includes("certificac")
  );
  const hasEdicto = subasta.documentos?.some((d) => d.titulo.toLowerCase().includes("edicto"));

  const geminiSource = readFileSync(
    resolve(process.cwd(), "src/lib/gemini.ts"),
    "utf-8"
  );

  // Extract the template between the return backtick and the closing backtick
  const match = geminiSource.match(/return `([\s\S]*?)`;\s*\n\}/);
  if (!match) throw new Error("Could not extract prompt from gemini.ts");

  let template = match[1];
  // Replace template literals
  template = template.replace(/\$\{numDocs > 0 \?[\s\S]*?\}/m,
    numDocs > 0
      ? `Hay ${numDocs} documento(s) descargables. Tenerlos es POSITIVO — reduce incertidumbre. ${hasCertCargas ? "TIENE CERTIFICADO DE CARGAS — puedes verificar cargas reales, no suponer." : ""} ${hasEdicto ? "TIENE EDICTO — puedes extraer datos procesales concretos." : ""}`
      : "No hay documentos disponibles — esto AUMENTA el riesgo."
  );
  template = template.replace("${data}", data);

  return template;
}

async function callOpenRouter(prompt: string, model: string): Promise<ModelResult> {
  if (!OPENROUTER_KEY) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    const json = (await resp.json()) as OpenRouterResponse;
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));

    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage || {};

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]) as ModelResult;
    return { ...parsed, _usage: usage, _model: model };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const count = getCount();
  console.log(`\n🔬 Comparing models on ${count} subastas\n`);

  // Fetch data
  const response = await fetch("https://subastas-boe.vercel.app/api/subastas?all=1&limit=200");
  const json = (await response.json()) as { subastas?: Subasta[] } | Subasta[];
  const allSubastas = Array.isArray(json) ? json : json.subastas || [];

  const analysisResp = await fetch("https://subastas-boe.vercel.app/api/analysis?all=1");
  const analysisJson = (await analysisResp.json()) as
    | { analyses?: ExistingAnalysis[] }
    | ExistingAnalysis[];
  const oldMap = new Map<string, ExistingAnalysis>();
  const analyses = Array.isArray(analysisJson) ? analysisJson : analysisJson.analyses || [];
  for (const analysis of analyses) oldMap.set(analysis.subastaId, analysis);

  // Pick diverse sample
  const withAnalysis = allSubastas.filter(s => oldMap.has(s.id));
  const step = Math.max(1, Math.floor(withAnalysis.length / count));
  const sample: Subasta[] = [];
  for (let i = 0; i < withAnalysis.length && sample.length < count; i += step) {
    sample.push(withAnalysis[i]);
  }

  const models = [
    "openai/gpt-4.1-mini",
    "openai/gpt-5.4-mini",
  ];

  console.log(`Models: ${models.join(", ")}`);
  console.log(`Sample: ${sample.length} subastas\n`);

  console.log("ID".padEnd(30) + "OLD".padStart(5) + models.map(m => m.split("/")[1].padStart(12)).join(""));
  console.log("─".repeat(30 + 5 + models.length * 12));

  const results: Array<Record<string, number | string | undefined>> = [];

  for (const subasta of sample) {
    const prompt = buildPrompt(subasta);
    const oldScore = oldMap.get(subasta.id)?.oportunidad || "?";

    const modelResults: Record<string, ModelResult> = {};

    // Run all models in parallel
    const promises = models.map(async (model) => {
      try {
        const result = await callOpenRouter(prompt, model);
        modelResults[model] = result;
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠️  ${model}: ${message.slice(0, 100)}`);
        modelResults[model] = { error: message, oportunidad: "ERR" };
        return null;
      }
    });

    await Promise.all(promises);

    const line = subasta.id.padEnd(30) + String(oldScore).padStart(5) +
      models.map(m => {
        const r = modelResults[m];
        return String(r?.oportunidad || "ERR").padStart(12);
      }).join("");
    console.log(line);

    results.push({
      id: subasta.id,
      oldScore,
      ...Object.fromEntries(models.map(m => [m.split("/")[1], modelResults[m]?.oportunidad]))
    });
  }

  // Summary
  console.log("\n" + "═".repeat(70));
  console.log("📊 SCORE DISTRIBUTIONS\n");

  for (const model of models) {
    const key = model.split("/")[1];
    const scores = results.map(r => r[key]).filter(s => typeof s === "number");
    const unique = new Set(scores);
    const dist = new Map<number, number>();
    for (const s of scores) dist.set(s, (dist.get(s) || 0) + 1);

    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    console.log(`${key}: ${scores.length} scored, ${unique.size} unique values, avg=${avg.toFixed(1)}`);
    for (const [k, v] of [...dist.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  ${k}: ${v} ${"█".repeat(v * 3)}`);
    }
    console.log();
  }

  const outputPath = resolve(process.cwd(), "data", "benchmark-openrouter.json");
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  writeFileSync(
    outputPath,
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
  console.log(`💾 Saved to ${outputPath}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

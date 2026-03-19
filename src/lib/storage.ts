import { promises as fs } from "fs";
import path from "path";
import type { Subasta } from "./scraper";

const DATA_DIR = path.join(process.cwd(), "data");
const SUBASTAS_FILE = path.join(DATA_DIR, "subastas.json");
const ANALYSIS_DIR = path.join(DATA_DIR, "analysis");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function getSubastas(): Promise<Subasta[]> {
  try {
    const data = await fs.readFile(SUBASTAS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveSubastas(subastas: Subasta[]): Promise<void> {
  await ensureDir(DATA_DIR);
  await fs.writeFile(SUBASTAS_FILE, JSON.stringify(subastas, null, 2), "utf-8");
}

export async function addSubastas(nuevas: Subasta[]): Promise<Subasta[]> {
  const existentes = await getSubastas();
  const idsExistentes = new Set(existentes.map((s) => s.id));
  const nuevasUnicas = nuevas.filter((s) => !idsExistentes.has(s.id));
  const todas = [...nuevasUnicas, ...existentes];
  await saveSubastas(todas);
  return todas;
}

export async function getSubasta(id: string): Promise<Subasta | null> {
  const subastas = await getSubastas();
  return subastas.find((s) => s.id === id) || null;
}

export interface AnalysisResult {
  subastaId: string;
  oportunidad: number;
  riesgos: string[];
  resumen: string;
  recomendacion: "comprar" | "observar" | "descartar";
  detalles: string;
  analyzedAt: string;
}

export async function saveAnalysis(analysis: AnalysisResult): Promise<void> {
  await ensureDir(ANALYSIS_DIR);
  const filePath = path.join(
    ANALYSIS_DIR,
    `${analysis.subastaId.replace(/[^a-zA-Z0-9-]/g, "_")}.json`
  );
  await fs.writeFile(filePath, JSON.stringify(analysis, null, 2), "utf-8");
}

export async function getAnalysis(
  subastaId: string
): Promise<AnalysisResult | null> {
  try {
    const filePath = path.join(
      ANALYSIS_DIR,
      `${subastaId.replace(/[^a-zA-Z0-9-]/g, "_")}.json`
    );
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

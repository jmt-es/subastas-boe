import { scrapeSubastas, type Subasta } from "./scraper";
import { getSubastasCollection } from "./mongodb";
import { getUsableBoeSession } from "./boe-session-runtime";

export const DEFAULT_REFRESH_PROVINCES = [
  { code: "03", name: "Alicante" },
  { code: "30", name: "Murcia" },
  { code: "02", name: "Albacete" },
  { code: "46", name: "Valencia" },
] as const;

export interface RefreshActiveSubastasOptions {
  provinceCodes?: string[];
  maxPaginas?: number;
  onProgress?: (message: string) => void;
  forceFreshSession?: boolean;
}

export interface RefreshActiveSubastasResult {
  provinces: Array<{
    code: string;
    name: string;
    count: number;
  }>;
  total: number;
}

async function saveToMongo(subastas: Subasta[]) {
  if (subastas.length === 0) return;
  const col = await getSubastasCollection();
  const ops = subastas.map((subasta) => ({
    updateOne: {
      filter: { id: subasta.id },
      update: { $set: subasta },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops);
}

export async function refreshActiveSubastas(
  options: RefreshActiveSubastasOptions = {}
): Promise<RefreshActiveSubastasResult> {
  const selected = DEFAULT_REFRESH_PROVINCES.filter(
    (province) =>
      !options.provinceCodes?.length || options.provinceCodes.includes(province.code)
  );

  const session = await getUsableBoeSession({}, { forceFresh: options.forceFreshSession });
  const provinces: RefreshActiveSubastasResult["provinces"] = [];
  let total = 0;

  for (const province of selected) {
    options.onProgress?.(`Scrape ${province.name} (${province.code})`);
    const subastas = await scrapeSubastas({
      tipoBien: "I",
      estado: "EJ",
      provincia: province.code,
      maxPaginas: options.maxPaginas ?? 0,
      sessionId: session.sessId,
      simpleSaml: session.simpleSaml,
    });
    await saveToMongo(subastas);
    provinces.push({
      code: province.code,
      name: province.name,
      count: subastas.length,
    });
    total += subastas.length;
  }

  return { provinces, total };
}

import { PROVINCIAS, scrapeSubastas, type Subasta } from "./scraper";
import { getSubastasCollection } from "./mongodb";
import { getUsableBoeSession } from "./boe-session-runtime";

export const DEFAULT_REFRESH_PROVINCES = [
  { code: "03", name: "Alicante" },
  { code: "30", name: "Murcia" },
  { code: "02", name: "Albacete" },
  { code: "46", name: "Valencia" },
] as const;

export const ALL_REFRESH_PROVINCES = Object.entries(PROVINCIAS)
  .filter(([code]) => code !== "")
  .map(([code, name]) => ({ code, name }))
  .sort(
    (left, right) =>
      Number.parseInt(left.code, 10) - Number.parseInt(right.code, 10)
  );

export interface RefreshActiveSubastasOptions {
  provinceCodes?: string[];
  provinces?: Array<{ code: string; name: string }>;
  maxPaginas?: number;
  maxDetails?: number;
  onProgress?: (message: string) => void;
  forceFreshSession?: boolean;
  skipFreshHours?: number;
}

export interface RefreshActiveSubastasResult {
  provinces: Array<{
    code: string;
    name: string;
    count: number;
    skippedFresh?: number;
  }>;
  total: number;
  skippedFresh: number;
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

async function getFreshSubastaIds(skipFreshHours: number | undefined): Promise<Set<string>> {
  if (!skipFreshHours || skipFreshHours <= 0) return new Set();

  const cutoff = new Date(Date.now() - skipFreshHours * 60 * 60 * 1000).toISOString();
  const col = await getSubastasCollection();
  const docs = await col
    .find({ scrapedAt: { $gte: cutoff } }, { projection: { _id: 0, id: 1 } })
    .toArray();

  return new Set(
    docs
      .map((doc) => (typeof doc.id === "string" ? doc.id : ""))
      .filter(Boolean)
  );
}

export async function refreshActiveSubastas(
  options: RefreshActiveSubastasOptions = {}
): Promise<RefreshActiveSubastasResult> {
  const provincePool = options.provinces ?? DEFAULT_REFRESH_PROVINCES;
  const selected = provincePool.filter(
    (province) =>
      !options.provinceCodes?.length || options.provinceCodes.includes(province.code)
  );

  const session = await getUsableBoeSession({}, { forceFresh: options.forceFreshSession });
  const freshIds = await getFreshSubastaIds(options.skipFreshHours);
  const provinces: RefreshActiveSubastasResult["provinces"] = [];
  let total = 0;
  let skippedFresh = 0;

  for (const province of selected) {
    options.onProgress?.(`Scrape ${province.name} (${province.code})`);
    let provinceSkippedFresh = 0;
    const subastas = await scrapeSubastas({
      tipoBien: "I",
      estado: "EJ",
      provincia: province.code,
      maxPaginas: options.maxPaginas ?? 0,
      maxDetails: options.maxDetails ?? 0,
      sessionId: session.sessId,
      simpleSaml: session.simpleSaml,
      shouldSkipSubasta: (id) => {
        const skip = freshIds.has(id);
        if (skip) {
          provinceSkippedFresh += 1;
          skippedFresh += 1;
        }
        return skip;
      },
    });
    await saveToMongo(subastas);
    provinces.push({
      code: province.code,
      name: province.name,
      count: subastas.length,
      skippedFresh: provinceSkippedFresh,
    });
    total += subastas.length;
  }

  return { provinces, total, skippedFresh };
}

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import {
  ALL_REFRESH_PROVINCES,
  refreshActiveSubastas,
} from "../src/lib/subasta-refresh";
import { saveSubastaRefreshStatus } from "../src/lib/subasta-refresh-status";
import getMongoClient from "../src/lib/mongodb";

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseProvinceCodes(raw: string | undefined): string[] {
  if (!raw?.trim()) return ALL_REFRESH_PROVINCES.map((province) => province.code);
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNonNegativeInteger(name: string, fallback: number): number {
  const raw = getArgValue(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function main() {
  const provinceCodes = parseProvinceCodes(getArgValue("provinces"));
  const maxPaginas = parseNonNegativeInteger("max-paginas", 0);
  const maxDetails = parseNonNegativeInteger("max-details", 0);
  const skipFreshHours = parseNonNegativeInteger("skip-fresh-hours", 0);
  const forceFreshSession = process.argv.includes("--force-fresh-session");
  const selected = ALL_REFRESH_PROVINCES.filter((province) =>
    provinceCodes.includes(province.code)
  );

  console.log("Refresh active BOE subastas");
  console.log(`Provinces: ${selected.map((province) => `${province.name} (${province.code})`).join(", ")}`);
  console.log(`maxPaginas: ${maxPaginas === 0 ? "all" : maxPaginas}`);
  console.log(`maxDetails: ${maxDetails === 0 ? "unlimited" : maxDetails}`);
  console.log(`skipFreshHours: ${skipFreshHours}`);
  console.log("");

  const startedAt = Date.now();
  let total = 0;
  let skippedFresh = 0;

  for (const province of selected) {
    const provinceStartedAt = new Date().toISOString();
    const provinceStartedTs = Date.now();
    console.log(`\n== ${province.name} (${province.code}) ==`);

    await saveSubastaRefreshStatus({
      provinceCode: province.code,
      provinceName: province.name,
      status: "running",
      source: "admin",
      executionRegion: "local",
      maxPaginas,
      maxDetails,
      forceFresh: forceFreshSession,
      startedAt: provinceStartedAt,
    });

    try {
      const result = await refreshActiveSubastas({
        provinces: ALL_REFRESH_PROVINCES,
        provinceCodes: [province.code],
        maxPaginas,
        maxDetails,
        skipFreshHours,
        forceFreshSession,
        onProgress: (message) => console.log(message),
      });
      const summary = result.provinces[0] || {
        code: province.code,
        name: province.name,
        count: 0,
        skippedFresh: 0,
      };

      total += summary.count;
      skippedFresh += summary.skippedFresh ?? 0;
      await saveSubastaRefreshStatus({
        provinceCode: province.code,
        provinceName: province.name,
        status: "success",
        source: "admin",
        executionRegion: "local",
        maxPaginas,
        maxDetails,
        forceFresh: forceFreshSession,
        startedAt: provinceStartedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - provinceStartedTs,
        count: summary.count,
        skippedFresh: summary.skippedFresh ?? 0,
      });

      console.log(
        `OK ${province.name}: ${summary.count} refreshed, ${summary.skippedFresh ?? 0} skipped fresh`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await saveSubastaRefreshStatus({
        provinceCode: province.code,
        provinceName: province.name,
        status: "error",
        source: "admin",
        executionRegion: "local",
        maxPaginas,
        maxDetails,
        forceFresh: forceFreshSession,
        startedAt: provinceStartedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - provinceStartedTs,
        error: message,
      });
      console.error(`ERROR ${province.name}: ${message}`);
    }
  }

  console.log("");
  console.log(
    JSON.stringify(
      {
        total,
        skippedFresh,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        provinces: selected.length,
      },
      null,
      2
    )
  );
}

async function closeMongoConnection() {
  try {
    const client = await getMongoClient();
    await client.close();
  } catch {
    // The script can fail before Mongo is initialized.
  }
}

main()
  .then(closeMongoConnection)
  .catch(async (error) => {
    console.error(error);
    await closeMongoConnection();
    process.exit(1);
  });

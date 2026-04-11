import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import {
  DEFAULT_REFRESH_PROVINCES,
  refreshActiveSubastas,
} from "../src/lib/subasta-refresh";

function parseProvinceCodes(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function main() {
  const provinceCodes =
    parseProvinceCodes(process.argv[2]) || DEFAULT_REFRESH_PROVINCES.map((p) => p.code);

  const startedAt = Date.now();
  const result = await refreshActiveSubastas({
    provinceCodes,
    onProgress: (message) => console.log(`• ${message}`),
  });

  console.log(
    JSON.stringify(
      {
        total: result.total,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        provinces: result.provinces,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

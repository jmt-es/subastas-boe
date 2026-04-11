import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { getSubastasCollection } from "../src/lib/mongodb";
import { parseBoeDateToIso } from "../src/lib/subasta-dates";

async function main() {
  const col = await getSubastasCollection();
  const rows = await col
    .find(
      {
        $or: [
          { fechaInicio: { $exists: true }, fechaInicioAt: { $exists: false } },
          {
            fechaConclusion: { $exists: true },
            fechaConclusionAt: { $exists: false },
          },
        ],
      },
      {
        projection: {
          id: 1,
          fechaInicio: 1,
          fechaConclusion: 1,
        },
      }
    )
    .toArray();

  if (rows.length === 0) {
    console.log("No hay subastas pendientes de backfill.");
    return;
  }

  const ops = rows.map((row) => ({
    updateOne: {
      filter: { _id: row._id },
      update: {
        $set: {
          ...(row.fechaInicio
            ? { fechaInicioAt: parseBoeDateToIso(String(row.fechaInicio)) }
            : {}),
          ...(row.fechaConclusion
            ? {
                fechaConclusionAt: parseBoeDateToIso(
                  String(row.fechaConclusion)
                ),
              }
            : {}),
        },
      },
    },
  }));

  const result = await col.bulkWrite(ops);
  console.log(
    JSON.stringify(
      {
        matched: result.matchedCount,
        modified: result.modifiedCount,
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

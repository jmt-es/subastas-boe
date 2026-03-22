import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI!;
  console.log("URI:", uri.replace(/:[^:@]+@/, ":***@"));

  const client = new MongoClient(uri);
  await client.connect();

  // List all databases
  const dbs = await client.db().admin().listDatabases();
  console.log("\n=== DATABASES ===");
  for (const db of dbs.databases) {
    console.log(`  ${db.name}: ${((db.sizeOnDisk ?? 0) / 1024 / 1024).toFixed(1)} MB`);
  }

  // Check subastas_boe specifically
  const db = client.db("subastas_boe");
  const collections = await db.listCollections().toArray();
  console.log("\n=== subastas_boe collections ===");
  console.log(collections.length === 0 ? "  (empty - no collections)" : collections.map(c => `  ${c.name}`).join("\n"));

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`  ${col.name}: ${count} docs`);
  }

  await client.close();
}

main().catch(console.error);

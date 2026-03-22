import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { MongoClient } from "mongodb";

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db("subastas_boe");

  // Count before
  for (const name of ["subastas", "analysis", "documents"]) {
    const count = await db.collection(name).countDocuments();
    console.log(`${name}: ${count} docs`);
  }

  // Drop documents collection (PDFs now stored locally)
  console.log("\n🗑️  Dropping documents collection (PDFs moving to local)...");
  await db.collection("documents").drop();
  console.log("✅ documents dropped");

  // Clear subastas and analysis for fresh data
  console.log("🗑️  Clearing subastas...");
  const subResult = await db.collection("subastas").deleteMany({});
  console.log(`✅ Deleted ${subResult.deletedCount} subastas`);

  console.log("🗑️  Clearing analysis...");
  const anaResult = await db.collection("analysis").deleteMany({});
  console.log(`✅ Deleted ${anaResult.deletedCount} analyses`);

  // Verify
  console.log("\n=== After cleanup ===");
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`  ${col.name}: ${count} docs`);
  }

  await client.close();
  console.log("\n✅ MongoDB cleaned. Ready for fresh pipeline data.");
}

main().catch(console.error);

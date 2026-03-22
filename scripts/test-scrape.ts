import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { scrapeSubastas } from "../src/lib/scraper";

async function main() {
  // Try without session first
  console.log("Testing scraper without session (Alicante, active)...");
  const subastas = await scrapeSubastas({
    tipoBien: "I",
    estado: "EJ",
    provincia: "03",
    maxPaginas: 1,
  }, (p) => console.log("progress:", JSON.stringify(p)));

  console.log("Found:", subastas.length);
  if (subastas.length > 0) {
    console.log("First:", subastas[0].id, subastas[0].tipoBienDetalle, subastas[0].valorSubasta);
    console.log("Docs:", subastas[0].documentos?.length ?? 0);
  }
}

main().catch(console.error);

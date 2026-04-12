import { homedir, tmpdir } from "os";
import { join } from "path";

const DEFAULT_PDF_CACHE_DIR = process.env.VERCEL
  ? join(tmpdir(), "subasta-boe", "pdfs")
  : join(homedir(), ".subasta-boe", "pdfs");

export const PDF_CACHE_DIR =
  process.env.SUBASTA_PDF_CACHE_DIR || DEFAULT_PDF_CACHE_DIR;

export function getPdfCachePath(subastaId: string, url: string): string {
  const filename = url.replace(/[^a-zA-Z0-9]/g, "_").slice(-80) + ".pdf";
  return join(PDF_CACHE_DIR, subastaId, filename);
}

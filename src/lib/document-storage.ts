import { createHash } from "crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { get, put, type PutBlobResult } from "@vercel/blob";
import { Binary } from "mongodb";

import type { Documento, Subasta } from "./scraper";
import { getDocumentsCollection, getSubastasCollection } from "./mongodb";
import { getPdfCachePath } from "./pdf-cache";
import { buildBoeCookieHeader, type BoeSession, withBoeRegUrl } from "./boe-session";

const BOE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/pdf,*/*",
};

const DOCUMENTS_API_PREFIX = "/api/documents";
const LOCAL_RESULTS_DIR = join(process.cwd(), "data", "results");

export interface StoredDocumentRecord {
  url: string;
  subastaId?: string;
  titulo?: string;
  provider?: "vercel_blob" | "mongodb_gzip";
  pathname?: string;
  blobUrl?: string;
  downloadUrl?: string;
  contentType?: string;
  sizeBytes?: number;
  compressedBytes?: number;
  downloadedAt?: string;
  lastVerifiedAt?: string;
  gzipData?: Binary;
}

export interface EnsureDocumentsResult {
  total: number;
  ready: number;
  failed: number;
  bytes: number;
}

function getBlobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(getBlobToken());
}

export function isValidPdfBuffer(buf: Buffer): boolean {
  return (
    buf.length > 500 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  );
}

function slugifyTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildBlobPathname(subastaId: string, url: string, titulo: string): string {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const slug = slugifyTitle(titulo) || "documento";
  return `subastas/${subastaId}/${hash}-${slug}.pdf`;
}

export function getDocumentBlobPathname(
  subastaId: string,
  url: string,
  titulo: string
): string {
  return buildBlobPathname(subastaId, url, titulo);
}

function toBuffer(value: Binary["buffer"] | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function writeLocalCache(pdfPath: string, buffer: Buffer) {
  try {
    mkdirSync(dirname(pdfPath), { recursive: true });
    writeFileSync(pdfPath, buffer);
  } catch {
    // Local caching is best-effort. Blob/Mongo-backed reads should still succeed.
  }
}

async function loadDocumentRecord(url: string): Promise<StoredDocumentRecord | null> {
  try {
    const col = await getDocumentsCollection();
    return (await col.findOne({ url })) as StoredDocumentRecord | null;
  } catch {
    return null;
  }
}

async function saveDocumentRecord(record: StoredDocumentRecord): Promise<void> {
  try {
    const col = await getDocumentsCollection();
    const { url, ...rest } = record;
    const unset: Record<string, "" | 1> = {};

    for (const field of [
      "pathname",
      "blobUrl",
      "downloadUrl",
      "contentType",
      "sizeBytes",
      "compressedBytes",
      "gzipData",
      "provider",
      "subastaId",
      "titulo",
    ] as const) {
      if (rest[field] === undefined) unset[field] = "";
    }

    await col.updateOne(
      { url },
      {
        $set: {
          url,
          ...rest,
          lastVerifiedAt: new Date().toISOString(),
        },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { upsert: true }
    );
  } catch {
    // Mongo is optional for metadata and fallback storage.
  }
}

async function saveMongoGzipFallback(
  url: string,
  subastaId: string,
  titulo: string,
  buffer: Buffer
): Promise<void> {
  const compressed = gzipSync(buffer);
  await saveDocumentRecord({
    url,
    subastaId,
    titulo,
    provider: "mongodb_gzip",
    sizeBytes: buffer.length,
    compressedBytes: compressed.length,
    gzipData: new Binary(compressed),
    downloadedAt: new Date().toISOString(),
  });
}

async function uploadBufferToBlob(
  url: string,
  subastaId: string,
  titulo: string,
  buffer: Buffer,
  existing?: StoredDocumentRecord | null
): Promise<PutBlobResult | null> {
  const token = getBlobToken();
  if (!token) return null;

  const pathname =
    existing?.pathname || buildBlobPathname(subastaId, url, titulo);

  const blob = await put(pathname, buffer, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/pdf",
    token,
  });

  await saveDocumentRecord({
    url,
    subastaId,
    titulo,
    provider: "vercel_blob",
    pathname: blob.pathname,
    blobUrl: blob.url,
    downloadUrl: blob.downloadUrl,
    contentType: blob.contentType,
    sizeBytes: buffer.length,
    downloadedAt: new Date().toISOString(),
  });

  return blob;
}

async function persistBuffer(
  url: string,
  subastaId: string,
  titulo: string,
  buffer: Buffer,
  existing?: StoredDocumentRecord | null
): Promise<void> {
  if (isBlobStorageConfigured()) {
    try {
      await uploadBufferToBlob(url, subastaId, titulo, buffer, existing);
      return;
    } catch {
      // Fall back to Mongo gzip so analysis and document serving keep working.
    }
  }

  await saveMongoGzipFallback(url, subastaId, titulo, buffer);
}

async function loadBufferFromBlob(
  pathname: string,
  pdfPath: string
): Promise<Buffer | null> {
  const token = getBlobToken();
  if (!token) return null;

  try {
    const result = await get(pathname, {
      access: "private",
      token,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;

    const buffer = await streamToBuffer(result.stream);
    if (!isValidPdfBuffer(buffer)) return null;

    writeLocalCache(pdfPath, buffer);
    return buffer;
  } catch {
    return null;
  }
}

async function loadBufferFromMongoFallback(
  record: StoredDocumentRecord,
  pdfPath: string
): Promise<Buffer | null> {
  if (!record.gzipData) return null;

  try {
    const buffer = gunzipSync(toBuffer(record.gzipData.buffer));
    if (!isValidPdfBuffer(buffer)) return null;

    writeLocalCache(pdfPath, buffer);
    return buffer;
  } catch {
    return null;
  }
}

async function downloadPdfFromBoe(
  url: string,
  session?: BoeSession
): Promise<Buffer | null> {
  try {
    const cookieHeader = buildBoeCookieHeader(session);
    const fetchUrl = withBoeRegUrl(url, session?.sessId);

    const resp = await fetch(fetchUrl, {
      headers: {
        ...BOE_HEADERS,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!resp.ok) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    return isValidPdfBuffer(buffer) ? buffer : null;
  } catch {
    return null;
  }
}

export async function getStoredPdfBuffer(
  url: string,
  titulo: string,
  subastaId: string,
  session?: BoeSession
): Promise<Buffer | null> {
  const pdfPath = getPdfCachePath(subastaId, url);
  let localBuffer: Buffer | null = null;

  if (existsSync(pdfPath)) {
    const cached = readFileSync(pdfPath);
    if (isValidPdfBuffer(cached)) {
      localBuffer = cached;
    } else {
      try {
        unlinkSync(pdfPath);
      } catch {
        // ignore corrupt cache cleanup errors
      }
    }
  }

  const record = await loadDocumentRecord(url);
  const blobConfigured = isBlobStorageConfigured();
  const blobPathname = buildBlobPathname(subastaId, url, titulo);

  if (blobConfigured) {
    if (localBuffer) {
      await persistBuffer(url, subastaId, titulo, localBuffer, record);
      return localBuffer;
    }

    const blobBuffer = await loadBufferFromBlob(record?.pathname || blobPathname, pdfPath);
    if (blobBuffer) {
      if (!record?.pathname) {
        await saveDocumentRecord({
          url,
          subastaId,
          titulo,
          provider: "vercel_blob",
          pathname: blobPathname,
          sizeBytes: blobBuffer.length,
          downloadedAt: new Date().toISOString(),
        });
      }
      return blobBuffer;
    }

    if (record?.gzipData) {
      const mongoBuffer = await loadBufferFromMongoFallback(record, pdfPath);
      if (mongoBuffer) {
        await persistBuffer(url, subastaId, titulo, mongoBuffer, record);
        return mongoBuffer;
      }
    }
  }

  if (localBuffer) return localBuffer;

  if (record?.gzipData) {
    const mongoBuffer = await loadBufferFromMongoFallback(record, pdfPath);
    if (mongoBuffer) return mongoBuffer;
  }

  const downloaded = await downloadPdfFromBoe(url, session);
  if (!downloaded) return null;

  writeLocalCache(pdfPath, downloaded);
  await persistBuffer(url, subastaId, titulo, downloaded, record);

  return downloaded;
}

export async function inspectDocumentStorage(url: string, subastaId: string) {
  const pdfPath = getPdfCachePath(subastaId, url);
  const record = await loadDocumentRecord(url);

  return {
    local: existsSync(pdfPath),
    blob: Boolean(record?.pathname),
    mongo: Boolean(record?.gzipData),
    record,
  };
}

export async function ensureSubastaDocumentsStored(
  subasta: Pick<Subasta, "id" | "documentos">,
  session?: BoeSession
): Promise<EnsureDocumentsResult> {
  let ready = 0;
  let failed = 0;
  let bytes = 0;

  for (const doc of subasta.documentos || []) {
    const buffer = await getStoredPdfBuffer(doc.url, doc.titulo, subasta.id, session);
    if (buffer) {
      ready += 1;
      bytes += buffer.length;
    } else {
      failed += 1;
    }
  }

  return {
    total: subasta.documentos?.length || 0,
    ready,
    failed,
    bytes,
  };
}

export function buildDocumentApiUrl(subastaId: string, docIndex: number): string {
  return `${DOCUMENTS_API_PREFIX}/${encodeURIComponent(subastaId)}/${docIndex}`;
}

function documentFilename(index: number, doc: Documento): string {
  const title = slugifyTitle(doc.titulo) || `documento-${index + 1}`;
  return `${title}.pdf`;
}

export async function getSubastaDocument(
  subastaId: string,
  docIndex: number
): Promise<{ subastaId: string; doc: Documento; filename: string } | null> {
  if (!Number.isInteger(docIndex) || docIndex < 0) return null;

  let subasta:
    | { id?: string; documentos?: Documento[] | null }
    | null = null;

  try {
    const col = await getSubastasCollection();
    subasta = (await col.findOne(
      { id: subastaId },
      { projection: { id: 1, documentos: 1 } }
    )) as { id?: string; documentos?: Documento[] | null } | null;
  } catch {
    subasta = null;
  }

  if (!subasta) {
    try {
      const snapshot = JSON.parse(
        readFileSync(join(LOCAL_RESULTS_DIR, "subastas.json"), "utf-8")
      ) as Array<{ id?: string; documentos?: Documento[] | null }>;
      subasta = snapshot.find((item) => item.id === subastaId) || null;
    } catch {
      subasta = null;
    }
  }

  const documentos = Array.isArray(subasta?.documentos)
    ? (subasta.documentos as Documento[])
    : [];
  const doc = documentos[docIndex];

  if (!doc) return null;

  return {
    subastaId,
    doc,
    filename: documentFilename(docIndex, doc),
  };
}

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { get, put } from "@vercel/blob";

import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";
import { isBlobStorageConfigured } from "./document-storage";

const SNAPSHOT_PREFIX = "snapshots";
const LOCAL_RESULTS_DIR = join(process.cwd(), "data", "results");

type SnapshotName = "subastas" | "analysis";

function getBlobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

function getSnapshotPath(name: SnapshotName): string {
  return `${SNAPSHOT_PREFIX}/${name}.json`;
}

function getLocalSnapshotPath(name: SnapshotName): string {
  return join(LOCAL_RESULTS_DIR, `${name}.json`);
}

async function loadBlobSnapshot<T>(name: SnapshotName): Promise<T | null> {
  const token = getBlobToken();
  if (!token) return null;

  try {
    const result = await get(getSnapshotPath(name), {
      access: "private",
      token,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

function loadLocalSnapshot<T>(name: SnapshotName): T | null {
  const filePath = getLocalSnapshotPath(name);
  if (!existsSync(filePath)) return null;

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function saveSnapshotToBlob(
  name: SnapshotName,
  data: unknown
): Promise<void> {
  if (!isBlobStorageConfigured()) return;

  await put(getSnapshotPath(name), JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: getBlobToken(),
  });
}

export async function loadSubastasSnapshot(): Promise<Subasta[] | null> {
  return (
    (await loadBlobSnapshot<Subasta[]>("subastas")) ||
    loadLocalSnapshot<Subasta[]>("subastas")
  );
}

export async function loadAnalysisSnapshot(): Promise<AnalysisResult[] | null> {
  return (
    (await loadBlobSnapshot<AnalysisResult[]>("analysis")) ||
    loadLocalSnapshot<AnalysisResult[]>("analysis")
  );
}

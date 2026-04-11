import { getRuntimeStateCollection } from "./mongodb";

const REFRESH_STATUS_PREFIX = "subastas-refresh:";

export interface SubastaRefreshStatus {
  _id: string;
  provinceCode: string;
  provinceName: string;
  status: "running" | "success" | "error";
  source: "admin" | "cron";
  executionRegion: string | null;
  maxPaginas: number;
  forceFresh: boolean;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  count?: number;
  error?: string;
  updatedAt: string;
}

export function getSubastaRefreshStatusId(provinceCode: string): string {
  return `${REFRESH_STATUS_PREFIX}${provinceCode}`;
}

export async function saveSubastaRefreshStatus(
  input: Omit<SubastaRefreshStatus, "_id" | "updatedAt">
): Promise<void> {
  const col = await getRuntimeStateCollection<SubastaRefreshStatus>();
  const unset: Record<string, "" | 1> = {};

  for (const field of ["finishedAt", "durationMs", "count", "error"] as const) {
    if (input[field] === undefined) {
      unset[field] = "";
    }
  }

  await col.updateOne(
    { _id: getSubastaRefreshStatusId(input.provinceCode) },
    {
      $set: {
        ...input,
        updatedAt: new Date().toISOString(),
      },
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
    { upsert: true }
  );
}

export async function listSubastaRefreshStatuses(): Promise<SubastaRefreshStatus[]> {
  const col = await getRuntimeStateCollection<SubastaRefreshStatus>();
  return col
    .find({ _id: { $regex: `^${REFRESH_STATUS_PREFIX}` } })
    .sort({ updatedAt: -1 })
    .toArray();
}

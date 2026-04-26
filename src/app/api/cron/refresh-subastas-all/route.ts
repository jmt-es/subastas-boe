import { NextRequest } from "next/server";
import {
  ALL_REFRESH_PROVINCES,
  refreshActiveSubastas,
} from "@/lib/subasta-refresh";
import { getRuntimeStateCollection } from "@/lib/mongodb";
import { isAdminOrCronAuthorized, isCronAuthorized } from "@/lib/private-route-auth";
import { saveSubastaRefreshStatus } from "@/lib/subasta-refresh-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STATE_ID = "subastas-refresh-all";
const DEFAULT_MAX_PAGINAS = 0;
const DEFAULT_MAX_DETAILS = 28;
const DEFAULT_SKIP_FRESH_HOURS = 20;

interface RefreshAllState {
  _id: string;
  nextIndex: number;
  lastProvinceCode?: string;
  lastProvinceName?: string;
  lastStatus?: "success" | "error";
  lastError?: string;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastCount?: number;
  lastSkippedFresh?: number;
  executionRegion?: string | null;
  updatedAt: string;
}

function parseNonNegativeInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function loadState(): Promise<RefreshAllState> {
  const col = await getRuntimeStateCollection<RefreshAllState>();
  const state = await col.findOne({ _id: STATE_ID });
  if (state) return state;

  return {
    _id: STATE_ID,
    nextIndex: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function saveState(state: Omit<RefreshAllState, "_id" | "updatedAt">) {
  const col = await getRuntimeStateCollection<RefreshAllState>();
  await col.updateOne(
    { _id: STATE_ID },
    {
      $set: {
        ...state,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
}

function resolveProvinceIndex(state: RefreshAllState): number {
  const lastProvinceIndex = state.lastProvinceCode
    ? ALL_REFRESH_PROVINCES.findIndex(
        (province) => province.code === state.lastProvinceCode
      )
    : -1;

  if (lastProvinceIndex >= 0) {
    return (lastProvinceIndex + 1) % ALL_REFRESH_PROVINCES.length;
  }

  return state.nextIndex % ALL_REFRESH_PROVINCES.length;
}

export async function GET(request: NextRequest) {
  if (!isAdminOrCronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const startedTs = Date.now();
  const state = await loadState();
  const executionRegion = process.env.VERCEL_REGION ?? null;
  const maxPaginas = parseNonNegativeInteger(
    request.nextUrl.searchParams.get("maxPaginas"),
    DEFAULT_MAX_PAGINAS
  );
  const maxDetails = parseNonNegativeInteger(
    request.nextUrl.searchParams.get("maxDetails"),
    DEFAULT_MAX_DETAILS
  );
  const skipFreshHours = parseNonNegativeInteger(
    request.nextUrl.searchParams.get("skipFreshHours"),
    DEFAULT_SKIP_FRESH_HOURS
  );
  const forceFresh = request.nextUrl.searchParams.get("forceFresh") === "1";
  const provinceIndex = resolveProvinceIndex(state);
  const province = ALL_REFRESH_PROVINCES[provinceIndex];
  const source = isCronAuthorized(request) ? "cron" : "admin";

  await saveSubastaRefreshStatus({
    provinceCode: province.code,
    provinceName: province.name,
    status: "running",
    source,
    executionRegion,
    maxPaginas,
    maxDetails,
    forceFresh,
    startedAt,
  });

  try {
    const result = await refreshActiveSubastas({
      provinces: ALL_REFRESH_PROVINCES,
      provinceCodes: [province.code],
      maxPaginas,
      maxDetails,
      skipFreshHours,
      forceFreshSession: forceFresh,
    });
    const summary = result.provinces[0] || {
      code: province.code,
      name: province.name,
      count: 0,
      skippedFresh: 0,
    };
    const nextIndex = (provinceIndex + 1) % ALL_REFRESH_PROVINCES.length;

    await saveState({
      nextIndex,
      lastProvinceCode: province.code,
      lastProvinceName: province.name,
      lastStatus: "success",
      lastStartedAt: startedAt,
      lastFinishedAt: new Date().toISOString(),
      lastCount: summary.count,
      lastSkippedFresh: summary.skippedFresh ?? 0,
      executionRegion,
    });
    await saveSubastaRefreshStatus({
      provinceCode: province.code,
      provinceName: province.name,
      status: "success",
      source,
      executionRegion,
      maxPaginas,
      maxDetails,
      forceFresh,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedTs,
      count: summary.count,
      skippedFresh: summary.skippedFresh ?? 0,
    });

    return Response.json({
      success: true,
      source,
      executionRegion,
      province: summary,
      nextProvince: ALL_REFRESH_PROVINCES[nextIndex],
      maxPaginas,
      maxDetails,
      skipFreshHours,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedTs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextIndex = (provinceIndex + 1) % ALL_REFRESH_PROVINCES.length;

    await saveState({
      nextIndex,
      lastProvinceCode: province.code,
      lastProvinceName: province.name,
      lastStatus: "error",
      lastError: message,
      lastStartedAt: startedAt,
      lastFinishedAt: new Date().toISOString(),
      executionRegion,
    });
    await saveSubastaRefreshStatus({
      provinceCode: province.code,
      provinceName: province.name,
      status: "error",
      source,
      executionRegion,
      maxPaginas,
      maxDetails,
      forceFresh,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedTs,
      error: message,
    });

    return Response.json(
      {
        success: false,
        source,
        executionRegion,
        province,
        nextProvince: ALL_REFRESH_PROVINCES[nextIndex],
        error: message,
      },
      { status: 500 }
    );
  }
}

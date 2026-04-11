import { NextRequest } from "next/server";
import { DEFAULT_REFRESH_PROVINCES, refreshActiveSubastas } from "@/lib/subasta-refresh";
import { isAdminOrCronAuthorized, isCronAuthorized } from "@/lib/private-route-auth";
import { saveSubastaRefreshStatus } from "@/lib/subasta-refresh-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PROVINCES = new Map<string, (typeof DEFAULT_REFRESH_PROVINCES)[number]>(
  DEFAULT_REFRESH_PROVINCES.map((province) => [province.code, province])
);

function parseMaxPaginas(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provinceCode: string }> }
) {
  if (!isAdminOrCronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { provinceCode: rawProvinceCode } = await params;
  const provinceCode = rawProvinceCode.trim();
  const province = PROVINCES.get(provinceCode);

  if (!province) {
    return Response.json(
      {
        error: "Provincia no soportada",
        availableProvinceCodes: Array.from(PROVINCES.keys()),
      },
      { status: 400 }
    );
  }

  const source = isCronAuthorized(request) ? "cron" : "admin";
  const forceFresh = request.nextUrl.searchParams.get("forceFresh") === "1";
  const maxPaginas = parseMaxPaginas(request.nextUrl.searchParams.get("maxPaginas"));
  const executionRegion = process.env.VERCEL_REGION ?? null;
  const startedAt = new Date().toISOString();
  const startedTs = Date.now();

  await saveSubastaRefreshStatus({
    provinceCode,
    provinceName: province.name,
    status: "running",
    source,
    executionRegion,
    maxPaginas,
    forceFresh,
    startedAt,
  });

  try {
    const result = await refreshActiveSubastas({
      provinceCodes: [provinceCode],
      maxPaginas,
      forceFreshSession: forceFresh,
    });

    const summary = result.provinces[0] || {
      code: province.code,
      name: province.name,
      count: 0,
    };

    await saveSubastaRefreshStatus({
      provinceCode,
      provinceName: province.name,
      status: "success",
      source,
      executionRegion,
      maxPaginas,
      forceFresh,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedTs,
      count: summary.count,
    });

    return Response.json({
      success: true,
      source,
      executionRegion,
      province: summary,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedTs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await saveSubastaRefreshStatus({
      provinceCode,
      provinceName: province.name,
      status: "error",
      source,
      executionRegion,
      maxPaginas,
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
        error: message,
        province,
      },
      { status: 500 }
    );
  }
}

export const DASHBOARD_QUERY_KEYS = [
  "page",
  "q",
  "provincia",
  "estado",
  "tipo",
  "cierre",
  "score",
  "view",
  "favoritos",
  "recomendacion",
  "orden",
] as const;

export type DashboardSortMode = "" | "ia" | "descuento" | "cierre" | "valor";
export type DashboardRecommendationFilter = "" | "comprar" | "observar" | "descartar";
export type DashboardStatusFilter = "activas" | "inactivas" | "todas";
export type DashboardClosingFilter = "" | "7" | "14" | "30" | "sin-fecha";
export type DashboardScoreFilter = "" | "60" | "70" | "80";

type DashboardSearchParamKey = (typeof DASHBOARD_QUERY_KEYS)[number];
type DashboardSearchParamsObject = Record<string, string | string[] | undefined>;

export function parseDashboardSortMode(value: string | null | undefined): DashboardSortMode {
  return value === "ia" || value === "descuento" || value === "cierre" || value === "valor"
    ? value
    : "";
}

export function parseDashboardRecommendationFilter(
  value: string | null | undefined
): DashboardRecommendationFilter {
  return value === "comprar" || value === "observar" || value === "descartar" ? value : "";
}

export function parseDashboardStatusFilter(
  value: string | null | undefined
): DashboardStatusFilter {
  return value === "inactivas" || value === "todas" ? value : "activas";
}

export function parseDashboardClosingFilter(
  value: string | null | undefined
): DashboardClosingFilter {
  return value === "7" || value === "14" || value === "30" || value === "sin-fecha"
    ? value
    : "";
}

export function parseDashboardScoreFilter(value: string | null | undefined): DashboardScoreFilter {
  return value === "60" || value === "70" || value === "80" ? value : "";
}

export function buildSubastaDetailHref(subastaId: string, dashboardQueryString: string) {
  const basePath = `/subastas/${encodeURIComponent(subastaId)}`;
  return dashboardQueryString ? `${basePath}?${dashboardQueryString}` : basePath;
}

function appendDashboardQueryValue(
  params: URLSearchParams,
  key: DashboardSearchParamKey,
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(key, item);
    }
    return;
  }

  if (typeof value === "string") {
    params.set(key, value);
  }
}

export function buildDashboardHrefFromSearchParamsObject(
  searchParams: DashboardSearchParamsObject
) {
  const params = new URLSearchParams();

  for (const key of DASHBOARD_QUERY_KEYS) {
    appendDashboardQueryValue(params, key, searchParams[key]);
  }

  const queryString = params.toString();
  return queryString ? `/dashboard?${queryString}` : "/dashboard";
}

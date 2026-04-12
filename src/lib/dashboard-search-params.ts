export const DASHBOARD_QUERY_KEYS = [
  "page",
  "q",
  "provincia",
  "view",
  "favoritos",
  "recomendacion",
  "orden",
] as const;

export type DashboardSortMode = "" | "ia" | "descuento";
export type DashboardRecommendationFilter = "" | "comprar" | "observar" | "descartar";

type DashboardSearchParamKey = (typeof DASHBOARD_QUERY_KEYS)[number];
type DashboardSearchParamsObject = Record<string, string | string[] | undefined>;

export function parseDashboardSortMode(value: string | null | undefined): DashboardSortMode {
  return value === "ia" || value === "descuento" ? value : "";
}

export function parseDashboardRecommendationFilter(
  value: string | null | undefined
): DashboardRecommendationFilter {
  return value === "comprar" || value === "observar" || value === "descartar" ? value : "";
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

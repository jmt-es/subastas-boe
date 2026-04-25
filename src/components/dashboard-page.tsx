"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Brain,
  CalendarClock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Eye,
  Filter,
  LayoutGrid,
  List,
  Search,
  Scale,
  ShieldAlert,
  Star,
  TrendingDown,
  X,
  XCircle,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalysisResult } from "@/lib/storage";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateTime,
  normalizeText,
  parseAmountNumber,
  provinceLabel,
  smartSentenceCase,
  smartTitleCase,
} from "@/lib/subasta-presenters";
import {
  buildSubastaDetailHref,
  parseDashboardClosingFilter,
  parseDashboardRecommendationFilter,
  parseDashboardScoreFilter,
  parseDashboardSortMode,
  parseDashboardStatusFilter,
  type DashboardClosingFilter,
  type DashboardScoreFilter,
  type DashboardSortMode,
  type DashboardStatusFilter,
} from "@/lib/dashboard-search-params";
import type { Subasta } from "@/lib/scraper";
import { isSubastaActive } from "@/lib/subasta-dates";
import { useSubastas } from "@/lib/use-subastas";

const PAGE_SIZE = 25;

type ViewMode = "list" | "cards";
type SortMode = DashboardSortMode;
type RecommendationFilter = "" | "comprar" | "observar" | "descartar";
type StatusFilter = DashboardStatusFilter;
type ClosingFilter = DashboardClosingFilter;
type ScoreFilter = DashboardScoreFilter;

function calcDescuento(valorSubasta?: string, tasacion?: string): number | null {
  const v = parseAmountNumber(valorSubasta);
  const t = parseAmountNumber(tasacion);
  if (!v || !t || t === 0) return null;
  return Math.round((1 - v / t) * 100);
}

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = d.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  return new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}`);
}

function daysUntil(d?: string): number | null {
  const date = parseDate(d);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getClosingDays(subasta: Subasta): number | null {
  return daysUntil(subasta.fechaConclusionAt || subasta.fechaConclusion);
}

function getClosingTime(subasta: Subasta): number {
  return parseDate(subasta.fechaConclusionAt || subasta.fechaConclusion)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function isActiveAuction(subasta: Subasta, nowTs: number) {
  return isSubastaActive(subasta, new Date(nowTs));
}

function assetFilterKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assetFilterValue(subasta: Subasta) {
  return assetFilterKey(inferAssetLabel(subasta));
}

function matchesClosingFilter(subasta: Subasta, filter: ClosingFilter) {
  if (!filter) return true;

  const days = getClosingDays(subasta);
  if (filter === "sin-fecha") return days === null;
  if (days === null) return false;

  return days >= 0 && days <= Number(filter);
}

function statusCopy(status: StatusFilter) {
  if (status === "inactivas") {
    return {
      label: "Inactivas",
      chip: "Histórico explícito",
      hint: "Fuera de la vista diaria hasta que las pidas.",
    };
  }

  if (status === "todas") {
    return {
      label: "Todas",
      chip: "Activas + histórico",
      hint: "Incluye cerradas porque lo has pedido en el filtro.",
    };
  }

  return {
    label: "Activas",
    chip: "Activas por defecto",
    hint: "Las cerradas no entran en la vista diaria.",
  };
}

function recommendationLabel(value?: string) {
  if (value === "comprar") return "Comprar";
  if (value === "observar") return "Observar";
  if (value === "descartar") return "Descartar";
  return "Pendiente";
}

function recommendationClasses(value?: string) {
  if (value === "comprar") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "observar") return "border-primary/15 bg-primary/8 text-primary";
  if (value === "descartar") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-border bg-card text-muted-foreground";
}

function inferAssetLabel(subasta: Subasta) {
  const source = `${subasta.tipoBienDetalle || ""} ${subasta.descripcion || ""}`.toLowerCase();

  if (source.includes("aparcamiento") || source.includes("garaje") || source.includes("parking")) {
    return "Plaza de aparcamiento";
  }
  if (
    source.includes("vivienda") ||
    source.includes("piso") ||
    source.includes("apartamento") ||
    source.includes("casa") ||
    source.includes("chalet")
  ) {
    return "Vivienda";
  }
  if (source.includes("local")) return "Local comercial";
  if (source.includes("nave")) return "Nave industrial";
  if (source.includes("solar") || source.includes("terreno") || source.includes("parcela")) {
    return "Solar";
  }
  if (source.includes("oficina")) return "Oficina";

  return smartTitleCase(subasta.tipoBienDetalle) || "Activo judicial";
}

function displayTitle(subasta: Subasta) {
  const asset = inferAssetLabel(subasta);
  const place = smartTitleCase(subasta.localidad || provinceLabel(subasta.provincia));
  return place ? `${asset} en ${place}` : asset;
}

function displayMeta(subasta: Subasta) {
  return [
    subasta.direccion
      ? smartTitleCase(normalizeText(subasta.direccion).split(",").slice(0, 2).join(", "))
      : "",
    smartTitleCase(subasta.localidad),
    provinceLabel(subasta.provincia),
    smartTitleCase(subasta.tipoSubasta),
  ]
    .filter(Boolean)
    .join(" · ");
}

function descriptionExcerpt(subasta: Subasta, maxLength = 180) {
  const description = smartSentenceCase(subasta.descripcion);
  if (!description) return "Expediente pendiente de descripcion legible en origen.";
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength).trimEnd()}...`;
}

function closingDateLabel(subasta: Subasta) {
  return formatDateTime(parseDate(subasta.fechaConclusionAt || subasta.fechaConclusion), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-full border border-primary/12 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
      <Brain className="h-3.5 w-3.5" />
      <span>{score}</span>
      <span className="text-[0.68rem] font-medium text-primary/70">/100</span>
    </span>
  );
}

function DiscountPill({ descuento }: { descuento: number | null }) {
  if (descuento === null) {
    return <span className="text-xs font-medium text-muted-foreground">—</span>;
  }

  const classes =
    descuento >= 40 ? "text-emerald-700" : descuento >= 20 ? "text-amber-700" : "text-rose-700";

  return <span className={`text-xs font-semibold ${classes}`}>{`${descuento > 0 ? "-" : "+"}${Math.abs(descuento)}%`}</span>;
}

function DaysLeftBadge({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-xs font-medium text-muted-foreground">—</span>;
  }

  const classes =
    days <= 3 ? "text-rose-700" : days <= 7 ? "text-amber-700" : "text-muted-foreground";

  const label = days <= 0 ? "Cerrada" : days === 1 ? "1 día" : `${days} días`;

  return <span className={`text-xs font-semibold ${classes}`}>{label}</span>;
}

function MetricPill({
  label,
  value,
  accent = "text-primary",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground">
      <span className="tech-label text-[0.62rem]">{label}</span>
      <span className={`text-sm font-semibold ${accent}`}>{value}</span>
    </span>
  );
}

function AuctionListRow({
  subasta,
  detailHref,
  analysis,
  isFavorite,
  onToggleFavorite,
}: {
  subasta: Subasta;
  detailHref: string;
  analysis?: AnalysisResult;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const days = daysUntil(subasta.fechaConclusionAt || subasta.fechaConclusion);
  const descuento = calcDescuento(subasta.valorSubasta, subasta.tasacion);

  return (
    <article className="war-panel overflow-hidden p-3 md:px-4 md:py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_130px_120px_130px_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="signal-chip px-2 py-1 text-[0.64rem] text-primary">
              {inferAssetLabel(subasta)}
            </span>
            <span className="tech-label">{subasta.id}</span>
            {analysis && <ScorePill score={analysis.oportunidad} />}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${recommendationClasses(
                analysis?.recomendacion
              )}`}
            >
              {recommendationLabel(analysis?.recomendacion)}
            </span>
          </div>

          <Link
            href={detailHref}
            className="mt-2 block text-[1rem] font-semibold leading-tight tracking-normal text-foreground transition-colors hover:text-primary md:text-[1.05rem]"
          >
            {displayTitle(subasta)}
          </Link>
          <p className="mt-1 line-clamp-1 text-[0.86rem] text-muted-foreground">
            {displayMeta(subasta)}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:hidden">
            <div className="glass-panel p-2.5">
              <p className="tech-label">Valor</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(subasta.valorSubasta)}</p>
            </div>
            <div className="glass-panel p-2.5">
              <p className="tech-label">Ventana</p>
              <div className="mt-1 flex items-center gap-2">
                <DiscountPill descuento={descuento} />
                <DaysLeftBadge days={days} />
              </div>
            </div>
            <div className="glass-panel p-2.5">
              <p className="tech-label">Cierre</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{closingDateLabel(subasta)}</p>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <p className="tech-label">Valor</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatCurrency(subasta.valorSubasta)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tasación {formatCurrency(subasta.tasacion)}
          </p>
        </div>

        <div className="hidden lg:block">
          <p className="tech-label">Ventana</p>
          <div className="mt-2 flex items-center gap-2">
            <DiscountPill descuento={descuento} />
            <DaysLeftBadge days={days} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {subasta.pujActual ? `Puja ${formatCurrency(subasta.pujActual)}` : "Sin puja actual"}
          </p>
        </div>

        <div className="hidden lg:block">
          <p className="tech-label">Cierre</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{closingDateLabel(subasta)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {subasta.documentos?.length || 0} docs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            onClick={() => onToggleFavorite(subasta.id)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
          </button>
          <a
            href={subasta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            BOE
          </a>
          <Link
            href={detailHref}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
          >
            Abrir
          </Link>
        </div>
      </div>
    </article>
  );
}

function AuctionCard({
  subasta,
  detailHref,
  analysis,
  isFavorite,
  onToggleFavorite,
}: {
  subasta: Subasta;
  detailHref: string;
  analysis?: AnalysisResult;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const days = daysUntil(subasta.fechaConclusionAt || subasta.fechaConclusion);
  const descuento = calcDescuento(subasta.valorSubasta, subasta.tasacion);

  return (
    <article className="war-panel overflow-hidden p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="signal-chip text-primary">{inferAssetLabel(subasta)}</span>
        <span className="tech-label">{subasta.id}</span>
        {analysis && <ScorePill score={analysis.oportunidad} />}
      </div>

      <Link
        href={detailHref}
        className="mt-4 block text-[1.16rem] font-semibold leading-tight tracking-normal text-foreground transition-colors hover:text-primary"
      >
        {displayTitle(subasta)}
      </Link>

      <p className="mt-2 text-[0.94rem] text-muted-foreground">{displayMeta(subasta)}</p>
      <p className="mt-3 text-[0.94rem] leading-7 text-foreground/88">{descriptionExcerpt(subasta, 140)}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="glass-panel p-4">
          <p className="tech-label">Valor</p>
          <p className="mt-2 text-[0.98rem] font-semibold text-foreground">{formatCurrency(subasta.valorSubasta)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Tasación {formatCurrency(subasta.tasacion)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="tech-label">Oportunidad</p>
          <div className="mt-2 flex items-center gap-3">
            <DiscountPill descuento={descuento} />
            <DaysLeftBadge days={days} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {analysis ? recommendationLabel(analysis.recomendacion) : "Sin análisis todavía"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/75 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-muted/55 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {closingDateLabel(subasta)}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${recommendationClasses(
              analysis?.recomendacion
            )}`}
          >
            {recommendationLabel(analysis?.recomendacion)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onToggleFavorite(subasta.id)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
          </button>
          <Link
            href={detailHref}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
          >
            Abrir dossier
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [favoritos, setFavoritos] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem("subastas-favoritos") || "[]"));
    } catch {
      return new Set();
    }
  });

  const toggleFavorito = useCallback((id: string) => {
    setFavoritos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("subastas-favoritos", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const pagina = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const busqueda = searchParams.get("q") || "";
  const statusFiltro: StatusFilter = parseDashboardStatusFilter(searchParams.get("estado"));
  const provinciaFiltro = searchParams.get("provincia") || "";
  const tipoFiltro = searchParams.get("tipo") || "";
  const cierreFiltro: ClosingFilter = parseDashboardClosingFilter(searchParams.get("cierre"));
  const scoreFiltro: ScoreFilter = parseDashboardScoreFilter(searchParams.get("score"));
  const viewMode: ViewMode = searchParams.get("view") === "cards" ? "cards" : "list";
  const sortMode: SortMode = parseDashboardSortMode(searchParams.get("orden"));
  const ordenarPorIA = sortMode === "ia";
  const ordenarPorDescuento = sortMode === "descuento";
  const ordenarPorCierre = sortMode === "cierre";
  const ordenarPorValor = sortMode === "valor";
  const recFiltro: RecommendationFilter = parseDashboardRecommendationFilter(
    searchParams.get("recomendacion")
  );
  const soloFavoritos = searchParams.get("favoritos") === "1";
  const dashboardQueryString = searchParams.toString();
  const { subastas, loading, refetch } = useSubastas({ estado: statusFiltro });

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    },
    [router, searchParams]
  );

  const getSubastaHref = useCallback(
    (subastaId: string) => buildSubastaDetailHref(subastaId, dashboardQueryString),
    [dashboardQueryString]
  );

  const setPagina = useCallback(
    (p: number | ((prev: number) => number)) => {
      const next = typeof p === "function" ? p(pagina) : p;
      updateParams({ page: next <= 1 ? null : String(next) });
    },
    [pagina, updateParams]
  );

  const setBusqueda = useCallback(
    (q: string) => {
      updateParams({ q: q || null, page: null });
    },
    [updateParams]
  );

  const setProvincia = useCallback(
    (prov: string) => {
      updateParams({ provincia: prov || null, page: null });
    },
    [updateParams]
  );

  const setStatusFiltro = useCallback(
    (estado: StatusFilter) => {
      updateParams({
        estado: estado === "activas" ? null : estado,
        page: null,
      });
    },
    [updateParams]
  );

  const setTipoFiltro = useCallback(
    (tipo: string) => {
      updateParams({ tipo: tipo || null, page: null });
    },
    [updateParams]
  );

  const setCierreFiltro = useCallback(
    (cierre: ClosingFilter) => {
      updateParams({ cierre: cierre || null, page: null });
    },
    [updateParams]
  );

  const setScoreFiltro = useCallback(
    (score: ScoreFilter) => {
      updateParams({ score: score || null, page: null });
    },
    [updateParams]
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      updateParams({ view: mode === "list" ? null : mode, page: null });
    },
    [updateParams]
  );

  const fetchAnalyses = useCallback(async () => {
    try {
      const resp = await fetch("/api/analysis?all=1");
      const data = await resp.json();
      if (Array.isArray(data)) {
        const next: Record<string, AnalysisResult> = {};
        for (const analysis of data) next[analysis.subastaId] = analysis;
        setAnalyses(next);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAnalyses();
    });

    const clockInterval = setInterval(() => setNowTs(Date.now()), 60_000);
    const refreshInterval = setInterval(() => {
      void refetch();
      void fetchAnalyses();
    }, 300_000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(refreshInterval);
    };
  }, [fetchAnalyses, refetch]);

  const provincias = useMemo(() => {
    const values = new Set<string>();
    for (const subasta of subastas) {
      if (subasta.provincia) values.add(subasta.provincia);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [subastas]);

  const tipoOptions = useMemo(() => {
    const values = new Map<string, { label: string; count: number }>();
    for (const subasta of subastas) {
      const label = inferAssetLabel(subasta);
      const key = assetFilterKey(label);
      const current = values.get(key);
      values.set(key, { label, count: (current?.count || 0) + 1 });
    }

    return Array.from(values.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  }, [subastas]);

  const filtradas = useMemo(() => {
    let result = subastas;

    if (statusFiltro === "activas") {
      result = result.filter((subasta) => isActiveAuction(subasta, nowTs));
    } else if (statusFiltro === "inactivas") {
      result = result.filter((subasta) => !isActiveAuction(subasta, nowTs));
    }

    if (soloFavoritos) {
      result = result.filter((subasta) => favoritos.has(subasta.id));
    }

    if (provinciaFiltro) {
      result = result.filter((subasta) => subasta.provincia === provinciaFiltro);
    }

    if (tipoFiltro) {
      result = result.filter((subasta) => assetFilterValue(subasta) === tipoFiltro);
    }

    if (recFiltro) {
      result = result.filter((subasta) => analyses[subasta.id]?.recomendacion === recFiltro);
    }

    if (scoreFiltro) {
      const minScore = Number(scoreFiltro);
      result = result.filter((subasta) => (analyses[subasta.id]?.oportunidad ?? -1) >= minScore);
    }

    if (cierreFiltro) {
      result = result.filter((subasta) => matchesClosingFilter(subasta, cierreFiltro));
    }

    if (busqueda.trim()) {
      const query = busqueda.toLowerCase();
      result = result.filter(
        (subasta) =>
          subasta.descripcion?.toLowerCase().includes(query) ||
          subasta.direccion?.toLowerCase().includes(query) ||
          subasta.localidad?.toLowerCase().includes(query) ||
          subasta.provincia?.toLowerCase().includes(query) ||
          subasta.tipoSubasta?.toLowerCase().includes(query) ||
          subasta.tipoBienDetalle?.toLowerCase().includes(query) ||
          subasta.valorSubasta?.toLowerCase().includes(query) ||
          subasta.tasacion?.toLowerCase().includes(query) ||
          subasta.estado?.toLowerCase().includes(query) ||
          subasta.id.toLowerCase().includes(query)
      );
    }

    if (sortMode === "ia") {
      result = [...result].sort(
        (a, b) => (analyses[b.id]?.oportunidad ?? -1) - (analyses[a.id]?.oportunidad ?? -1)
      );
    } else if (sortMode === "descuento") {
      result = [...result].sort(
        (a, b) =>
          (calcDescuento(b.valorSubasta, b.tasacion) ?? -999) -
          (calcDescuento(a.valorSubasta, a.tasacion) ?? -999)
      );
    } else if (sortMode === "cierre") {
      result = [...result].sort((a, b) => getClosingTime(a) - getClosingTime(b));
    } else if (sortMode === "valor") {
      result = [...result].sort(
        (a, b) => (parseAmountNumber(b.valorSubasta) ?? -1) - (parseAmountNumber(a.valorSubasta) ?? -1)
      );
    }

    return result;
  }, [
    analyses,
    busqueda,
    cierreFiltro,
    favoritos,
    nowTs,
    provinciaFiltro,
    recFiltro,
    scoreFiltro,
    soloFavoritos,
    sortMode,
    statusFiltro,
    subastas,
    tipoFiltro,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaReal = Math.min(pagina, totalPaginas);
  const paginadas = filtradas.slice((paginaReal - 1) * PAGE_SIZE, paginaReal * PAGE_SIZE);

  const stats = useMemo(() => {
    let activas = 0;
    let inactivas = 0;
    let valorTotal = 0;
    let latestScrapedAt: string | null = null;

    for (const subasta of subastas) {
      if (isActiveAuction(subasta, nowTs)) activas++;
      else inactivas++;

      const valor = parseAmountNumber(subasta.valorSubasta);
      if (valor) valorTotal += valor;

      if (!latestScrapedAt) latestScrapedAt = subasta.scrapedAt;
    }

    return {
      total: subastas.length,
      activas,
      inactivas,
      valorTotal,
      provincias: new Set(subastas.map((item) => item.provincia).filter(Boolean)).size,
      analizadas: Object.keys(analyses).length,
      latestScrapedAt,
    };
  }, [analyses, nowTs, subastas]);

  const insightSummary = useMemo(() => {
    let comprar = 0;
    let observar = 0;
    let descartar = 0;
    let topScore = -1;
    let topId: string | null = null;

    for (const subasta of subastas) {
      const analysis = analyses[subasta.id];
      if (!analysis) continue;

      if (analysis.recomendacion === "comprar") comprar++;
      if (analysis.recomendacion === "observar") observar++;
      if (analysis.recomendacion === "descartar") descartar++;

      if (analysis.oportunidad > topScore) {
        topScore = analysis.oportunidad;
        topId = subasta.id;
      }
    }

    return {
      comprar,
      observar,
      descartar,
      topScore: topScore > -1 ? topScore : null,
      topSubasta: topId ? subastas.find((item) => item.id === topId) ?? null : null,
    };
  }, [analyses, subastas]);

  const activeFilters =
    (busqueda ? 1 : 0) +
    (statusFiltro !== "activas" ? 1 : 0) +
    (provinciaFiltro ? 1 : 0) +
    (tipoFiltro ? 1 : 0) +
    (cierreFiltro ? 1 : 0) +
    (scoreFiltro ? 1 : 0) +
    (recFiltro ? 1 : 0) +
    (soloFavoritos ? 1 : 0) +
    (sortMode ? 1 : 0);

  const scopeCopy = statusCopy(statusFiltro);

  const statusOptions = [
    { key: "activas", label: "Activas", icon: CheckCircle },
    { key: "inactivas", label: "Inactivas", icon: XCircle },
    { key: "todas", label: "Todas", icon: Filter },
  ] as const;

  const cierreOptions = [
    { value: "7", label: "Cierre 7 días" },
    { value: "14", label: "Cierre 14 días" },
    { value: "30", label: "Cierre 30 días" },
    { value: "sin-fecha", label: "Sin fecha" },
  ] as const;

  const scoreOptions = [
    { value: "60", label: "IA ≥ 60" },
    { value: "70", label: "IA ≥ 70" },
    { value: "80", label: "IA ≥ 80" },
  ] as const;

  const recommendationOptions = [
    { key: "comprar", label: "Comprar", icon: CheckCircle, value: insightSummary.comprar },
    { key: "observar", label: "Observar", icon: Eye, value: insightSummary.observar },
    { key: "descartar", label: "Descartar", icon: XCircle, value: insightSummary.descartar },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/94 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:justify-between md:px-5 xl:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <div>
              <p className="text-lg font-semibold tracking-normal text-foreground">Subasta</p>
              <p className="tech-label mt-1">Radar judicial</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <MetricPill label="Visibles" value={String(filtradas.length)} />
            <MetricPill label="Activas" value={String(stats.activas)} />
            <MetricPill label="IA" value={String(stats.analizadas)} />
            <MetricPill
              label="Valor"
              value={formatCompactCurrency(stats.valorTotal)}
              accent="text-emerald-700"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-3 px-3 py-3 md:px-5 xl:px-6">
        <section className="war-panel p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold leading-tight text-foreground md:text-xl">
                  Subastas
                </h1>
                <span className="rounded-full border border-primary/12 bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
                  {scopeCopy.chip}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {scopeCopy.hint} {filtradas.length} resultados visibles.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {stats.provincias} provincias
              </span>
              <span>
                Captura {formatDateTime(stats.latestScrapedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              {statusFiltro === "todas" && <span>{stats.inactivas} cerradas incluidas</span>}
              {activeFilters > 0 && (
                <button
                  onClick={() =>
                    updateParams({
                      q: null,
                      estado: null,
                      provincia: null,
                      tipo: null,
                      cierre: null,
                      score: null,
                      favoritos: null,
                      recomendacion: null,
                      orden: null,
                      page: null,
                    })
                  }
                  className="font-semibold text-primary hover:text-foreground"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_200px_200px_170px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar expediente, dirección, localidad, valor o ID"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                className="h-10 rounded-xl border-border bg-input pl-10 text-sm placeholder:text-muted-foreground"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative min-w-0">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={provinciaFiltro}
                onChange={(event) => setProvincia(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-input pl-9 pr-8 text-sm text-foreground outline-none"
              >
                <option value="">Todas las provincias</option>
                {provincias.map((provincia) => (
                  <option key={provincia} value={provincia}>
                    {provincia}
                  </option>
                ))}
              </select>
              {provinciaFiltro && (
                <button
                  onClick={() => setProvincia("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative min-w-0">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={tipoFiltro}
                onChange={(event) => setTipoFiltro(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-input pl-9 pr-8 text-sm text-foreground outline-none"
              >
                <option value="">Todos los tipos</option>
                {tipoOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              {tipoFiltro && (
                <button
                  onClick={() => setTipoFiltro("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative min-w-0">
              <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={cierreFiltro}
                onChange={(event) => setCierreFiltro(parseDashboardClosingFilter(event.target.value))}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-input pl-9 pr-8 text-sm text-foreground outline-none"
              >
                <option value="">Cualquier cierre</option>
                {cierreOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {cierreFiltro && (
                <button
                  onClick={() => setCierreFiltro("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              {statusOptions.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setStatusFiltro(key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                    statusFiltro === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[145px]">
              <Brain className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={scoreFiltro}
                onChange={(event) => setScoreFiltro(parseDashboardScoreFilter(event.target.value))}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-input pl-9 pr-8 text-sm text-foreground outline-none"
              >
                <option value="">Cualquier IA</option>
                {scoreOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {scoreFiltro && (
                <button
                  onClick={() => setScoreFiltro("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant={soloFavoritos ? "default" : "outline"}
              title="Solo favoritos"
              onClick={() => updateParams({ favoritos: soloFavoritos ? null : "1", page: null })}
              className={`h-10 rounded-xl border-border px-3 text-sm font-medium ${
                soloFavoritos ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-card text-foreground"
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${soloFavoritos ? "fill-current" : ""}`} />
              Favoritos
            </Button>

            <Button
              variant={ordenarPorIA ? "default" : "outline"}
              title="Ordenar por puntuación IA"
              onClick={() => updateParams({ orden: ordenarPorIA ? null : "ia", page: null })}
              className={`h-10 rounded-xl border-border px-3 text-sm font-medium ${
                ordenarPorIA ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-card text-foreground"
              }`}
            >
              <Brain className="h-3.5 w-3.5" />
              IA
            </Button>

            <Button
              variant={ordenarPorCierre ? "default" : "outline"}
              title="Ordenar por cierre"
              onClick={() => updateParams({ orden: ordenarPorCierre ? null : "cierre", page: null })}
              className={`h-10 rounded-xl border-border px-3 text-sm font-medium ${
                ordenarPorCierre ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-card text-foreground"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Cierre
            </Button>

            <Button
              variant={ordenarPorDescuento ? "default" : "outline"}
              title="Ordenar por descuento"
              onClick={() =>
                updateParams({ orden: ordenarPorDescuento ? null : "descuento", page: null })
              }
              className={`h-10 rounded-xl border-border px-3 text-sm font-medium ${
                ordenarPorDescuento ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-card text-foreground"
              }`}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Descuento
            </Button>

            <Button
              variant={ordenarPorValor ? "default" : "outline"}
              title="Ordenar por valor"
              onClick={() => updateParams({ orden: ordenarPorValor ? null : "valor", page: null })}
              className={`h-10 rounded-xl border-border px-3 text-sm font-medium ${
                ordenarPorValor ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-card text-foreground"
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              Valor
            </Button>

            {Object.keys(analyses).length > 0 &&
              recommendationOptions.map(({ key, label, icon: Icon, value }) => (
                <button
                  key={key}
                  onClick={() =>
                    updateParams({
                      recomendacion: recFiltro === key ? null : key,
                      page: null,
                    })
                  }
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                    recFiltro === key ? recommendationClasses(key) : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  <span className="opacity-70">{value}</span>
                </button>
              ))}

            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                  viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                  viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
            {loading && (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="war-panel-muted animate-pulse p-5 md:p-6">
                    <div className="h-3 w-24 bg-muted/70" />
                    <div className="mt-4 h-8 w-2/3 bg-muted/70" />
                    <div className="mt-4 h-3 w-full bg-muted/60" />
                    <div className="mt-2 h-3 w-4/5 bg-muted/60" />
                  </div>
                ))}
              </div>
            )}

            {!loading && filtradas.length === 0 && (
              <div className="war-panel-strong p-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.2rem] border border-primary/15 bg-primary/10 text-primary">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h2 className="mt-6 text-[1.6rem] font-semibold tracking-normal">
                  No hay casos con estos filtros.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[0.98rem] leading-8 text-muted-foreground">
                  Ajusta la búsqueda o limpia filtros. La captura del BOE sigue corriendo en segundo plano.
                </p>
              </div>
            )}

            {!loading && paginadas.length > 0 && viewMode === "list" && (
              <div className="space-y-3">
                {paginadas.map((subasta) => (
                  <AuctionListRow
                    key={subasta.id}
                    subasta={subasta}
                    detailHref={getSubastaHref(subasta.id)}
                    analysis={analyses[subasta.id]}
                    isFavorite={favoritos.has(subasta.id)}
                    onToggleFavorite={toggleFavorito}
                  />
                ))}
              </div>
            )}

            {!loading && paginadas.length > 0 && viewMode === "cards" && (
              <div className="grid gap-3 xl:grid-cols-2">
                {paginadas.map((subasta) => (
                  <AuctionCard
                    key={subasta.id}
                    subasta={subasta}
                    detailHref={getSubastaHref(subasta.id)}
                    analysis={analyses[subasta.id]}
                    isFavorite={favoritos.has(subasta.id)}
                    onToggleFavorite={toggleFavorito}
                  />
                ))}
              </div>
            )}

            {!loading && filtradas.length > PAGE_SIZE && (
              <div className="war-panel flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {(paginaReal - 1) * PAGE_SIZE + 1}-{Math.min(paginaReal * PAGE_SIZE, filtradas.length)} de {filtradas.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-2xl border-border bg-card text-foreground"
                    disabled={paginaReal <= 1}
                    onClick={() => setPagina(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-2xl border-border bg-card text-foreground"
                    disabled={paginaReal <= 1}
                    onClick={() => setPagina((prev) => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPaginas <= 3 ? totalPaginas : 3, totalPaginas) }).map(
                    (_, index) => {
                      let pageNumber: number;
                      if (totalPaginas <= 3) pageNumber = index + 1;
                      else if (paginaReal <= 2) pageNumber = index + 1;
                      else if (paginaReal >= totalPaginas - 1) pageNumber = totalPaginas - 2 + index;
                      else pageNumber = paginaReal - 1 + index;

                      return (
                        <Button
                          key={pageNumber}
                          variant={pageNumber === paginaReal ? "default" : "outline"}
                          className={`h-10 w-10 rounded-2xl text-sm font-semibold ${
                            pageNumber === paginaReal
                              ? "bg-primary text-primary-foreground hover:bg-primary"
                              : "border-border bg-card text-foreground"
                          }`}
                          onClick={() => setPagina(pageNumber)}
                        >
                          {pageNumber}
                        </Button>
                      );
                    }
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-2xl border-border bg-card text-foreground"
                    disabled={paginaReal >= totalPaginas}
                    onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-2xl border-border bg-card text-foreground"
                    disabled={paginaReal >= totalPaginas}
                    onClick={() => setPagina(totalPaginas)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
        </section>
      </div>
    </main>
  );
}

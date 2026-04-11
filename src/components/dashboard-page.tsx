"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
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
  Clock,
  ExternalLink,
  Eye,
  Filter,
  LayoutGrid,
  List,
  Search,
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
import type { Subasta } from "@/lib/scraper";
import { useSubastas } from "@/lib/use-subastas";

const PAGE_SIZE = 25;

type ViewMode = "list" | "cards";

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

function OverviewStat({
  label,
  value,
  hint,
  accent = "text-primary",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel p-4 md:p-5">
      <p className="tech-label">{label}</p>
      <p className={`mt-2 text-[1.3rem] font-semibold tracking-[-0.04em] md:text-[1.55rem] ${accent}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RailCard({
  title,
  tone = "primary",
  icon: Icon,
  children,
}: {
  title: string;
  tone?: "primary" | "gold";
  icon: ElementType;
  children: ReactNode;
}) {
  const toneClass = tone === "gold" ? "text-amber-700" : "text-primary";

  return (
    <section className="war-panel p-5 md:p-6">
      <div className={`flex items-center justify-between gap-3 ${toneClass}`}>
        <p className="tech-label text-current">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AuctionListRow({
  subasta,
  analysis,
  isFavorite,
  onToggleFavorite,
}: {
  subasta: Subasta;
  analysis?: AnalysisResult;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const days = daysUntil(subasta.fechaConclusionAt || subasta.fechaConclusion);
  const descuento = calcDescuento(subasta.valorSubasta, subasta.tasacion);

  return (
    <article className="war-panel overflow-hidden p-4 md:px-5 md:py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_150px_135px_150px_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="signal-chip text-primary">{inferAssetLabel(subasta)}</span>
            <span className="tech-label">{subasta.id}</span>
            {analysis && <ScorePill score={analysis.oportunidad} />}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${recommendationClasses(
                analysis?.recomendacion
              )}`}
            >
              {recommendationLabel(analysis?.recomendacion)}
            </span>
          </div>

          <Link
            href={`/subastas/${encodeURIComponent(subasta.id)}`}
            className="mt-3 block text-[1.12rem] font-semibold leading-tight tracking-[-0.03em] text-foreground transition-colors hover:text-primary md:text-[1.18rem]"
          >
            {displayTitle(subasta)}
          </Link>
          <p className="mt-2 text-[0.92rem] text-muted-foreground">{displayMeta(subasta)}</p>
          <p className="mt-3 hidden max-w-3xl line-clamp-2 text-[0.92rem] leading-7 text-foreground/88 md:block">
            {descriptionExcerpt(subasta)}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:hidden">
            <div className="glass-panel p-3">
              <p className="tech-label">Valor</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{formatCurrency(subasta.valorSubasta)}</p>
            </div>
            <div className="glass-panel p-3">
              <p className="tech-label">Ventana</p>
              <div className="mt-2 flex items-center gap-2">
                <DiscountPill descuento={descuento} />
                <DaysLeftBadge days={days} />
              </div>
            </div>
            <div className="glass-panel p-3">
              <p className="tech-label">Cierre</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{closingDateLabel(subasta)}</p>
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
          </button>
          <a
            href={subasta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            BOE
          </a>
          <Link
            href={`/subastas/${encodeURIComponent(subasta.id)}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
          >
            Abrir dossier
          </Link>
        </div>
      </div>
    </article>
  );
}

function AuctionCard({
  subasta,
  analysis,
  isFavorite,
  onToggleFavorite,
}: {
  subasta: Subasta;
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
        href={`/subastas/${encodeURIComponent(subasta.id)}`}
        className="mt-4 block text-[1.16rem] font-semibold leading-tight tracking-[-0.03em] text-foreground transition-colors hover:text-primary"
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
            href={`/subastas/${encodeURIComponent(subasta.id)}`}
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
  const { subastas, loading, refetch } = useSubastas();

  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [ordenarPorIA, setOrdenarPorIA] = useState(false);
  const [ordenarPorDescuento, setOrdenarPorDescuento] = useState(false);
  const [recFiltro, setRecFiltro] = useState("");
  const [soloFavoritos, setSoloFavoritos] = useState(false);
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
  const provinciaFiltro = searchParams.get("provincia") || "";
  const viewMode: ViewMode = searchParams.get("view") === "cards" ? "cards" : "list";

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

  const filtradas = useMemo(() => {
    let result = subastas;

    if (soloFavoritos) {
      result = result.filter((subasta) => favoritos.has(subasta.id));
    }

    if (provinciaFiltro) {
      result = result.filter((subasta) => subasta.provincia === provinciaFiltro);
    }

    if (recFiltro) {
      result = result.filter((subasta) => analyses[subasta.id]?.recomendacion === recFiltro);
    }

    if (busqueda.trim()) {
      const query = busqueda.toLowerCase();
      result = result.filter(
        (subasta) =>
          subasta.descripcion?.toLowerCase().includes(query) ||
          subasta.direccion?.toLowerCase().includes(query) ||
          subasta.localidad?.toLowerCase().includes(query) ||
          subasta.provincia?.toLowerCase().includes(query) ||
          subasta.tipoBienDetalle?.toLowerCase().includes(query) ||
          subasta.id.toLowerCase().includes(query)
      );
    }

    if (ordenarPorIA) {
      result = [...result].sort(
        (a, b) => (analyses[b.id]?.oportunidad ?? -1) - (analyses[a.id]?.oportunidad ?? -1)
      );
    } else if (ordenarPorDescuento) {
      result = [...result].sort(
        (a, b) =>
          (calcDescuento(b.valorSubasta, b.tasacion) ?? -999) -
          (calcDescuento(a.valorSubasta, a.tasacion) ?? -999)
      );
    }

    return result;
  }, [
    analyses,
    busqueda,
    favoritos,
    ordenarPorDescuento,
    ordenarPorIA,
    provinciaFiltro,
    recFiltro,
    soloFavoritos,
    subastas,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaReal = Math.min(pagina, totalPaginas);
  const paginadas = filtradas.slice((paginaReal - 1) * PAGE_SIZE, paginaReal * PAGE_SIZE);

  const stats = useMemo(() => {
    let activas = 0;
    let valorTotal = 0;
    let latestScrapedAt: string | null = null;

    for (const subasta of subastas) {
      const end = parseDate(subasta.fechaConclusionAt || subasta.fechaConclusion);
      if (end && end.getTime() > nowTs) activas++;

      const valor = parseAmountNumber(subasta.valorSubasta);
      if (valor) valorTotal += valor;

      if (!latestScrapedAt) latestScrapedAt = subasta.scrapedAt;
    }

    return {
      total: subastas.length,
      activas,
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

    for (const [subastaId, analysis] of Object.entries(analyses)) {
      if (analysis.recomendacion === "comprar") comprar++;
      if (analysis.recomendacion === "observar") observar++;
      if (analysis.recomendacion === "descartar") descartar++;

      if (analysis.oportunidad > topScore) {
        topScore = analysis.oportunidad;
        topId = subastaId;
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

  const latestEntries = useMemo(() => {
    return subastas.slice(0, 4);
  }, [subastas]);

  const shortlist = useMemo(() => {
    return [...subastas]
      .filter((subasta) => favoritos.has(subasta.id) || analyses[subasta.id])
      .sort((a, b) => {
        const favA = favoritos.has(a.id) ? 1 : 0;
        const favB = favoritos.has(b.id) ? 1 : 0;
        if (favA !== favB) return favB - favA;
        return (analyses[b.id]?.oportunidad ?? -1) - (analyses[a.id]?.oportunidad ?? -1);
      })
      .slice(0, 4);
  }, [analyses, favoritos, subastas]);

  const upcomingClosures = useMemo(() => {
    return [...filtradas]
      .filter((subasta) => {
        const days = daysUntil(subasta.fechaConclusionAt || subasta.fechaConclusion);
        return days !== null && days > 0 && days <= 10;
      })
      .sort(
        (a, b) =>
          (daysUntil(a.fechaConclusionAt || a.fechaConclusion) ?? 99) -
          (daysUntil(b.fechaConclusionAt || b.fechaConclusion) ?? 99)
      )
      .slice(0, 4);
  }, [filtradas]);

  const activeFilters =
    (busqueda ? 1 : 0) + (provinciaFiltro ? 1 : 0) + (recFiltro ? 1 : 0) + (soloFavoritos ? 1 : 0);

  const recommendationOptions = [
    { key: "comprar", label: "Comprar", icon: CheckCircle, value: insightSummary.comprar },
    { key: "observar", label: "Observar", icon: Eye, value: insightSummary.observar },
    { key: "descartar", label: "Descartar", icon: XCircle, value: insightSummary.descartar },
  ] as const;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">Subasta</p>
              <p className="tech-label mt-1">Radar judicial</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {stats.activas} activas
            </span>
            <span className="rounded-full border border-primary/12 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
              {stats.analizadas} dossiers IA
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Última captura {formatDateTime(stats.latestScrapedAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 md:px-6 xl:px-8 xl:py-8">
        <section className="space-y-4">
          <div className="war-panel-strong overflow-hidden p-6 md:p-7">
            <span className="section-kicker">Radar diario</span>
            <div className="mt-4 max-w-4xl">
              <h1 className="text-[1.55rem] font-semibold leading-tight tracking-[-0.04em] text-foreground md:text-[1.95rem]">
                {stats.activas} activas para revisar con una lectura compacta, sin botones operativos que estorben.
              </h1>
              <p className="mt-4 max-w-3xl text-[0.96rem] leading-7 text-muted-foreground md:text-[0.98rem]">
                La sincronización ya corre en segundo plano. Aquí solo queda buscar, comparar,
                guardar favoritos y abrir el dossier con contexto claro.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewStat
                label="Expedientes"
                value={String(stats.total)}
                hint={`${stats.provincias} provincias cubiertas`}
              />
              <OverviewStat
                label="Activas"
                value={String(stats.activas)}
                hint="Con fecha de cierre futura"
              />
              <OverviewStat
                label="Dossiers IA"
                value={String(stats.analizadas)}
                hint="Listos para reabrir"
              />
              <OverviewStat
                label="Valor agregado"
                value={formatCompactCurrency(stats.valorTotal)}
                hint="Suma del valor disponible"
                accent="text-emerald-700"
              />
            </div>
          </div>

          <section className="war-panel p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tech-label text-primary">Lo último</p>
                <h2 className="mt-3 text-[1.18rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                  Entradas recientes del radar.
                </h2>
              </div>
              <CalendarClock className="mt-1 h-4 w-4 text-primary" />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
              {latestEntries.map((item) => (
                <Link
                  key={item.id}
                  href={`/subastas/${encodeURIComponent(item.id)}`}
                  className="block rounded-[1rem] border border-border/80 bg-card p-4 transition-colors hover:border-primary/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="tech-label">{formatDateTime(item.scrapedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <span className="rounded-full border border-border bg-muted/55 px-2.5 py-1 text-[0.68rem] font-medium text-muted-foreground">
                      {provinceLabel(item.provincia) || smartTitleCase(item.localidad) || "Sin provincia"}
                    </span>
                  </div>
                  <p className="mt-3 text-[1.02rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                    {displayTitle(item)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-foreground">{formatCurrency(item.valorSubasta)}</span>
                    <span className="text-muted-foreground">{closingDateLabel(item)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </section>

        <section className="war-panel p-4 md:p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar expediente, dirección, localidad o ID"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                className="h-11 rounded-2xl border-border bg-input pl-11 text-sm placeholder:text-muted-foreground"
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
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={provinciaFiltro}
                onChange={(event) => setProvincia(event.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-border bg-input pl-10 pr-9 text-sm text-foreground outline-none"
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

            <div className="flex flex-wrap gap-2">
              <Button
                variant={soloFavoritos ? "default" : "outline"}
                title="Solo favoritos"
                onClick={() => {
                  setSoloFavoritos(!soloFavoritos);
                  updateParams({ page: null });
                }}
                className={`h-11 rounded-2xl border-border px-4 text-sm font-medium ${
                  soloFavoritos ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-card text-foreground"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${soloFavoritos ? "fill-current" : ""}`} />
                Favoritos
              </Button>

              <Button
                variant={ordenarPorIA ? "default" : "outline"}
                title="Ordenar por puntuación IA"
                onClick={() => {
                  setOrdenarPorIA(!ordenarPorIA);
                  setOrdenarPorDescuento(false);
                  updateParams({ page: null });
                }}
                className={`h-11 rounded-2xl border-border px-4 text-sm font-medium ${
                  ordenarPorIA ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-card text-foreground"
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                Orden IA
              </Button>

              <Button
                variant={ordenarPorDescuento ? "default" : "outline"}
                title="Ordenar por descuento"
                onClick={() => {
                  setOrdenarPorDescuento(!ordenarPorDescuento);
                  setOrdenarPorIA(false);
                  updateParams({ page: null });
                }}
                className={`h-11 rounded-2xl border-border px-4 text-sm font-medium ${
                  ordenarPorDescuento ? "bg-amber-100 text-amber-900 hover:bg-amber-100" : "bg-card text-foreground"
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Descuento
              </Button>

              <div className="inline-flex rounded-2xl border border-border bg-card p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-9 items-center gap-2 rounded-[0.9rem] px-3 text-sm font-medium transition-colors ${
                    viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`inline-flex h-9 items-center gap-2 rounded-[0.9rem] px-3 text-sm font-medium transition-colors ${
                    viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </button>
              </div>
            </div>
          </div>

          {Object.keys(analyses).length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="tech-label">Recomendación</span>
              {recommendationOptions.map(({ key, label, icon: Icon, value }) => (
                <button
                  key={key}
                  onClick={() => {
                    setRecFiltro(recFiltro === key ? "" : key);
                    updateParams({ page: null });
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                    recFiltro === key ? recommendationClasses(key) : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  <span className="opacity-70">{value}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""} · vista {viewMode === "list" ? "lista" : "cards"}
            </span>
            <span>
              Última captura {formatDateTime(stats.latestScrapedAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  updateParams({ q: null, provincia: null, page: null });
                  setRecFiltro("");
                  setSoloFavoritos(false);
                }}
                className="text-sm font-semibold text-primary hover:text-foreground"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="space-y-3">
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
                <h2 className="mt-6 text-[1.6rem] font-semibold tracking-[-0.04em]">
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
          </div>

          <div className="space-y-4">
            <RailCard title="Pulso IA" icon={Brain}>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="glass-panel p-4">
                  <p className="tech-label">Comprar</p>
                  <p className="mt-2 text-[1.35rem] font-semibold text-emerald-700">{insightSummary.comprar}</p>
                </div>
                <div className="glass-panel p-4">
                  <p className="tech-label">Observar</p>
                  <p className="mt-2 text-[1.35rem] font-semibold text-primary">{insightSummary.observar}</p>
                </div>
                <div className="glass-panel p-4">
                  <p className="tech-label">Descartar</p>
                  <p className="mt-2 text-[1.35rem] font-semibold text-rose-700">{insightSummary.descartar}</p>
                </div>
              </div>

              {insightSummary.topSubasta && insightSummary.topScore !== null ? (
                <div className="mt-4 rounded-[1.1rem] border border-border bg-muted/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="tech-label">Caso mejor puntuado</p>
                    <ScorePill score={insightSummary.topScore} />
                  </div>

                  <Link
                    href={`/subastas/${encodeURIComponent(insightSummary.topSubasta.id)}`}
                    className="mt-4 block text-[1.05rem] font-semibold leading-tight tracking-[-0.03em] text-foreground transition-colors hover:text-primary"
                  >
                    {displayTitle(insightSummary.topSubasta)}
                  </Link>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {displayMeta(insightSummary.topSubasta)}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  Cuando existan más análisis guardados, aquí aparecerá el expediente mejor puntuado.
                </p>
              )}
            </RailCard>

            <RailCard title="Shortlist" icon={Star}>
              {shortlist.length > 0 ? (
                <div className="space-y-3">
                  {shortlist.map((item) => (
                    <Link
                      key={item.id}
                      href={`/subastas/${encodeURIComponent(item.id)}`}
                      className="block rounded-[1rem] border border-border/80 bg-card p-4 transition-colors hover:border-primary/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-muted-foreground">{item.id.slice(0, 14)}</span>
                        {analyses[item.id] && <ScorePill score={analyses[item.id].oportunidad} />}
                      </div>
                      <p className="mt-3 text-[1.02rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                        {displayTitle(item)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{displayMeta(item)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  Cuando guardes favoritos o se acumulen expedientes analizados, aparecerán aquí.
                </p>
              )}
            </RailCard>

            <RailCard title="Cierres próximos" icon={Clock} tone="gold">
              {upcomingClosures.length > 0 ? (
                <div className="space-y-3">
                  {upcomingClosures.map((item) => (
                    <div key={item.id} className="rounded-[1rem] border border-border/80 bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="tech-label">{item.localidad || item.id.slice(0, 12)}</p>
                        <DaysLeftBadge days={daysUntil(item.fechaConclusionAt || item.fechaConclusion)} />
                      </div>
                      <p className="mt-3 text-[1.05rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                        {displayTitle(item)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {descriptionExcerpt(item, 110)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  No hay expedientes que venzan en los próximos diez días con los filtros actuales.
                </p>
              )}
            </RailCard>
          </div>
        </section>
      </div>
    </main>
  );
}

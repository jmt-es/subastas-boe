"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  Suspense,
  type ElementType,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Home,
  KeyRound,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Star,
  TrendingDown,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrapeDialog } from "@/components/scrape-dialog";
import type { Subasta } from "@/lib/scraper";
import { useSubastas } from "@/lib/use-subastas";
import type { AnalysisResult } from "@/lib/storage";

const PAGE_SIZE = 25;

function formatCurrency(value?: string): string {
  if (!value) return "—";
  if (value.toLowerCase().includes("lote")) return "Ver lotes";
  const num = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  if (isNaN(num) || num === 0) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatCompact(num: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

function parseNum(value?: string): number | null {
  if (!value) return null;
  const num = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  return isNaN(num) || num === 0 ? null : num;
}

function calcDescuento(valorSubasta?: string, tasacion?: string): number | null {
  const v = parseNum(valorSubasta);
  const t = parseNum(tasacion);
  if (!v || !t || t === 0) return null;
  return Math.round((1 - v / t) * 100);
}

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const m = d.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`);
  const iso = new Date(d);
  return Number.isNaN(iso.getTime()) ? null : iso;
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
  if (value === "comprar") {
    return "border-[#e5be74]/30 bg-[#e5be74]/10 text-[#e5be74]";
  }
  if (value === "observar") {
    return "border-primary/25 bg-primary/10 text-primary";
  }
  if (value === "descartar") {
    return "border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]";
  }
  return "border-border bg-card text-muted-foreground";
}

function provinceLabel(value?: string) {
  if (!value) return "";
  return value.split("/")[0]?.trim() || value;
}

function normalizeText(value?: string) {
  return value?.replace(/\s+/g, " ").trim() || "";
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

  const customType = normalizeText(subasta.tipoBienDetalle);
  return customType || "Activo judicial";
}

function displayTitle(subasta: Subasta) {
  const asset = inferAssetLabel(subasta);
  const place = subasta.localidad || provinceLabel(subasta.provincia);
  return place ? `${asset} en ${place}` : asset;
}

function displayMeta(subasta: Subasta) {
  return [
    subasta.direccion ? normalizeText(subasta.direccion).split(",").slice(0, 2).join(", ") : "",
    subasta.localidad,
    provinceLabel(subasta.provincia),
    normalizeText(subasta.tipoSubasta),
  ]
    .filter(Boolean)
    .join(" · ");
}

function descriptionExcerpt(subasta: Subasta, maxLength = 210) {
  const description = normalizeText(subasta.descripcion);
  if (!description) return "Expediente pendiente de descripcion legible en origen.";
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength).trimEnd()}...`;
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-2 border border-primary/15 bg-primary/10 px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary">
      <Brain className="h-3 w-3" />
      {score}
    </span>
  );
}

function DiscountPill({ descuento }: { descuento: number | null }) {
  if (descuento === null) {
    return (
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
        —
      </span>
    );
  }

  const classes =
    descuento >= 40
      ? "text-[#9dd7b9]"
      : descuento >= 20
        ? "text-[#e5be74]"
        : "text-[#ffb4ab]";

  return (
    <span className={`font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${classes}`}>
      {descuento > 0 ? `-${descuento}%` : `+${Math.abs(descuento)}%`}
    </span>
  );
}

function DaysLeftBadge({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-muted-foreground">
        —
      </span>
    );
  }

  const classes =
    days <= 3
      ? "text-[#ffb4ab]"
      : days <= 7
        ? "text-[#e5be74]"
        : "text-muted-foreground";

  return (
    <span className={`font-mono text-[0.66rem] uppercase tracking-[0.16em] ${classes}`}>
      {days <= 0 ? "Cerrada" : `${days}d`}
    </span>
  );
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
    <div className="war-panel-muted p-4 md:p-5">
      <p className="tech-label">{label}</p>
      <p className={`mt-3 font-mono text-3xl font-semibold tracking-[-0.06em] md:text-4xl ${accent}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-6 text-muted-foreground">{hint}</p>}
    </div>
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
  const days = daysUntil(subasta.fechaConclusion);
  const descuento = calcDescuento(subasta.valorSubasta, subasta.tasacion);

  return (
    <article className="war-panel-muted overflow-hidden p-5 md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="signal-chip text-primary">{inferAssetLabel(subasta)}</span>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
              {subasta.id}
            </span>
            {analysis && <ScorePill score={analysis.oportunidad} />}
            <span
              className={`inline-flex items-center border px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] ${recommendationClasses(
                analysis?.recomendacion
              )}`}
            >
              {recommendationLabel(analysis?.recomendacion)}
            </span>
          </div>

          <Link
            href={`/subastas/${encodeURIComponent(subasta.id)}`}
            className="mt-5 block font-heading text-3xl leading-[0.95] tracking-[-0.05em] transition-colors hover:text-primary md:text-4xl"
          >
            {displayTitle(subasta)}
          </Link>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">{displayMeta(subasta)}</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground/90 md:text-[0.95rem]">
            {descriptionExcerpt(subasta)}
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[430px]">
          <div className="glass-panel p-4">
            <p className="tech-label">Valor subasta</p>
            <p className="mt-3 font-mono text-lg text-foreground md:text-xl">
              {formatCurrency(subasta.valorSubasta)}
            </p>
            <p className="mt-2 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-muted-foreground">
              Tasacion {formatCurrency(subasta.tasacion)}
            </p>
          </div>
          <div className="glass-panel p-4">
            <p className="tech-label">Oportunidad</p>
            <div className="mt-3 flex items-center gap-3">
              <DiscountPill descuento={descuento} />
              <DaysLeftBadge days={days} />
            </div>
            {subasta.pujActual && (
              <p className="mt-2 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-primary">
                Puja {formatCurrency(subasta.pujActual)}
              </p>
            )}
          </div>
          <div className="glass-panel p-4">
            <p className="tech-label">Documentacion</p>
            <p className="mt-3 font-mono text-lg text-[#e5be74] md:text-xl">
              {subasta.documentos?.length || 0}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Enlaces BOE listos para abrir desde el expediente.
            </p>
          </div>
          <div className="glass-panel p-4">
            <p className="tech-label">Lectura IA</p>
            {analysis ? (
              <>
                <p className="mt-3 font-mono text-lg text-primary md:text-xl">
                  {analysis.oportunidad}/100
                </p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  {recommendationLabel(analysis.recomendacion)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-mono text-lg text-muted-foreground md:text-xl">Pendiente</p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Disponible al abrir el dossier y lanzar analisis.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/70 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
            {subasta.localidad || "Localidad pendiente"}
          </span>
          {subasta.estado && (
            <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-primary">
              {subasta.estado}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={subasta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            BOE
          </a>
          <Link
            href={`/subastas/${encodeURIComponent(subasta.id)}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary px-4 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-[#e5be74]"
          >
            Abrir dossier
          </Link>
          <button
            onClick={() => onToggleFavorite(subasta.id)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-[#e5be74]"
            aria-label={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-[#e5be74] text-[#e5be74]" : ""}`} />
          </button>
        </div>
      </div>
    </article>
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
  const toneClass = tone === "gold" ? "text-[#e5be74]" : "text-primary";

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
  const { subastas, loading, addSubastas, refetch } = useSubastas();

  const [showScrape, setShowScrape] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [ordenarPorIA, setOrdenarPorIA] = useState(false);
  const [ordenarPorDescuento, setOrdenarPorDescuento] = useState(false);
  const [recFiltro, setRecFiltro] = useState("");
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (!val) params.delete(key);
        else params.set(key, val);
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

  const checkSession = useCallback(async () => {
    try {
      const resp = await fetch("/api/session-check");
      const data = await resp.json();
      setSessionActive(data.active ?? false);
    } catch {
      setSessionActive(false);
    }
  }, []);

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
      void checkSession();
      void fetchAnalyses();
    });

    const sessionInterval = setInterval(checkSession, 60_000);
    const clockInterval = setInterval(() => setNowTs(Date.now()), 60_000);

    return () => {
      clearInterval(sessionInterval);
      clearInterval(clockInterval);
    };
  }, [checkSession, fetchAnalyses]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    await fetchAnalyses();
    await checkSession();
    setRefreshing(false);
  }, [checkSession, fetchAnalyses, refetch]);

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
      result = result.filter((s) => favoritos.has(s.id));
    }

    if (provinciaFiltro) {
      result = result.filter((s) => s.provincia === provinciaFiltro);
    }

    if (recFiltro) {
      result = result.filter((s) => analyses[s.id]?.recomendacion === recFiltro);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(
        (s) =>
          s.descripcion?.toLowerCase().includes(q) ||
          s.direccion?.toLowerCase().includes(q) ||
          s.localidad?.toLowerCase().includes(q) ||
          s.provincia?.toLowerCase().includes(q) ||
          s.tipoBienDetalle?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
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

    for (const subasta of subastas) {
      const end = parseDate(subasta.fechaConclusion);
      if (end && end.getTime() > nowTs) activas++;
      const valor = parseNum(subasta.valorSubasta);
      if (valor) valorTotal += valor;
    }

    return {
      total: subastas.length,
      activas,
      valorTotal,
      provincias: new Set(subastas.map((item) => item.provincia).filter(Boolean)).size,
      analizadas: Object.keys(analyses).length,
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
        const days = daysUntil(subasta.fechaConclusion);
        return days !== null && days > 0 && days <= 10;
      })
      .sort((a, b) => (daysUntil(a.fechaConclusion) ?? 99) - (daysUntil(b.fechaConclusion) ?? 99))
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
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                <Home className="h-4 w-4" />
              </div>
              <div>
                <p className="font-heading text-3xl leading-none tracking-[-0.06em] text-primary">
                  Subasta
                </p>
                <p className="tech-label mt-2 text-[0.58rem] text-primary/75">
                  Radar operativo
                </p>
              </div>
            </Link>

            <button
              onClick={() => setShowSettings(true)}
              title="Sesion BOE"
              className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  sessionActive === null
                    ? "animate-pulse bg-muted-foreground"
                    : sessionActive
                      ? "bg-[#9dd7b9]"
                      : "bg-[#ffb4ab]"
                }`}
              />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                {sessionActive === null
                  ? "Comprobando sesion"
                  : sessionActive
                    ? "Sesion activa"
                    : "Sesion expirada"}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-11 rounded-full border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button
              onClick={() => setShowScrape(true)}
              className="h-11 rounded-full bg-primary px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary-foreground hover:bg-[#e5be74]"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scrapear BOE</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Ajustes"
              onClick={() => setShowSettings(true)}
              className="h-11 w-11 rounded-full border-border bg-card text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-6 xl:px-8 xl:py-10">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="war-panel-strong overflow-hidden p-6 md:p-8 lg:p-10">
            <span className="section-kicker">Radar operativo</span>
            <div className="mt-6 max-w-4xl">
              <h1 className="text-4xl leading-[0.92] tracking-[-0.07em] md:text-6xl xl:text-7xl">
                Una interfaz clara para filtrar, leer y priorizar sin pelearte con el BOE.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                Aqui trabajas con expedientes reales, shortlist, cierres proximos y lectura IA
                en una sola superficie. Menos columnas asfixiadas, mas contexto util.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewStat
                label="Expedientes"
                value={String(stats.total)}
                hint={`${stats.provincias} provincias cubiertas`}
              />
              <OverviewStat
                label="Activas"
                value={String(stats.activas)}
                hint="Con fecha de cierre futura"
                accent="text-primary"
              />
              <OverviewStat
                label="Dossiers IA"
                value={String(stats.analizadas)}
                hint="Analisis persistidos listos para abrir"
                accent="text-[#e5be74]"
              />
              <OverviewStat
                label="Valor agregado"
                value={formatCompact(stats.valorTotal)}
                hint="Suma del valor de subasta disponible"
                accent="text-[#9dd7b9]"
              />
            </div>
          </div>

          <div className="space-y-4">
            {insightSummary.topSubasta && insightSummary.topScore !== null ? (
              <section className="war-panel-strong p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="section-kicker">Caso del dia</span>
                    <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                      {insightSummary.topSubasta.id}
                    </p>
                  </div>
                  <div className="rounded-full border border-[#e5be74]/20 bg-[#e5be74]/10 px-4 py-2 font-mono text-sm text-[#e5be74]">
                    {insightSummary.topScore}/100
                  </div>
                </div>

                <h2 className="mt-5 text-3xl leading-[0.94] tracking-[-0.05em] md:text-4xl">
                  {displayTitle(insightSummary.topSubasta)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {displayMeta(insightSummary.topSubasta)}
                </p>
                <p className="mt-4 text-sm leading-7 text-foreground/90">
                  {descriptionExcerpt(insightSummary.topSubasta, 165)}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="glass-panel p-4">
                    <p className="tech-label">Valor</p>
                    <p className="mt-3 font-mono text-base text-foreground">
                      {formatCurrency(insightSummary.topSubasta.valorSubasta)}
                    </p>
                  </div>
                  <div className="glass-panel p-4">
                    <p className="tech-label">Descuento</p>
                    <div className="mt-3">
                      <DiscountPill
                        descuento={calcDescuento(
                          insightSummary.topSubasta.valorSubasta,
                          insightSummary.topSubasta.tasacion
                        )}
                      />
                    </div>
                  </div>
                  <div className="glass-panel p-4">
                    <p className="tech-label">Cierre</p>
                    <div className="mt-3">
                      <DaysLeftBadge days={daysUntil(insightSummary.topSubasta.fechaConclusion)} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] ${recommendationClasses(
                      analyses[insightSummary.topSubasta.id]?.recomendacion
                    )}`}
                  >
                    {recommendationLabel(analyses[insightSummary.topSubasta.id]?.recomendacion)}
                  </span>
                  <span className="rounded-full border border-border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {insightSummary.topSubasta.documentos?.length || 0} docs
                  </span>
                </div>

                <Link
                  href={`/subastas/${encodeURIComponent(insightSummary.topSubasta.id)}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-5 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-[#e5be74]"
                >
                  Abrir dossier
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </section>
            ) : (
              <section className="war-panel p-6">
                <span className="section-kicker">Caso del dia</span>
                <h2 className="mt-5 text-3xl leading-[0.94] tracking-[-0.05em]">
                  Aun no hay un expediente destacado.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  En cuanto existan analisis guardados, aqui veras el mejor caso del momento con
                  score, descuento y acceso directo al dossier.
                </p>
              </section>
            )}

            <section className="war-panel p-6">
              <p className="tech-label text-primary">Pulso del radar</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="glass-panel p-4">
                  <p className="tech-label">Comprar</p>
                  <p className="mt-3 font-mono text-3xl text-[#e5be74]">{insightSummary.comprar}</p>
                </div>
                <div className="glass-panel p-4">
                  <p className="tech-label">Observar</p>
                  <p className="mt-3 font-mono text-3xl text-primary">{insightSummary.observar}</p>
                </div>
                <div className="glass-panel p-4">
                  <p className="tech-label">Cierres proximos</p>
                  <p className="mt-3 font-mono text-3xl text-[#ffb4ab]">
                    {upcomingClosures.length}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="war-panel p-4 md:p-5">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar descripcion, direccion, localidad o id"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="h-12 rounded-full border-border bg-input pl-11 font-mono text-xs uppercase tracking-[0.12em] placeholder:text-muted-foreground"
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
                    onChange={(e) => setProvincia(e.target.value)}
                    className="h-12 w-full appearance-none rounded-full border border-border bg-input pl-10 pr-9 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-foreground outline-none"
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
                    className={`h-12 rounded-full border-border px-4 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${
                      soloFavoritos
                        ? "bg-[#e5be74] text-[#261900] hover:bg-[#e5be74]"
                        : "bg-card text-foreground"
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${soloFavoritos ? "fill-current" : ""}`} />
                    Favoritos
                  </Button>
                  <Button
                    variant={ordenarPorIA ? "default" : "outline"}
                    title="Ordenar por puntuacion IA"
                    onClick={() => {
                      setOrdenarPorIA(!ordenarPorIA);
                      setOrdenarPorDescuento(false);
                      updateParams({ page: null });
                    }}
                    className={`h-12 rounded-full border-border px-4 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${
                      ordenarPorIA
                        ? "bg-primary text-primary-foreground hover:bg-primary"
                        : "bg-card text-foreground"
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
                    className={`h-12 rounded-full border-border px-4 font-mono text-[0.65rem] uppercase tracking-[0.16em] ${
                      ordenarPorDescuento
                        ? "bg-[#e5be74] text-[#261900] hover:bg-[#e5be74]"
                        : "bg-card text-foreground"
                    }`}
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    Descuento
                  </Button>
                </div>
              </div>

              {Object.keys(analyses).length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="tech-label">Recomendacion</span>
                  {recommendationOptions.map(({ key, label, icon: Icon, value }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setRecFiltro(recFiltro === key ? "" : key);
                        updateParams({ page: null });
                      }}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] ${
                        recFiltro === key
                          ? recommendationClasses(key)
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                      <span className="text-[0.6rem] opacity-70">{value}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
                </span>
                {activeFilters > 0 && (
                  <button
                    onClick={() => {
                      updateParams({ q: null, provincia: null, page: null });
                      setRecFiltro("");
                      setSoloFavoritos(false);
                    }}
                    className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary hover:text-[#e5be74]"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

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
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h2 className="mt-6 text-4xl tracking-[-0.05em]">No hay casos con estos filtros.</h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                  Ajusta la busqueda, limpia filtros o abre una nueva sesion de scraping para
                  volver a llenar el radar.
                </p>
              </div>
            )}

            {!loading && paginadas.length > 0 && (
              <div className="space-y-3">
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
                <p className="text-xs text-muted-foreground">
                  {(paginaReal - 1) * PAGE_SIZE + 1}-
                  {Math.min(paginaReal * PAGE_SIZE, filtradas.length)} de {filtradas.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-border bg-card text-foreground"
                    disabled={paginaReal <= 1}
                    onClick={() => setPagina(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-border bg-card text-foreground"
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
                          className={`h-10 w-10 rounded-full font-mono text-xs ${
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
                    className="h-10 w-10 rounded-full border-border bg-card text-foreground"
                    disabled={paginaReal >= totalPaginas}
                    onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-border bg-card text-foreground"
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
            <RailCard title="Resumen IA" icon={Brain}>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="glass-panel p-4">
                  <p className="tech-label">Comprar</p>
                  <p className="mt-3 font-mono text-2xl text-[#e5be74]">{insightSummary.comprar}</p>
                </div>
                <div className="glass-panel p-4">
                  <p className="tech-label">Observar</p>
                  <p className="mt-3 font-mono text-2xl text-primary">{insightSummary.observar}</p>
                </div>
                <div className="glass-panel p-4">
                  <p className="tech-label">Descartar</p>
                  <p className="mt-3 font-mono text-2xl text-[#ffb4ab]">{insightSummary.descartar}</p>
                </div>
              </div>
            </RailCard>

            <RailCard title="Shortlist" icon={Star}>
              {shortlist.length > 0 ? (
                <div className="space-y-3">
                  {shortlist.map((item) => (
                    <Link
                      key={item.id}
                      href={`/subastas/${encodeURIComponent(item.id)}`}
                      className="block rounded-[1.1rem] border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                          {item.id.slice(0, 14)}
                        </span>
                        {analyses[item.id] && <ScorePill score={analyses[item.id].oportunidad} />}
                      </div>
                      <p className="mt-3 font-heading text-2xl leading-[0.96] tracking-[-0.05em]">
                        {displayTitle(item)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {displayMeta(item)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  Cuando guardes favoritos o existan casos analizados, el shortlist aparecera
                  aqui con acceso rapido.
                </p>
              )}
            </RailCard>

            <RailCard title="Cierres proximos" icon={Clock} tone="gold">
              {upcomingClosures.length > 0 ? (
                <div className="space-y-3">
                  {upcomingClosures.map((item) => (
                    <div key={item.id} className="rounded-[1.1rem] border border-border/70 bg-card/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="tech-label">{item.localidad || item.id.slice(0, 12)}</p>
                        <DaysLeftBadge days={daysUntil(item.fechaConclusion)} />
                      </div>
                      <p className="mt-3 font-heading text-2xl leading-[0.96] tracking-[-0.05em]">
                        {displayTitle(item)}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {descriptionExcerpt(item, 120)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  No hay expedientes que venzan en los proximos diez dias con los filtros
                  actuales.
                </p>
              )}
            </RailCard>
          </div>
        </section>
      </div>

      {showScrape && (
        <ScrapeDialog
          onClose={() => setShowScrape(false)}
          onComplete={(nuevas) => {
            addSubastas(nuevas);
            setShowScrape(false);
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          sessionActive={sessionActive}
          onSessionUpdate={() => checkSession()}
          onScrapeOpen={() => {
            setShowSettings(false);
            setShowScrape(true);
          }}
        />
      )}
    </main>
  );
}

function SettingsPanel({
  onClose,
  sessionActive,
  onSessionUpdate,
  onScrapeOpen,
}: {
  onClose: () => void;
  sessionActive: boolean | null;
  onSessionUpdate: () => void;
  onScrapeOpen: () => void;
}) {
  const [sessId, setSessId] = useState("");
  const [simpleSaml, setSimpleSaml] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveSession = async () => {
    if (!sessId.trim() && !simpleSaml.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessId: sessId.trim() || undefined,
          simpleSaml: simpleSaml.trim() || undefined,
        }),
      });
      setSaved(true);
      onSessionUpdate();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="war-panel-strong w-full max-w-md p-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <p className="section-kicker">Ajustes</p>
            <p className="mt-3 font-heading text-3xl tracking-[-0.05em]">Sesion y scraping</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 p-5">
          <div className="war-panel-muted p-4">
            <label className="tech-label flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" />
              Sesion BOE
            </label>
            <div className="mt-4 flex items-center gap-3 border border-border bg-card px-4 py-3">
              <span
                className={`h-2 w-2 ${
                  sessionActive === null
                    ? "animate-pulse bg-muted-foreground"
                    : sessionActive
                      ? "bg-[#9dd7b9]"
                      : "bg-[#ffb4ab]"
                }`}
              />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                {sessionActive === null
                  ? "Comprobando"
                  : sessionActive
                    ? "Sesion activa"
                    : "Sin sesion o expirada"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <Input
                placeholder="SESSID"
                value={sessId}
                onChange={(e) => setSessId(e.target.value)}
                className="h-11 border-border bg-input font-mono text-xs uppercase tracking-[0.12em]"
              />
              <Input
                placeholder="SimpleSAML"
                value={simpleSaml}
                onChange={(e) => setSimpleSaml(e.target.value)}
                className="h-11 border-border bg-input font-mono text-xs uppercase tracking-[0.12em]"
              />
              <Button
                onClick={handleSaveSession}
                disabled={(!sessId.trim() && !simpleSaml.trim()) || saving}
                className="h-11 w-full bg-primary font-mono text-[0.68rem] uppercase tracking-[0.18em] text-primary-foreground hover:bg-[#e5be74]"
              >
                {saved ? "Guardadas" : saving ? "Guardando..." : "Actualizar cookies"}
              </Button>
            </div>

            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              Modo rapido: entra en subastas.boe.es con Cl@ve, abre DevTools y copia
              SESSID y SimpleSAML desde las cookies del sitio. Modo estable: usar
              usuario/contrasena del BOE y leer el OTP por Gmail API; el reseteo de
              contrasena sigue siendo manual porque usa email y SMS distintos.
            </p>
          </div>

          <div className="war-panel-muted p-4">
            <label className="tech-label flex items-center gap-2">
              <Download className="h-3.5 w-3.5" />
              Operacion
            </label>
            <Button
              variant="outline"
              onClick={onScrapeOpen}
              className="mt-4 h-11 w-full border-border bg-card font-mono text-[0.68rem] uppercase tracking-[0.18em] text-foreground hover:bg-card/80"
            >
              <Download className="h-4 w-4" />
              Configurar y scrapear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

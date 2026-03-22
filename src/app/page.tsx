"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Download,
  Gavel,
  TrendingUp,
  Clock,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Brain,
  FileText,
  Home,
  Filter,
  X,
  RefreshCw,
  Settings,
  KeyRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { ScrapeDialog } from "@/components/scrape-dialog";
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

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const m = d.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`);
  const iso = new Date(d);
  return isNaN(iso.getTime()) ? null : iso;
}

function daysUntil(d?: string): number | null {
  const date = parseDate(d);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ScorePill({ score }: { score: number }) {
  const bg =
    score >= 7
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : score >= 4
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tabular-nums ${bg}`}
    >
      <Brain className="h-2.5 w-2.5" />
      {score}/10
    </span>
  );
}

function DaysLeftBadge({ days }: { days: number }) {
  const color =
    days <= 3
      ? "text-red-400"
      : days <= 7
        ? "text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
      {days <= 0 ? "Finalizada" : `${days}d`}
    </span>
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
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Check BOE session status
  const checkSession = useCallback(async () => {
    try {
      const resp = await fetch("/api/session-check");
      const data = await resp.json();
      setSessionActive(data.active ?? false);
    } catch {
      setSessionActive(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Read state from URL
  const pagina = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const busqueda = searchParams.get("q") || "";
  const provinciaFiltro = searchParams.get("provincia") || "";

  // Helper to update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === "") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      }
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [searchParams, router]
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

  // Load all analyses from MongoDB
  const fetchAnalyses = useCallback(async () => {
    try {
      const resp = await fetch("/api/analysis?all=1");
      const data = await resp.json();
      if (Array.isArray(data)) {
        const map: Record<string, AnalysisResult> = {};
        for (const a of data) map[a.subastaId] = a;
        setAnalyses(map);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    await fetchAnalyses();
    await checkSession();
    setRefreshing(false);
  }, [refetch, fetchAnalyses, checkSession]);

  // Get unique provinces from data
  const provincias = useMemo(() => {
    const set = new Set<string>();
    for (const s of subastas) {
      if (s.provincia) set.add(s.provincia);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [subastas]);

  const filtradas = useMemo(() => {
    let result = subastas;

    // Province filter
    if (provinciaFiltro) {
      result = result.filter((s) => s.provincia === provinciaFiltro);
    }

    // Text search
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

    return result;
  }, [subastas, busqueda, provinciaFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  // Clamp page if out of range
  const paginaReal = Math.min(pagina, totalPaginas);
  const paginadas = filtradas.slice(
    (paginaReal - 1) * PAGE_SIZE,
    paginaReal * PAGE_SIZE
  );

  const stats = useMemo(() => {
    const now = Date.now();
    let activas = 0;
    let valorTotal = 0;

    for (const s of subastas) {
      const end = parseDate(s.fechaConclusion);
      if (end && end.getTime() > now) activas++;
      const num = parseFloat(
        (s.valorSubasta || "0").replace(/[^\d,.-]/g, "").replace(",", ".")
      );
      if (!isNaN(num)) valorTotal += num;
    }

    return {
      total: subastas.length,
      activas,
      valorTotal,
      provincias: new Set(subastas.map((s) => s.provincia).filter(Boolean))
        .size,
      analizadas: Object.keys(analyses).length,
    };
  }, [subastas, analyses]);

  // Count active filters
  const activeFilters = (busqueda ? 1 : 0) + (provinciaFiltro ? 1 : 0);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 md:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Gavel className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight">
                  SUBASTAS
                  <span className="text-primary ml-1.5">BOE</span>
                </h1>
                <p className="text-[10px] md:text-xs text-muted-foreground tracking-wide uppercase hidden sm:block">
                  Análisis de subastas judiciales
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Session indicator */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card/80 border border-border/50" title={sessionActive ? "Sesión BOE activa" : "Sesión BOE inactiva"}>
                {sessionActive === null ? (
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
                ) : sessionActive ? (
                  <Wifi className="h-3 w-3 text-emerald-400" />
                ) : (
                  <WifiOff className="h-3 w-3 text-red-400" />
                )}
                <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">
                  {sessionActive === null ? "..." : sessionActive ? "BOE" : "Sin sesión"}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-9 md:h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 md:mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden md:inline">Actualizar</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="h-9 md:h-8"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-5 md:py-8 space-y-4 md:space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
          {[
            { label: "SUBASTAS", value: stats.total.toString(), icon: Gavel },
            { label: "ACTIVAS", value: stats.activas.toString(), icon: Clock },
            {
              label: "VALOR TOTAL",
              value: formatCompact(stats.valorTotal),
              icon: TrendingUp,
            },
            {
              label: "PROVINCIAS",
              value: stats.provincias.toString(),
              icon: MapPin,
            },
            {
              label: "ANALIZADAS IA",
              value: stats.analizadas.toString(),
              icon: Brain,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/50 p-3 md:p-5 transition-colors hover:border-primary/30"
            >
              <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20 bg-primary/5 rounded-bl-[40px] transition-colors group-hover:bg-primary/10" />
              <stat.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground mb-2 md:mb-3" />
              {loading ? (
                <div className="h-6 md:h-8 w-16 md:w-20 bg-muted/50 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-lg md:text-2xl font-bold tracking-tight">
                  {stat.value}
                </p>
              )}
              <p className="text-[8px] md:text-[10px] font-semibold tracking-widest text-muted-foreground mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descripción, dirección, localidad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-11 h-11 bg-card/50 border-border/50 text-sm placeholder:text-muted-foreground/60"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Province filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={provinciaFiltro}
              onChange={(e) => setProvincia(e.target.value)}
              className="w-full sm:w-auto h-11 pl-9 pr-8 rounded-md border border-border/50 bg-card/50 text-sm appearance-none cursor-pointer hover:border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Todas las provincias</option>
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {provinciaFiltro && (
              <button
                onClick={() => setProvincia("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Active filters info */}
        {activeFilters > 0 && !loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
            </span>
            {provinciaFiltro && (
              <Badge
                variant="secondary"
                className="text-[9px] gap-1 cursor-pointer hover:bg-destructive/10"
                onClick={() => setProvincia("")}
              >
                <MapPin className="h-2.5 w-2.5" />
                {provinciaFiltro}
                <X className="h-2 w-2" />
              </Badge>
            )}
            {busqueda && (
              <Badge
                variant="secondary"
                className="text-[9px] gap-1 cursor-pointer hover:bg-destructive/10"
                onClick={() => setBusqueda("")}
              >
                <Search className="h-2.5 w-2.5" />
                &quot;{busqueda}&quot;
                <X className="h-2 w-2" />
              </Badge>
            )}
            <button
              onClick={() => updateParams({ q: null, provincia: null, page: null })}
              className="text-[10px] text-primary hover:underline ml-1"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Empty / Loading states */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4 animate-pulse">
                <div className="h-4 w-32 bg-muted/40 rounded mb-2" />
                <div className="h-3 w-48 bg-muted/30 rounded mb-3" />
                <div className="flex gap-4">
                  <div className="h-3 w-20 bg-muted/30 rounded" />
                  <div className="h-3 w-16 bg-muted/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center">
              <Gavel className="h-7 w-7 text-primary/40" />
            </div>
            <div className="text-center">
              <p className="font-medium">No hay subastas</p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeFilters > 0 ? (
                  <button
                    onClick={() => updateParams({ q: null, provincia: null, page: null })}
                    className="text-primary hover:underline font-semibold"
                  >
                    Limpiar filtros
                  </button>
                ) : (
                  <>
                    Pulsa{" "}
                    <button
                      onClick={() => setShowScrape(true)}
                      className="text-primary hover:underline font-semibold"
                    >
                      Scrapear BOE
                    </button>{" "}
                    para descargar datos
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Mobile Card Layout */}
        {!loading && paginadas.length > 0 && (
          <div className="md:hidden space-y-2">
            {paginadas.map((s) => {
              const days = daysUntil(s.fechaConclusion);
              const analysis = analyses[s.id];
              const isVivienda = s.tipoBienDetalle?.toLowerCase().includes("vivienda");
              return (
                <Link
                  key={s.id}
                  href={`/subastas/${encodeURIComponent(s.id)}`}
                  className="block rounded-lg border border-border/50 bg-card/50 p-3.5 active:bg-primary/[0.05] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <Badge variant="secondary" className="text-[9px] font-semibold tracking-wide shrink-0">
                      {isVivienda && <Home className="h-2.5 w-2.5 mr-1" />}
                      {s.tipoBienDetalle || "—"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {analysis && <ScorePill score={analysis.oportunidad} />}
                      {days !== null && <DaysLeftBadge days={days} />}
                    </div>
                  </div>
                  <p className="text-sm font-medium line-clamp-2 mb-1.5">
                    {s.descripcion || "Sin descripción"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {s.localidad || "—"}{s.provincia ? `, ${s.provincia}` : ""}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                      {formatCurrency(s.valorSubasta)}
                    </span>
                  </div>
                  {s.documentos && s.documentos.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {s.documentos.length} doc{s.documentos.length > 1 ? "s" : ""}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Desktop Table */}
        {!loading && paginadas.length > 0 && (
          <div className="hidden md:block rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 bg-card/30">
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Tipo</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Descripción</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Ubicación</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-right">Valor</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-right">Tasación</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-center">Cierre</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-center">IA</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-center">Docs</TableHead>
                  <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((s) => {
                  const days = daysUntil(s.fechaConclusion);
                  const analysis = analyses[s.id];
                  const isVivienda = s.tipoBienDetalle?.toLowerCase().includes("vivienda");
                  return (
                    <TableRow key={s.id} className="border-border/30 hover:bg-primary/[0.03] transition-colors group">
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="secondary" className="text-[9px] font-semibold tracking-wide w-fit">
                            {isVivienda && <Home className="h-2.5 w-2.5 mr-1" />}
                            {s.tipoBienDetalle || "—"}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground/60 font-mono">
                            {s.id.length > 20 ? s.id.substring(0, 20) + "…" : s.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <Link href={`/subastas/${encodeURIComponent(s.id)}`} className="hover:text-primary transition-colors">
                          <p className="truncate text-sm font-medium">{s.descripcion || "Sin descripción"}</p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs">{s.localidad || "—"}</span>
                          <span className="text-[10px] text-muted-foreground">{s.provincia || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{formatCurrency(s.valorSubasta)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{formatCurrency(s.tasacion)}</TableCell>
                      <TableCell className="text-center">{days !== null ? <DaysLeftBadge days={days} /> : "—"}</TableCell>
                      <TableCell className="text-center">
                        {analysis ? (
                          <Link href={`/subastas/${encodeURIComponent(s.id)}`}><ScorePill score={analysis.oportunidad} /></Link>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.documentos && s.documentos.length > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <FileText className="h-3 w-3" />{s.documentos.length}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filtradas.length > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {(paginaReal - 1) * PAGE_SIZE + 1}–
              {Math.min(paginaReal * PAGE_SIZE, filtradas.length)} de{" "}
              <span className="font-semibold text-foreground">
                {filtradas.length}
              </span>{" "}
              subastas
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 md:h-8 md:w-8"
                disabled={paginaReal <= 1}
                onClick={() => setPagina(1)}
              >
                <ChevronsLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 md:h-8 md:w-8"
                disabled={paginaReal <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>

              {/* Page numbers - fewer on mobile */}
              {Array.from({ length: Math.min(totalPaginas <= 3 ? totalPaginas : 3, totalPaginas) }).map((_, i) => {
                let p: number;
                const maxVisible = totalPaginas <= 3 ? totalPaginas : 3;
                if (totalPaginas <= maxVisible) {
                  p = i + 1;
                } else if (paginaReal <= 2) {
                  p = i + 1;
                } else if (paginaReal >= totalPaginas - 1) {
                  p = totalPaginas - maxVisible + 1 + i;
                } else {
                  p = paginaReal - 1 + i;
                }
                return (
                  <Button
                    key={p}
                    variant={p === paginaReal ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 md:h-8 md:w-8 text-xs"
                    onClick={() => setPagina(p)}
                  >
                    {p}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 md:h-8 md:w-8"
                disabled={paginaReal >= totalPaginas}
                onClick={() =>
                  setPagina((p) => Math.min(totalPaginas, p + 1))
                }
              >
                <ChevronRight className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 md:h-8 md:w-8"
                disabled={paginaReal >= totalPaginas}
                onClick={() => setPagina(totalPaginas)}
              >
                <ChevronsRight className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/50 tracking-wider uppercase pb-4">
          Datos públicos de subastas.boe.es — Persistidos en MongoDB
        </p>
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

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          sessionActive={sessionActive}
          onSessionUpdate={() => checkSession()}
          onScrapeOpen={() => { setShowSettings(false); setShowScrape(true); }}
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveSession = async () => {
    if (!sessId.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessId: sessId.trim() }),
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-bold text-sm">Ajustes</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Session status */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" />
              Sesión BOE
            </label>
            <div className="flex items-center gap-2 p-3 rounded-md border border-border/50 bg-card/50">
              {sessionActive ? (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-sm text-emerald-400 font-medium">Sesión activa</span>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400 shrink-0" />
                  <span className="text-sm text-red-400 font-medium">Sin sesión o expirada</span>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Pegar nueva SESSID del BOE"
                value={sessId}
                onChange={(e) => setSessId(e.target.value)}
                className="h-10 text-sm font-mono"
              />
              <Button
                onClick={handleSaveSession}
                disabled={!sessId.trim() || saving}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saved ? "Guardada" : saving ? "Guardando..." : "Actualizar sesión"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Loguéate en subastas.boe.es con Cl@ve, abre DevTools → Application → Cookies y copia el valor de SESSID.
            </p>
          </div>

          {/* Scraping */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
              <Download className="h-3 w-3" />
              Scraping
            </label>
            <Button
              variant="outline"
              onClick={onScrapeOpen}
              className="w-full h-10"
            >
              <Download className="h-4 w-4 mr-2" />
              Configurar y scrapear BOE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

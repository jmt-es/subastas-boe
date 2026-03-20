"use client";

import { useState, useMemo } from "react";
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
  Trash2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { ScrapeDialog } from "@/components/scrape-dialog";
import { useSubastas } from "@/lib/use-subastas";

function formatCurrency(value?: string): string {
  if (!value) return "—";
  const num = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
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

export default function Dashboard() {
  const { subastas, loading, addSubastas, clearSubastas } = useSubastas();
  const [busqueda, setBusqueda] = useState("");
  const [showScrape, setShowScrape] = useState(false);

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return subastas;
    const q = busqueda.toLowerCase();
    return subastas.filter(
      (s) =>
        s.descripcion?.toLowerCase().includes(q) ||
        s.direccion?.toLowerCase().includes(q) ||
        s.localidad?.toLowerCase().includes(q) ||
        s.provincia?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [subastas, busqueda]);

  const stats = useMemo(
    () => ({
      total: subastas.length,
      activas: subastas.filter((s) =>
        s.estado?.toLowerCase().includes("celebr")
      ).length,
      valorTotal: subastas.reduce((acc, s) => {
        const num = parseFloat(
          (s.valorSubasta || "0").replace(/[^\d,.-]/g, "").replace(",", ".")
        );
        return acc + (isNaN(num) ? 0 : num);
      }, 0),
      provincias: new Set(subastas.map((s) => s.provincia).filter(Boolean))
        .size,
    }),
    [subastas]
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Gavel className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  SUBASTAS
                  <span className="text-primary ml-1.5">BOE</span>
                </h1>
                <p className="text-xs text-muted-foreground tracking-wide uppercase">
                  Análisis de subastas judiciales
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {subastas.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSubastas}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Limpiar
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setShowScrape(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Scrapear BOE
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "SUBASTAS",
              value: stats.total.toString(),
              icon: Gavel,
            },
            {
              label: "ACTIVAS",
              value: stats.activas.toString(),
              icon: Clock,
            },
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
          ].map((stat) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/50 p-5 transition-colors hover:border-primary/30"
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-[40px] transition-colors group-hover:bg-primary/10" />
              <stat.icon className="h-4 w-4 text-muted-foreground mb-3" />
              {loading ? (
                <div className="h-8 w-20 bg-muted/50 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              )}
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción, dirección, localidad, provincia..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-11 h-12 bg-card/50 border-border/50 text-sm placeholder:text-muted-foreground/60"
          />
          {busqueda && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {filtradas.length} resultados
            </span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 bg-card/30">
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  ID
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Estado
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Descripción
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Ubicación
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-right">
                  Valor
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-right">
                  Tasación
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-right">
                  Puja
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase w-8">
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30">
                    <TableCell><div className="h-4 w-28 bg-muted/40 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-16 bg-muted/40 rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-40 bg-muted/30 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted/30 rounded animate-pulse" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-20 bg-muted/40 rounded animate-pulse ml-auto" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-20 bg-muted/30 rounded animate-pulse ml-auto" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-16 bg-primary/10 rounded animate-pulse ml-auto" /></TableCell>
                    <TableCell><div className="h-4 w-4 bg-muted/20 rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filtradas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-20"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center">
                        <Gavel className="h-7 w-7 text-primary/40" />
                      </div>
                      <div>
                        <p className="font-medium">No hay subastas</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pulsa{" "}
                          <button
                            onClick={() => setShowScrape(true)}
                            className="text-primary hover:underline font-semibold"
                          >
                            Scrapear BOE
                          </button>{" "}
                          para descargar datos
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((s) => (
                  <TableRow
                    key={s.id}
                    className="border-border/30 hover:bg-primary/[0.03] transition-colors group"
                  >
                    <TableCell>
                      <Link
                        href={`/subastas/${encodeURIComponent(s.id)}`}
                        className="text-primary hover:underline font-mono text-xs font-medium"
                      >
                        {s.id.length > 18
                          ? s.id.substring(0, 18) + "…"
                          : s.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.estado?.toLowerCase().includes("celebr")
                            ? "default"
                            : "secondary"
                        }
                        className="text-[10px] font-semibold tracking-wide"
                      >
                        {s.estado || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate text-sm">
                        {s.descripcion || "Sin descripción"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[s.localidad, s.provincia]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatCurrency(s.valorSubasta)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(s.tasacion)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums font-semibold text-primary">
                      {formatCurrency(s.pujActual)}
                    </TableCell>
                    <TableCell>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
    </main>
  );
}

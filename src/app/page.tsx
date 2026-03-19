"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Download,
  RefreshCw,
  Gavel,
  TrendingUp,
  Clock,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { ScrapeDialog } from "@/components/scrape-dialog";

interface Subasta {
  id: string;
  url: string;
  identificador?: string;
  estado?: string;
  tipoSubasta?: string;
  fechaInicio?: string;
  fechaConclusion?: string;
  valorSubasta?: string;
  tasacion?: string;
  pujaMinima?: string;
  pujActual?: string;
  descripcion?: string;
  localidad?: string;
  provincia?: string;
  scrapedAt: string;
}

function formatCurrency(value?: string): string {
  if (!value) return "-";
  const num = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

function estadoBadgeVariant(
  estado?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (!estado) return "outline";
  const lower = estado.toLowerCase();
  if (lower.includes("celebr")) return "default";
  if (lower.includes("próxima") || lower.includes("proxima")) return "secondary";
  if (lower.includes("finaliz")) return "destructive";
  return "outline";
}

export default function Dashboard() {
  const [subastas, setSubastas] = useState<Subasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showScrape, setShowScrape] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("q", busqueda);
      const resp = await fetch(`/api/subastas?${params}`);
      const data = await resp.json();
      setSubastas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error cargando subastas:", e);
    } finally {
      setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const stats = {
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
    provincias: new Set(subastas.map((s) => s.provincia).filter(Boolean)).size,
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Gavel className="h-8 w-8" />
                Subastas BOE
              </h1>
              <p className="text-muted-foreground mt-1">
                Portal de análisis de subastas judiciales
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cargar}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button onClick={() => setShowScrape(true)}>
                <Download className="h-4 w-4 mr-2" />
                Scrapear
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subastas</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("es-ES", {
                  style: "currency",
                  currency: "EUR",
                  notation: "compact",
                }).format(stats.valorTotal)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Provincias</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.provincias}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descripción, dirección, localidad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && cargar()}
              className="pl-10"
            />
          </div>
          <Button onClick={cargar} variant="secondary">
            Buscar
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Tasación</TableHead>
                  <TableHead className="text-right">Puja Actual</TableHead>
                  <TableHead>Fecha Fin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : subastas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No hay subastas. Pulsa &quot;Scrapear&quot; para descargar
                      datos del BOE.
                    </TableCell>
                  </TableRow>
                ) : (
                  subastas.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={`/subastas/${encodeURIComponent(s.id)}`}
                          className="text-primary hover:underline font-mono text-xs"
                        >
                          {s.id.length > 20
                            ? s.id.substring(0, 20) + "..."
                            : s.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={estadoBadgeVariant(s.estado)}>
                          {s.estado || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {s.descripcion || "Sin descripción"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {[s.localidad, s.provincia]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(s.valorSubasta)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(s.tasacion)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatCurrency(s.pujActual)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.fechaConclusion || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {showScrape && (
        <ScrapeDialog
          onClose={() => setShowScrape(false)}
          onComplete={() => {
            setShowScrape(false);
            cargar();
          }}
        />
      )}
    </main>
  );
}

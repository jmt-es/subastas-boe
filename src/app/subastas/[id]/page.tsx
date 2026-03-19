"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ExternalLink,
  Brain,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Eye,
  XCircle,
  Gavel,
  MapPin,
  Calendar,
  Euro,
} from "lucide-react";
import Link from "next/link";

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
  tramosEntrePujas?: string;
  importeDeposito?: string;
  cantidadReclamada?: string;
  lotes?: string;
  descripcion?: string;
  direccion?: string;
  codigoPostal?: string;
  localidad?: string;
  provincia?: string;
  situacionPosesoria?: string;
  visitable?: string;
  referenciaCatastral?: string;
  anuncioBOE?: string;
  cuentaExpediente?: string;
  autoridad?: string;
  rawData: Record<string, string>;
  scrapedAt: string;
}

interface Analysis {
  subastaId: string;
  oportunidad: number;
  riesgos: string[];
  resumen: string;
  recomendacion: "comprar" | "observar" | "descartar";
  detalles: string;
  analyzedAt: string;
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

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 7
      ? "bg-green-500"
      : score >= 4
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-muted rounded-full h-3">
        <div
          className={`h-3 rounded-full ${color} transition-all`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-2xl font-bold">{score}/10</span>
    </div>
  );
}

function RecomendacionBadge({
  rec,
}: {
  rec: "comprar" | "observar" | "descartar";
}) {
  const config = {
    comprar: {
      icon: CheckCircle,
      label: "COMPRAR",
      className: "bg-green-500/10 text-green-700 border-green-500/30",
    },
    observar: {
      icon: Eye,
      label: "OBSERVAR",
      className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
    },
    descartar: {
      icon: XCircle,
      label: "DESCARTAR",
      className: "bg-red-500/10 text-red-700 border-red-500/30",
    },
  };
  const c = config[rec];
  const Icon = c.icon;
  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-lg font-semibold ${c.className}`}
    >
      <Icon className="h-5 w-5" />
      {c.label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-muted last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

export default function SubastaDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [subasta, setSubasta] = useState<Subasta | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const decodedId = decodeURIComponent(id);
        const resp = await fetch(
          `/api/subastas?id=${encodeURIComponent(decodedId)}`
        );
        if (resp.ok) {
          setSubasta(await resp.json());
        }
        // Try to load existing analysis
        const aResp = await fetch(
          `/api/analyze?subastaId=${encodeURIComponent(decodedId)}`
        );
        if (aResp.ok) {
          setAnalysis(await aResp.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleAnalyze = async () => {
    if (!subasta) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subastaId: subasta.id }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setAnalysis(data);
      } else {
        setAnalyzeError(data.error || "Error desconocido");
      }
    } catch (e) {
      setAnalyzeError(String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!subasta) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Subasta no encontrada</p>
        <Link href="/">
          <Button variant="link">Volver</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al listado
          </Link>
          <div className="flex items-start justify-between mt-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Gavel className="h-6 w-6" />
                {subasta.identificador || subasta.id}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge>{subasta.estado || "—"}</Badge>
                <span className="text-sm text-muted-foreground">
                  {subasta.tipoSubasta}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={subasta.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver en BOE
                </Button>
              </a>
              <Button onClick={handleAnalyze} disabled={analyzing} size="sm">
                {analyzing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-1" />
                )}
                {analysis ? "Re-analizar" : "Analizar con Gemini"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue={analysis ? "analysis" : "info"}>
          <TabsList>
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="economics">Económicos</TabsTrigger>
            <TabsTrigger value="bien">Bien</TabsTrigger>
            <TabsTrigger value="raw">Datos Raw</TabsTrigger>
            {(analysis || analyzing) && (
              <TabsTrigger value="analysis">Análisis IA</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fechas y Estado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="Estado" value={subasta.estado} />
                  <InfoRow label="Tipo de subasta" value={subasta.tipoSubasta} />
                  <InfoRow label="Fecha inicio" value={subasta.fechaInicio} />
                  <InfoRow
                    label="Fecha conclusión"
                    value={subasta.fechaConclusion}
                  />
                  <InfoRow label="Lotes" value={subasta.lotes} />
                  <InfoRow label="Anuncio BOE" value={subasta.anuncioBOE} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gavel className="h-4 w-4" />
                    Autoridad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="Autoridad gestora" value={subasta.autoridad} />
                  <InfoRow
                    label="Cuenta expediente"
                    value={subasta.cuentaExpediente}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="economics" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Valor Subasta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(subasta.valorSubasta)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Tasación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(subasta.tasacion)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Puja Actual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(subasta.pujActual)}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="pt-6">
                <InfoRow label="Puja mínima" value={formatCurrency(subasta.pujaMinima)} />
                <InfoRow
                  label="Tramos entre pujas"
                  value={formatCurrency(subasta.tramosEntrePujas)}
                />
                <InfoRow
                  label="Importe depósito"
                  value={formatCurrency(subasta.importeDeposito)}
                />
                <InfoRow
                  label="Cantidad reclamada"
                  value={formatCurrency(subasta.cantidadReclamada)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bien" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Descripción del Bien
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subasta.descripcion && (
                  <p className="text-sm leading-relaxed">
                    {subasta.descripcion}
                  </p>
                )}
                <Separator />
                <InfoRow label="Dirección" value={subasta.direccion} />
                <InfoRow label="Código Postal" value={subasta.codigoPostal} />
                <InfoRow label="Localidad" value={subasta.localidad} />
                <InfoRow label="Provincia" value={subasta.provincia} />
                <InfoRow
                  label="Situación posesoria"
                  value={subasta.situacionPosesoria}
                />
                <InfoRow label="Visitable" value={subasta.visitable} />
                <InfoRow
                  label="Referencia catastral"
                  value={subasta.referenciaCatastral}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <pre className="text-xs overflow-auto max-h-[600px] whitespace-pre-wrap">
                  {JSON.stringify(subasta.rawData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {(analysis || analyzing) && (
            <TabsContent value="analysis" className="space-y-4 mt-4">
              {analyzing ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Analizando con Gemini AI...
                    </p>
                  </CardContent>
                </Card>
              ) : analyzeError ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      <p>{analyzeError}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : analysis ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Puntuación de Oportunidad
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScoreBar score={analysis.oportunidad} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Recomendación
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RecomendacionBadge rec={analysis.recomendacion} />
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Resumen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">
                        {analysis.resumen}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Riesgos Identificados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.riesgos.map((r, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="text-destructive mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Análisis Detallado
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm leading-relaxed whitespace-pre-line">
                        {analysis.detalles}
                      </div>
                    </CardContent>
                  </Card>

                  <p className="text-xs text-muted-foreground text-right">
                    Analizado el{" "}
                    {new Date(analysis.analyzedAt).toLocaleString("es-ES")}
                  </p>
                </>
              ) : null}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </main>
  );
}

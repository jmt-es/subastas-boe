"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useAnalysis } from "@/lib/use-subastas";
import type { Subasta, Documento } from "@/lib/scraper";
import type { AnalysisResult } from "@/lib/storage";

function formatCurrency(value?: string): string {
  if (!value) return "—";
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
      ? "bg-emerald-500"
      : score >= 4
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-3xl font-black tabular-nums">{score}</span>
      <span className="text-sm text-muted-foreground">/10</span>
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
      className:
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    observar: {
      icon: Eye,
      label: "OBSERVAR",
      className:
        "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    descartar: {
      icon: XCircle,
      label: "DESCARTAR",
      className: "bg-red-500/10 text-red-400 border-red-500/30",
    },
  };
  const c = config[rec];
  const Icon = c.icon;
  return (
    <div
      className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-lg border font-black tracking-widest text-sm ${c.className}`}
    >
      <Icon className="h-5 w-5" />
      {c.label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-medium text-sm text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border/50 bg-card/50"
      }`}
    >
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">
        {label}
      </p>
      <p
        className={`text-xl font-bold font-mono tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export default function SubastaDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getAnalysis } = useAnalysis();
  const [subasta, setSubasta] = useState<Subasta | null>(null);
  const [loadingSubastas, setLoadingSubastas] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    const decodedId = decodeURIComponent(id);
    async function load() {
      try {
        // Fetch subasta directly from MongoDB
        const resp = await fetch(`/api/subastas/${encodeURIComponent(decodedId)}`);
        if (resp.ok) {
          const data = await resp.json();
          setSubasta(data);
        }
        // Fetch cached analysis
        const cached = await getAnalysis(decodedId);
        if (cached) setAnalysis(cached);
      } catch (e) {
        console.error("Error loading subasta:", e);
      } finally {
        setLoadingSubastas(false);
      }
    }
    load();
  }, [id, getAnalysis]);

  const handleAnalyze = async () => {
    if (!subasta) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subasta }),
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

  if (loadingSubastas) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!subasta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Gavel className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Subasta no encontrada</p>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Volver al listado
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight font-mono">
                {subasta.identificador || subasta.id}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <Badge
                  variant="default"
                  className="text-[10px] font-bold tracking-wider"
                >
                  {subasta.estado || "—"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {subasta.tipoSubasta}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={subasta.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="text-xs">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  BOE
                </Button>
              </a>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                size="sm"
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {analyzing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Brain className="h-3.5 w-3.5 mr-1" />
                )}
                {analysis ? "Re-analizar" : "Analizar IA"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Tabs defaultValue={analysis ? "analysis" : "economics"}>
          <TabsList className="mb-6">
            <TabsTrigger value="economics">Datos</TabsTrigger>
            <TabsTrigger value="bien">Bien</TabsTrigger>
            <TabsTrigger value="partes">Partes</TabsTrigger>
            {subasta.documentos && subasta.documentos.length > 0 && (
              <TabsTrigger value="docs">
                <FileText className="h-3.5 w-3.5 mr-1" />
                Docs
              </TabsTrigger>
            )}
            <TabsTrigger value="raw">Raw</TabsTrigger>
            {(analysis || analyzing) && (
              <TabsTrigger value="analysis">
                <Brain className="h-3.5 w-3.5 mr-1" />
                IA
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="economics" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MoneyCard label="Valor Subasta" value={subasta.valorSubasta} />
              <MoneyCard label="Tasación" value={subasta.tasacion} />
              <MoneyCard label="Puja Mínima" value={subasta.pujaMinima} />
              <MoneyCard
                label="Puja Actual"
                value={subasta.pujActual}
                highlight
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
                  Importes
                </h3>
                <InfoRow
                  label="Tramos entre pujas"
                  value={formatCurrency(subasta.tramosEntrePujas)}
                />
                <InfoRow
                  label="Depósito"
                  value={formatCurrency(subasta.importeDeposito)}
                />
                <InfoRow
                  label="Cantidad reclamada"
                  value={formatCurrency(subasta.cantidadReclamada)}
                />
                <InfoRow label="Lotes" value={subasta.lotes} />
              </div>

              <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
                  Fechas y Estado
                </h3>
                <InfoRow label="Estado" value={subasta.estado} />
                <InfoRow label="Tipo" value={subasta.tipoSubasta} />
                <InfoRow label="Inicio" value={subasta.fechaInicio} />
                <InfoRow label="Conclusión" value={subasta.fechaConclusion} />
                <InfoRow label="Autoridad" value={subasta.autoridad} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bien" className="space-y-6">
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Descripción del Bien
                </h3>
                {subasta.tipoBienDetalle && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {subasta.tipoBienDetalle}
                  </Badge>
                )}
              </div>
              {subasta.descripcion && (
                <p className="text-sm leading-relaxed mb-4">
                  {subasta.descripcion}
                </p>
              )}
              <Separator className="my-4 bg-border/30" />
              <InfoRow label="Dirección" value={subasta.direccion} />
              <InfoRow label="CP" value={subasta.codigoPostal} />
              <InfoRow label="Localidad" value={subasta.localidad} />
              <InfoRow label="Provincia" value={subasta.provincia} />
              <InfoRow label="Vivienda habitual" value={subasta.viviendaHabitual} />
              <InfoRow label="Posesión" value={subasta.situacionPosesoria} />
              <InfoRow label="Visitable" value={subasta.visitable} />
              <InfoRow label="Ref. Catastral" value={subasta.referenciaCatastral} />
              <InfoRow label="Inscripción registral" value={subasta.inscripcionRegistral} />
              <InfoRow label="CSV Certificación" value={subasta.csvCertificacion} />
              <InfoRow label="Info registral electrónica" value={subasta.infoRegistralElectronica} />
              <InfoRow label="Info adicional" value={subasta.infoAdicional} />
              <InfoRow label="Cargas" value={subasta.cargas} />
            </div>
          </TabsContent>

          <TabsContent value="partes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Autoridad gestora */}
              <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Autoridad Gestora
                  </h3>
                </div>
                <InfoRow label="Descripción" value={subasta.autoridad} />
                <InfoRow label="Código" value={subasta.autoridadCodigo} />
                <InfoRow label="Dirección" value={subasta.autoridadDireccion} />
                {subasta.autoridadTelefono && (
                  <div className="flex justify-between py-2.5 border-b border-border/30 last:border-0">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Teléfono
                    </span>
                    <span className="font-medium text-sm">{subasta.autoridadTelefono}</span>
                  </div>
                )}
                {subasta.autoridadEmail && (
                  <div className="flex justify-between py-2.5 border-b border-border/30 last:border-0">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </span>
                    <span className="font-medium text-sm">{subasta.autoridadEmail}</span>
                  </div>
                )}
                <InfoRow label="Fax" value={subasta.autoridadFax} />
              </div>

              {/* Acreedor */}
              {subasta.acreedor && (
                <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Gavel className="h-4 w-4 text-primary" />
                    <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      Acreedor
                    </h3>
                  </div>
                  <InfoRow label="Nombre" value={subasta.acreedor.nombre} />
                  <InfoRow label="NIF" value={subasta.acreedor.nif} />
                  <InfoRow label="Dirección" value={subasta.acreedor.direccion} />
                  <InfoRow label="Localidad" value={subasta.acreedor.localidad} />
                  <InfoRow label="Provincia" value={subasta.acreedor.provincia} />
                  <InfoRow label="País" value={subasta.acreedor.pais} />
                </div>
              )}
            </div>
          </TabsContent>

          {subasta.documentos && subasta.documentos.length > 0 && (
            <TabsContent value="docs" className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    Documentos
                  </h3>
                </div>
                <div className="space-y-2">
                  {subasta.documentos.map((doc: Documento, i: number) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-md border border-border/30 hover:border-primary/30 hover:bg-primary/[0.03] transition-colors group"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">{doc.titulo}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="raw">
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
              <pre className="text-xs font-mono overflow-auto max-h-[600px] whitespace-pre-wrap text-muted-foreground">
                {JSON.stringify(subasta.rawData, null, 2)}
              </pre>
            </div>
          </TabsContent>

          {(analysis || analyzing) && (
            <TabsContent value="analysis" className="space-y-6">
              {analyzing ? (
                <div className="rounded-lg border border-border/50 bg-card/50 p-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Analizando con Gemini AI...
                  </p>
                </div>
              ) : analyzeError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm">{analyzeError}</p>
                  </div>
                </div>
              ) : analysis ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
                        Oportunidad
                      </h3>
                      <ScoreBar score={analysis.oportunidad} />
                    </div>
                    <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4">
                        Recomendación
                      </h3>
                      <RecomendacionBadge rec={analysis.recomendacion} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                    <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
                      Resumen
                    </h3>
                    <p className="text-sm leading-relaxed">
                      {analysis.resumen}
                    </p>
                  </div>

                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
                    <h3 className="text-[10px] font-bold tracking-widest text-destructive uppercase mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Riesgos
                    </h3>
                    <ul className="space-y-2">
                      {analysis.riesgos.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="text-destructive mt-0.5 font-bold">
                            •
                          </span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                    <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-3 flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      Análisis Detallado
                    </h3>
                    <div className="text-sm leading-relaxed whitespace-pre-line">
                      {analysis.detalles}
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground/50 text-right tracking-wider">
                    Analizado{" "}
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

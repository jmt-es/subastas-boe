"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  DollarSign,
  Scale,
  Home,
  TrendingUp,
  Target,
  BookOpen,
  Shield,
  Sparkles,
  Copy,
  Check,
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
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    observar: {
      icon: Eye,
      label: "OBSERVAR",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
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

function BulletSection({
  title,
  icon: Icon,
  items,
  color = "primary",
}: {
  title: string;
  icon: React.ElementType;
  items: string[];
  color?: "primary" | "destructive" | "emerald" | "amber";
}) {
  if (!items || items.length === 0) return null;
  const colors = {
    primary: {
      border: "border-border/50",
      bg: "bg-card/50",
      icon: "text-primary",
      bullet: "text-primary",
      title: "text-muted-foreground",
    },
    destructive: {
      border: "border-destructive/20",
      bg: "bg-destructive/5",
      icon: "text-destructive",
      bullet: "text-destructive",
      title: "text-destructive",
    },
    emerald: {
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      icon: "text-emerald-400",
      bullet: "text-emerald-400",
      title: "text-emerald-400",
    },
    amber: {
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      icon: "text-amber-400",
      bullet: "text-amber-400",
      title: "text-amber-400",
    },
  };
  const c = colors[color];
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-6`}>
      <h3
        className={`text-[10px] font-bold tracking-widest uppercase mb-4 flex items-center gap-2 ${c.title}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
            <span className={`mt-1.5 font-bold text-[8px] ${c.bullet}`}>●</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyAnalysisButton({ analysis, subasta }: { analysis: AnalysisResult; subasta?: Subasta | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `# Análisis IA — ${analysis.subastaId}`,
      `Score: ${analysis.oportunidad}/10 | Recomendación: ${analysis.recomendacion}`,
      ``,
      `## Resumen`,
      analysis.resumen,
      ``,
      subasta?.pujActual ? `## Puja Actual: ${subasta.pujActual}` : "",
      subasta?.valorSubasta ? `Valor subasta: ${subasta.valorSubasta}` : "",
      subasta?.tasacion ? `Tasación: ${subasta.tasacion}` : "",
      ``,
      `## Económico`,
      analysis.economico?.valorMercadoEstimado ? `Valor mercado: ${analysis.economico.valorMercadoEstimado}` : "",
      analysis.economico?.descuentoEstimado ? `Descuento: ${analysis.economico.descuentoEstimado}` : "",
      analysis.economico?.rentabilidadEstimada ? `Rentabilidad: ${analysis.economico.rentabilidadEstimada}` : "",
      ...(analysis.economico?.items || []).map(i => `- ${i}`),
      ``,
      `## Cargas`,
      ...analysis.cargas.map(i => `- ${i}`),
      ``,
      `## Situación Jurídica`,
      ...analysis.situacionJuridica.map(i => `- ${i}`),
      ``,
      `## Posesión`,
      ...analysis.posesion.map(i => `- ${i}`),
      ``,
      `## Ubicación`,
      ...analysis.ubicacion.map(i => `- ${i}`),
      ``,
      `## Oportunidades`,
      ...analysis.oportunidades.map(i => `- ${i}`),
      ``,
      `## Riesgos`,
      ...analysis.riesgos.map(i => `- ${i}`),
      ``,
      `## Estrategia de Puja`,
      ...analysis.estrategiaPuja.map(i => `- ${i}`),
      ``,
      `## Datos Raw`,
      "```json",
      JSON.stringify(subasta?.rawData || {}, null, 2),
      "```",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button onClick={handleCopy} variant="outline" size="sm" className="h-9">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copiar análisis + raw
        </>
      )}
    </Button>
  );
}

function AnalysisTab({
  analysis,
  analyzing,
  analyzeError,
  subasta,
}: {
  analysis: AnalysisResult | null;
  analyzing: boolean;
  analyzeError: string | null;
  subasta?: Subasta | null;
}) {
  if (analyzing) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/50 p-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-sm text-muted-foreground">
          Analizando con Gemini AI...
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          Esto puede tardar 10-20 segundos
        </p>
      </div>
    );
  }

  if (analyzeError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">{analyzeError}</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const eco = analysis.economico;

  return (
    <div className="space-y-5">
      {/* Score + Recommendation + Copy */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Análisis Gemini IA</h3>
        <CopyAnalysisButton analysis={analysis} subasta={subasta} />
      </div>

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

      {/* Resumen */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
        <h3 className="text-[10px] font-bold tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
          <Brain className="h-3.5 w-3.5" />
          Resumen
        </h3>
        <p className="text-sm leading-relaxed">{analysis.resumen}</p>
      </div>

      {/* Desglose Económico */}
      {eco && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-6">
          <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-5 flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            Desglose Económico
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {[
              {
                label: "Valor mercado estimado",
                value: eco.valorMercadoEstimado,
                highlight: true,
              },
              { label: "Descuento vs mercado", value: eco.descuentoEstimado },
              { label: "Depósito necesario", value: eco.depositoNecesario },
              {
                label: "Costes totales estimados",
                value: eco.costesTotalesEstimados,
                highlight: true,
              },
              {
                label: "Rentabilidad estimada",
                value: eco.rentabilidadEstimada,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-md border p-3.5 ${
                  item.highlight
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/30 bg-background/50"
                }`}
              >
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
                  {item.label}
                </p>
                <p
                  className={`text-sm font-bold font-mono ${item.highlight ? "text-primary" : ""}`}
                >
                  {item.value || "—"}
                </p>
              </div>
            ))}
          </div>

          {eco.items && eco.items.length > 0 && (
            <>
              <Separator className="mb-4 bg-border/30" />
              <h4 className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mb-3">
                Desglose detallado
              </h4>
              <ul className="space-y-2">
                {eco.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <span className="text-primary mt-1.5 font-bold text-[8px]">
                      ●
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Cargas */}
      <BulletSection
        title="Cargas del inmueble"
        icon={Scale}
        items={analysis.cargas}
        color="amber"
      />

      {/* Situación Jurídica */}
      <BulletSection
        title="Situación Jurídica"
        icon={Shield}
        items={analysis.situacionJuridica}
      />

      {/* Posesión */}
      <BulletSection
        title="Posesión y Ocupación"
        icon={Home}
        items={analysis.posesion}
      />

      {/* Ubicación */}
      <BulletSection
        title="Análisis de Ubicación"
        icon={MapPin}
        items={analysis.ubicacion}
      />

      {/* Oportunidades */}
      <BulletSection
        title="Oportunidades"
        icon={Sparkles}
        items={analysis.oportunidades}
        color="emerald"
      />

      {/* Riesgos */}
      <BulletSection
        title="Riesgos"
        icon={AlertTriangle}
        items={analysis.riesgos}
        color="destructive"
      />

      {/* Estrategia de Puja */}
      <BulletSection
        title="Estrategia de Puja"
        icon={Target}
        items={analysis.estrategiaPuja}
      />

      {/* Glosario */}
      {analysis.glosario && analysis.glosario.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-6">
          <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-4 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Glosario de Términos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.glosario.map((g, i) => (
              <div
                key={i}
                className="rounded-md border border-border/30 bg-background/50 p-3.5"
              >
                <p className="text-xs font-bold text-primary mb-1">
                  {g.termino}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {g.explicacion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost & metadata */}
      <div className="rounded-lg border border-border/30 bg-card/30 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
          <span>
            Analizado{" "}
            {new Date(analysis.analyzedAt).toLocaleString("es-ES")}
          </span>
          {analysis.usage && (
            <>
              <span className="text-border/50">|</span>
              <span className="font-mono">{analysis.usage.model}</span>
              {analysis.usage.docsAttached != null && analysis.usage.docsAttached > 0 && (
                <>
                  <span className="text-border/50">|</span>
                  <span className="text-emerald-400 font-semibold">
                    {analysis.usage.docsAttached} PDF{analysis.usage.docsAttached > 1 ? "s" : ""} adjuntos
                  </span>
                </>
              )}
            </>
          )}
        </div>
        {analysis.usage && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground/60">
              <span className="font-mono">
                {analysis.usage.inputTokens.toLocaleString("es-ES")}
              </span>{" "}
              in
            </span>
            <span className="text-muted-foreground/60">
              <span className="font-mono">
                {analysis.usage.outputTokens.toLocaleString("es-ES")}
              </span>{" "}
              out
            </span>
            <span className="text-muted-foreground/60">
              <span className="font-mono">
                {analysis.usage.totalTokens.toLocaleString("es-ES")}
              </span>{" "}
              total
            </span>
            <span className="text-border/50">|</span>
            <span className="font-mono font-bold text-primary">
              ${analysis.usage.costUsd.toFixed(4)}
            </span>
          </div>
        )}
      </div>
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
        const resp = await fetch(
          `/api/subastas/${encodeURIComponent(decodedId)}`
        );
        if (resp.ok) {
          const data = await resp.json();
          setSubasta(data);
        }
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
              <InfoRow
                label="Vivienda habitual"
                value={subasta.viviendaHabitual}
              />
              <InfoRow label="Posesión" value={subasta.situacionPosesoria} />
              <InfoRow label="Visitable" value={subasta.visitable} />
              <InfoRow
                label="Ref. Catastral"
                value={subasta.referenciaCatastral}
              />
              <InfoRow
                label="Inscripción registral"
                value={subasta.inscripcionRegistral}
              />
              <InfoRow
                label="CSV Certificación"
                value={subasta.csvCertificacion}
              />
              <InfoRow
                label="Info registral electrónica"
                value={subasta.infoRegistralElectronica}
              />
              <InfoRow label="Info adicional" value={subasta.infoAdicional} />
              <InfoRow label="Cargas" value={subasta.cargas} />
            </div>
          </TabsContent>

          <TabsContent value="partes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <span className="font-medium text-sm">
                      {subasta.autoridadTelefono}
                    </span>
                  </div>
                )}
                {subasta.autoridadEmail && (
                  <div className="flex justify-between py-2.5 border-b border-border/30 last:border-0">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </span>
                    <span className="font-medium text-sm">
                      {subasta.autoridadEmail}
                    </span>
                  </div>
                )}
                <InfoRow label="Fax" value={subasta.autoridadFax} />
              </div>

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
                  <InfoRow
                    label="Dirección"
                    value={subasta.acreedor.direccion}
                  />
                  <InfoRow
                    label="Localidad"
                    value={subasta.acreedor.localidad}
                  />
                  <InfoRow
                    label="Provincia"
                    value={subasta.acreedor.provincia}
                  />
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
            <TabsContent value="analysis">
              <AnalysisTab
                analysis={analysis}
                analyzing={analyzing}
                analyzeError={analyzeError}
                subasta={subasta}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </main>
  );
}

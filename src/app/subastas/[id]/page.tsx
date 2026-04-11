"use client";

import { use, useEffect, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Building2,
  Check,
  CheckCircle,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Gavel,
  Home,
  Landmark,
  Loader2,
  Map,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalysis } from "@/lib/use-subastas";
import type { Documento, Subasta } from "@/lib/scraper";
import type { AnalysisResult } from "@/lib/storage";

function formatCurrency(value?: string): string {
  if (!value) return "—";
  const num = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

function recommendationLabel(rec: "comprar" | "observar" | "descartar") {
  if (rec === "comprar") return "Comprar";
  if (rec === "observar") return "Observar";
  return "Descartar";
}

function recommendationClasses(rec: "comprar" | "observar" | "descartar") {
  if (rec === "comprar") {
    return "border-[#e5be74]/30 bg-[#e5be74]/10 text-[#e5be74]";
  }
  if (rec === "observar") {
    return "border-primary/25 bg-primary/10 text-primary";
  }
  return "border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]";
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

  return normalizeText(subasta.tipoBienDetalle) || "Activo judicial";
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

function descriptionExcerpt(value?: string, maxLength = 340) {
  const normalized = normalizeText(value);
  if (!normalized) return "El expediente no trae una descripcion legible en origen.";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
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

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-[#e5be74]"
      : score >= 40
        ? "bg-primary"
        : "bg-[#ffb4ab]";

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <span className="font-mono text-7xl font-light tracking-[-0.08em] text-[#e5be74]">
          {score}
        </span>
        <span className="pb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
          /100
        </span>
      </div>
      <div className="h-2 overflow-hidden bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function RecomendacionBadge({
  rec,
}: {
  rec: "comprar" | "observar" | "descartar";
}) {
  const Icon =
    rec === "comprar" ? CheckCircle : rec === "observar" ? Brain : XCircle;

  return (
    <span
      className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] ${recommendationClasses(
        rec
      )}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {recommendationLabel(rec)}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-3 border-b border-border/30 py-3 last:border-b-0 md:grid-cols-[0.8fr_1.2fr]">
      <span className="tech-label">{label}</span>
      <span className="text-sm leading-7 text-foreground">{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string;
  accent?: "blue" | "gold";
}) {
  const tone = accent === "gold" ? "text-[#e5be74]" : "text-primary";
  return (
    <div className="war-panel-muted p-4 md:p-5">
      <p className="tech-label">{label}</p>
      <p className={`mt-3 font-mono text-xl md:text-2xl ${tone}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  hint,
  accent = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "gold" | "danger";
}) {
  const tone =
    accent === "gold"
      ? "text-[#e5be74]"
      : accent === "danger"
        ? "text-[#ffb4ab]"
        : "text-primary";

  return (
    <div className="war-panel-muted p-4 md:p-5">
      <p className="tech-label">{label}</p>
      <p className={`mt-3 font-mono text-2xl tracking-[-0.05em] ${tone}`}>{value}</p>
      {hint && <p className="mt-2 text-xs leading-6 text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DossierSection({
  title,
  icon: Icon,
  children,
  accent = "primary",
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
  accent?: "primary" | "gold" | "danger";
}) {
  const accentClass =
    accent === "gold"
      ? "text-[#e5be74]"
      : accent === "danger"
        ? "text-[#ffb4ab]"
        : "text-primary";

  return (
    <section className="war-panel p-5 md:p-6">
      <div className={`mb-5 flex items-center gap-2 ${accentClass}`}>
        <Icon className="h-4 w-4" />
        <h3 className="tech-label text-current">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function BulletSection({
  title,
  icon: Icon,
  items,
  accent = "primary",
}: {
  title: string;
  icon: ElementType;
  items: string[];
  accent?: "primary" | "gold" | "danger";
}) {
  if (!items || items.length === 0) return null;

  const accentClass =
    accent === "gold"
      ? "text-[#e5be74]"
      : accent === "danger"
        ? "text-[#ffb4ab]"
        : "text-primary";

  return (
    <DossierSection title={title} icon={Icon} accent={accent}>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-3 text-sm leading-7 text-foreground">
            <span className={`mt-2 h-1.5 w-1.5 ${accentClass} bg-current`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </DossierSection>
  );
}

function CopyAnalysisButton({
  analysis,
  subasta,
}: {
  analysis: AnalysisResult;
  subasta?: Subasta | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = [
      `# Analisis IA - ${analysis.subastaId}`,
      `Score: ${analysis.oportunidad}/100 | Recomendacion: ${analysis.recomendacion}`,
      "",
      "## Resumen",
      analysis.resumen,
      "",
      subasta?.pujActual ? `## Puja actual: ${subasta.pujActual}` : "",
      subasta?.valorSubasta ? `Valor subasta: ${subasta.valorSubasta}` : "",
      subasta?.tasacion ? `Tasacion: ${subasta.tasacion}` : "",
      "",
      "## Economico",
      analysis.economico?.valorMercadoEstimado
        ? `Valor mercado: ${analysis.economico.valorMercadoEstimado}`
        : "",
      analysis.economico?.descuentoEstimado
        ? `Descuento: ${analysis.economico.descuentoEstimado}`
        : "",
      analysis.economico?.rentabilidadEstimada
        ? `Rentabilidad: ${analysis.economico.rentabilidadEstimada}`
        : "",
      ...(analysis.economico?.items || []).map((item) => `- ${item}`),
      "",
      "## Cargas",
      ...analysis.cargas.map((item) => `- ${item}`),
      "",
      "## Situacion juridica",
      ...analysis.situacionJuridica.map((item) => `- ${item}`),
      "",
      "## Posesion",
      ...analysis.posesion.map((item) => `- ${item}`),
      "",
      "## Ubicacion",
      ...analysis.ubicacion.map((item) => `- ${item}`),
      "",
      "## Oportunidades",
      ...analysis.oportunidades.map((item) => `- ${item}`),
      "",
      "## Riesgos",
      ...analysis.riesgos.map((item) => `- ${item}`),
      "",
      "## Estrategia de puja",
      ...analysis.estrategiaPuja.map((item) => `- ${item}`),
      "",
      "## Datos raw",
      "```json",
      JSON.stringify(subasta?.rawData || {}, null, 2),
      "```",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      onClick={handleCopy}
      variant="outline"
      className="h-10 border-border bg-card font-mono text-[0.65rem] uppercase tracking-[0.16em] text-foreground hover:bg-card/80"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-[#9dd7b9]" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copiar analisis
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
      <div className="war-panel-strong p-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Analizando expediente
        </p>
      </div>
    );
  }

  if (analyzeError) {
    return (
      <div className="border border-[#ffb4ab]/20 bg-[#ffb4ab]/10 p-5 text-[#ffb4ab]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-mono text-xs uppercase tracking-[0.18em]">
            {analyzeError}
          </span>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const eco = analysis.economico;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <DossierSection title="Oportunidad" icon={Target} accent="gold">
          <ScoreBar score={analysis.oportunidad} />
          <div className="mt-6">
            <RecomendacionBadge rec={analysis.recomendacion} />
          </div>
        </DossierSection>

        <DossierSection title="Resumen ejecutivo" icon={Brain}>
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <p className="max-w-3xl text-sm leading-8 text-foreground">{analysis.resumen}</p>
            <CopyAnalysisButton analysis={analysis} subasta={subasta} />
          </div>
        </DossierSection>
      </div>

      {eco && (
        <DossierSection title="Desglose economico" icon={DollarSign}>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Valor mercado",
                value: eco.valorMercadoEstimado,
                accent: "blue" as const,
              },
              {
                label: "Descuento",
                value: eco.descuentoEstimado,
                accent: "gold" as const,
              },
              {
                label: "Deposito necesario",
                value: eco.depositoNecesario,
                accent: "blue" as const,
              },
              {
                label: "Costes totales",
                value: eco.costesTotalesEstimados,
                accent: "gold" as const,
              },
              {
                label: "Rentabilidad",
                value: eco.rentabilidadEstimada,
                accent: "blue" as const,
              },
            ].map((item) => (
              <div key={item.label} className="war-panel-muted p-4">
                <p className="tech-label">{item.label}</p>
                <p
                  className={`mt-3 font-mono text-lg ${
                    item.accent === "gold" ? "text-[#e5be74]" : "text-primary"
                  }`}
                >
                  {item.value || "—"}
                </p>
              </div>
            ))}
          </div>

          {eco.items && eco.items.length > 0 && (
            <>
              <Separator className="my-5 bg-border/30" />
              <ul className="space-y-3">
                {eco.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm leading-7 text-foreground">
                    <span className="mt-2 h-1.5 w-1.5 bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DossierSection>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <BulletSection
          title="Cargas del inmueble"
          icon={Scale}
          items={analysis.cargas}
          accent="gold"
        />
        <BulletSection
          title="Situacion juridica"
          icon={Shield}
          items={analysis.situacionJuridica}
        />
        <BulletSection
          title="Posesion y ocupacion"
          icon={Home}
          items={analysis.posesion}
        />
        <BulletSection
          title="Analisis de ubicacion"
          icon={MapPin}
          items={analysis.ubicacion}
        />
        <BulletSection
          title="Oportunidades"
          icon={Sparkles}
          items={analysis.oportunidades}
          accent="gold"
        />
        <BulletSection
          title="Riesgos"
          icon={AlertTriangle}
          items={analysis.riesgos}
          accent="danger"
        />
      </div>

      <BulletSection
        title="Estrategia de puja"
        icon={Target}
        items={analysis.estrategiaPuja}
      />

      {analysis.glosario && analysis.glosario.length > 0 && (
        <DossierSection title="Glosario" icon={FileText}>
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.glosario.map((item, index) => (
              <div key={index} className="war-panel-muted p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#e5be74]">
                  {item.termino}
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {item.explicacion}
                </p>
              </div>
            ))}
          </div>
        </DossierSection>
      )}

      <div className="war-panel-muted flex flex-col gap-3 p-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="font-mono uppercase tracking-[0.16em]">
          Analizado {new Date(analysis.analyzedAt).toLocaleString("es-ES")}
        </div>
        {analysis.usage && (
          <div className="flex flex-wrap items-center gap-3 font-mono uppercase tracking-[0.16em]">
            <span>{analysis.usage.model}</span>
            <span>{analysis.usage.totalTokens.toLocaleString("es-ES")} tokens</span>
            <span className="text-primary">${analysis.usage.costUsd.toFixed(4)}</span>
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
  const [loadingSubasta, setLoadingSubasta] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    const decodedId = decodeURIComponent(id);

    async function load() {
      try {
        const resp = await fetch(`/api/subastas/${encodeURIComponent(decodedId)}`);
        if (resp.ok) {
          const data = await resp.json();
          setSubasta(data);
        }
        const cached = await getAnalysis(decodedId);
        if (cached) setAnalysis(cached);
      } catch (error) {
        console.error("Error loading subasta:", error);
      } finally {
        setLoadingSubasta(false);
      }
    }

    void load();
  }, [getAnalysis, id]);

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
      if (resp.ok) setAnalysis(data);
      else setAnalyzeError(data.error || "Error desconocido");
    } catch (error) {
      setAnalyzeError(String(error));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingSubasta) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Cargando dossier
        </div>
      </div>
    );
  }

  if (!subasta) {
    return (
      <div className="min-h-screen bg-background px-4">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center border border-primary/15 bg-primary/10 text-primary">
            <Gavel className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-4xl tracking-[-0.05em]">Subasta no encontrada.</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            El expediente solicitado no existe o ya no esta disponible en la base.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center gap-2 bg-primary px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  const closingDays = daysUntil(subasta.fechaConclusion);
  const closingValue =
    closingDays === null
      ? "Sin fecha"
      : closingDays <= 0
        ? "Cerrada"
        : `${closingDays}d`;
  const closingAccent =
    closingDays === null ? "primary" : closingDays <= 3 ? "danger" : closingDays <= 7 ? "gold" : "primary";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 xl:px-8">
          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#e5be74]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al radar
            </Link>
            <div className="flex items-center gap-3">
              <p className="font-heading text-3xl leading-none tracking-[-0.06em] text-primary">
                Subasta
              </p>
              <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                {subasta.identificador || subasta.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a href={subasta.url} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                className="h-11 rounded-full border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-foreground hover:bg-card/80"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                BOE
              </Button>
            </a>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="h-11 rounded-full bg-primary px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary-foreground hover:bg-[#e5be74]"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5" />
              )}
              {analysis ? "Re-analizar" : "Analizar IA"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-6 xl:px-8 xl:py-10">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_360px]">
          <div className="war-panel-strong overflow-hidden p-6 md:p-8 lg:p-10">
            <span className="section-kicker">Dossier del activo</span>
            <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
              {subasta.identificador || subasta.id}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl leading-[0.92] tracking-[-0.07em] md:text-6xl xl:text-7xl">
              {displayTitle(subasta)}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
              {displayMeta(subasta)}
            </p>
            <p className="mt-6 max-w-4xl text-sm leading-8 text-foreground/90 md:text-base">
              {descriptionExcerpt(subasta.descripcion)}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="signal-chip text-[#e5be74]">
                {subasta.estado || "Estado no indicado"}
              </span>
              {analysis && <RecomendacionBadge rec={analysis.recomendacion} />}
              <span className="rounded-full border border-border px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                {subasta.documentos?.length || 0} docs
              </span>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Valor subasta" value={subasta.valorSubasta} accent="blue" />
              <MetricCard label="Tasacion" value={subasta.tasacion} accent="gold" />
              <MetricCard label="Puja minima" value={subasta.pujaMinima} accent="blue" />
              <MetricCard label="Puja actual" value={subasta.pujActual} accent="gold" />
            </div>
          </div>

          <div className="space-y-4">
            {analysis ? (
              <section className="war-panel-strong p-6">
                <p className="tech-label text-[#e5be74]">Lectura IA</p>
                <div className="mt-4">
                  <ScoreBar score={analysis.oportunidad} />
                </div>
                <div className="mt-6">
                  <RecomendacionBadge rec={analysis.recomendacion} />
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {analysis.resumen}
                </p>
              </section>
            ) : (
              <section className="war-panel p-6">
                <p className="tech-label text-primary">Lectura IA</p>
                <h2 className="mt-4 text-3xl leading-[0.95] tracking-[-0.05em]">
                  El expediente ya esta listo para analizar.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  Pulsa el boton de Analizar IA para generar resumen ejecutivo, riesgos,
                  estrategia de puja y lectura economica.
                </p>
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <SnapshotCard
                label="Cierre"
                value={closingValue}
                hint={subasta.fechaConclusion || "Fecha no indicada"}
                accent={closingAccent}
              />
              <SnapshotCard
                label="Ubicacion"
                value={subasta.localidad || provinceLabel(subasta.provincia) || "Sin ubicar"}
                hint={subasta.direccion || "Direccion pendiente"}
              />
              <SnapshotCard
                label="Autoridad"
                value={subasta.autoridadCodigo || "Sin codigo"}
                hint={subasta.autoridad || "Autoridad no informada"}
              />
            </div>
          </div>
        </section>

        <div className="war-panel p-3 md:p-4">
          <Tabs defaultValue={analysis ? "analysis" : "economics"}>
            <TabsList
              variant="line"
              className="w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-border bg-transparent px-0 pb-3"
            >
              <TabsTrigger
                value="economics"
                className="h-11 rounded-full border border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] data-active:border-primary/25 data-active:bg-primary/10 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
              >
                Datos
              </TabsTrigger>
              <TabsTrigger
                value="bien"
                className="h-11 rounded-full border border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] data-active:border-primary/25 data-active:bg-primary/10 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
              >
                Bien
              </TabsTrigger>
              <TabsTrigger
                value="partes"
                className="h-11 rounded-full border border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] data-active:border-primary/25 data-active:bg-primary/10 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
              >
                Partes
              </TabsTrigger>
              {subasta.documentos && subasta.documentos.length > 0 && (
                <TabsTrigger
                  value="docs"
                  className="h-11 rounded-full border border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] data-active:border-primary/25 data-active:bg-primary/10 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
                >
                  Docs
                </TabsTrigger>
              )}
              <TabsTrigger
                value="raw"
                className="h-11 rounded-full border border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] data-active:border-primary/25 data-active:bg-primary/10 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
              >
                Raw
              </TabsTrigger>
              {(analysis || analyzing) && (
                <TabsTrigger
                  value="analysis"
                  className="h-11 rounded-full border border-border bg-card px-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] data-active:border-[#e5be74]/25 data-active:bg-[#e5be74]/10 data-active:text-[#e5be74] group-data-[variant=line]/tabs-list:data-active:after:opacity-0"
                >
                  IA
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="economics" className="space-y-6 pt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <DossierSection title="Importes" icon={DollarSign}>
                  <InfoRow label="Tramos entre pujas" value={subasta.tramosEntrePujas} />
                  <InfoRow label="Deposito" value={subasta.importeDeposito} />
                  <InfoRow label="Cantidad reclamada" value={subasta.cantidadReclamada} />
                  <InfoRow label="Lotes" value={subasta.lotes} />
                </DossierSection>

                <DossierSection title="Fechas y estado" icon={Gavel}>
                  <InfoRow label="Estado" value={subasta.estado} />
                  <InfoRow label="Tipo" value={subasta.tipoSubasta} />
                  <InfoRow label="Inicio" value={subasta.fechaInicio} />
                  <InfoRow label="Conclusion" value={subasta.fechaConclusion} />
                  <InfoRow label="Autoridad" value={subasta.autoridad} />
                </DossierSection>
              </div>
            </TabsContent>

            <TabsContent value="bien" className="space-y-6 pt-6">
              <DossierSection title="Descripcion del bien" icon={MapPin}>
                {subasta.descripcion && (
                  <p className="mb-5 text-sm leading-8 text-foreground">{normalizeText(subasta.descripcion)}</p>
                )}
                <InfoRow label="Direccion" value={subasta.direccion} />
                <InfoRow label="Codigo postal" value={subasta.codigoPostal} />
                <InfoRow label="Localidad" value={subasta.localidad} />
                <InfoRow label="Provincia" value={subasta.provincia} />
                <InfoRow label="Tipo de bien" value={subasta.tipoBienDetalle} />
                <InfoRow label="Vivienda habitual" value={subasta.viviendaHabitual} />
                <InfoRow label="Situacion posesoria" value={subasta.situacionPosesoria} />
                <InfoRow label="Visitable" value={subasta.visitable} />
                <InfoRow label="Referencia catastral" value={subasta.referenciaCatastral} />
                <InfoRow label="Inscripcion registral" value={subasta.inscripcionRegistral} />
                <InfoRow label="CSV certificacion" value={subasta.csvCertificacion} />
                <InfoRow
                  label="Info registral electronica"
                  value={subasta.infoRegistralElectronica}
                />
                <InfoRow label="Info adicional" value={subasta.infoAdicional} />
                <InfoRow label="Cargas" value={subasta.cargas} />

                <div className="mt-6 flex flex-wrap gap-3">
                  {subasta.direccion && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [
                          subasta.direccion
                            .replace(
                              /,?\s*(piso|puerta|pta|escalera|es:|pl:|pt:|planta|atico|bajo|entresuelo|esc)[:\s].*$/i,
                              ""
                            )
                            .replace(/,?\s*\d+[ºª°]\s*[a-z]*$/i, "")
                            .trim(),
                          subasta.localidad,
                          subasta.provincia?.split("/")[0],
                        ]
                          .filter(Boolean)
                          .join(", ")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="h-11 rounded-full border-border bg-card font-mono text-[0.65rem] uppercase tracking-[0.18em] text-foreground hover:bg-card/80"
                      >
                        <Map className="h-3.5 w-3.5" />
                        Ver en Maps
                      </Button>
                    </a>
                  )}
                  {subasta.referenciaCatastral &&
                    subasta.referenciaCatastral.toLowerCase() !== "no consta" &&
                    subasta.referenciaCatastral.length >= 14 && (
                      <a
                        href={`https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCBusqueda.aspx?del=&mun=&tipoBusqueda=1&rc1=${subasta.referenciaCatastral
                          .replace(/\s/g, "")
                          .slice(0, 7)}&rc2=${subasta.referenciaCatastral
                          .replace(/\s/g, "")
                          .slice(7, 14)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          className="h-11 rounded-full border-border bg-card font-mono text-[0.65rem] uppercase tracking-[0.18em] text-foreground hover:bg-card/80"
                        >
                          <Landmark className="h-3.5 w-3.5" />
                          Catastro
                        </Button>
                      </a>
                    )}
                </div>
              </DossierSection>
            </TabsContent>

            <TabsContent value="partes" className="space-y-6 pt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <DossierSection title="Autoridad gestora" icon={Building2}>
                  <InfoRow label="Descripcion" value={subasta.autoridad} />
                  <InfoRow label="Codigo" value={subasta.autoridadCodigo} />
                  <InfoRow label="Direccion" value={subasta.autoridadDireccion} />
                  <InfoRow label="Telefono" value={subasta.autoridadTelefono} />
                  <InfoRow label="Email" value={subasta.autoridadEmail} />
                  <InfoRow label="Fax" value={subasta.autoridadFax} />
                </DossierSection>

                {subasta.acreedor && (
                  <DossierSection title="Acreedor" icon={Gavel}>
                    <InfoRow label="Nombre" value={subasta.acreedor.nombre} />
                    <InfoRow label="NIF" value={subasta.acreedor.nif} />
                    <InfoRow label="Direccion" value={subasta.acreedor.direccion} />
                    <InfoRow label="Localidad" value={subasta.acreedor.localidad} />
                    <InfoRow label="Provincia" value={subasta.acreedor.provincia} />
                    <InfoRow label="Pais" value={subasta.acreedor.pais} />
                  </DossierSection>
                )}
              </div>
            </TabsContent>

            {subasta.documentos && subasta.documentos.length > 0 && (
              <TabsContent value="docs" className="space-y-6 pt-6">
                <DossierSection title="Documentacion" icon={FileText} accent="gold">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {subasta.documentos.map((doc: Documento, index: number) => (
                      <a
                        key={`${doc.titulo}-${index}`}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="war-panel-muted block border-l-2 border-[#e5be74] p-4 transition-colors hover:border-primary"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-primary">
                            Doc {index + 1}
                          </span>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-sm leading-7 text-foreground">{doc.titulo}</p>
                      </a>
                    ))}
                  </div>
                </DossierSection>
              </TabsContent>
            )}

            <TabsContent value="raw" className="space-y-6 pt-6">
              <div className="war-panel p-5">
                <pre className="max-h-[700px] overflow-auto text-xs leading-6 text-muted-foreground">
                  {JSON.stringify(subasta.rawData, null, 2)}
                </pre>
              </div>
            </TabsContent>

            {(analysis || analyzing) && (
              <TabsContent value="analysis" className="pt-6">
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
      </div>
    </main>
  );
}

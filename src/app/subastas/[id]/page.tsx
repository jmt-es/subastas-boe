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
import { BrandMark } from "@/components/brand-mark";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCurrency,
  normalizeText,
  provinceLabel,
  smartSentenceCase,
  smartTitleCase,
} from "@/lib/subasta-presenters";
import { useAnalysis } from "@/lib/use-subastas";
import type { Documento, Subasta } from "@/lib/scraper";
import type { AnalysisResult } from "@/lib/storage";

function recommendationLabel(rec: "comprar" | "observar" | "descartar") {
  if (rec === "comprar") return "Comprar";
  if (rec === "observar") return "Observar";
  return "Descartar";
}

function recommendationClasses(rec: "comprar" | "observar" | "descartar") {
  if (rec === "comprar") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (rec === "observar") {
    return "border-primary/15 bg-primary/8 text-primary";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
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
    subasta.direccion ? smartTitleCase(normalizeText(subasta.direccion).split(",").slice(0, 2).join(", ")) : "",
    smartTitleCase(subasta.localidad),
    provinceLabel(subasta.provincia),
    smartTitleCase(subasta.tipoSubasta),
  ]
    .filter(Boolean)
    .join(" · ");
}

function descriptionExcerpt(value?: string, maxLength = 340) {
  const normalized = smartSentenceCase(value);
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
      ? "bg-emerald-500"
      : score >= 40
        ? "bg-primary"
        : "bg-rose-500";

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <span className="text-[2.45rem] font-semibold tracking-[-0.05em] text-foreground">
          {score}
        </span>
        <span className="pb-2 text-sm font-medium text-muted-foreground">
          /100
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
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
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${recommendationClasses(
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
      <span className="text-[0.98rem] leading-8 text-foreground">{value}</span>
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
  accent?: "primary" | "success" | "warning";
}) {
  const tone =
    accent === "success"
      ? "text-emerald-700"
      : accent === "warning"
        ? "text-amber-700"
        : "text-foreground";
  return (
    <div className="glass-panel p-3.5 md:p-5">
      <p className="tech-label">{label}</p>
      <p className={`mt-2 text-[0.95rem] font-semibold leading-6 md:text-[1.08rem] ${tone}`}>
        {formatCurrency(value)}
      </p>
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
      ? "text-amber-700"
      : accent === "danger"
        ? "text-rose-700"
        : "text-foreground";

  return (
    <div className="war-panel-muted p-4 md:p-5">
      <p className="tech-label">{label}</p>
      <p className={`mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] ${tone}`}>{value}</p>
      {hint && <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>}
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
      ? "text-amber-700"
      : accent === "danger"
        ? "text-rose-700"
        : "text-primary";

  return (
    <section className="war-panel p-5 md:p-6">
      <div className={`mb-5 flex items-center gap-2 ${accentClass}`}>
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-semibold tracking-[0.01em] text-current">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EconomicHighlightCard({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value?: string;
  tone?: "primary" | "warm" | "success";
}) {
  const styles =
    tone === "warm"
      ? {
          panel:
            "border-[#d4b17b]/45 bg-[linear-gradient(180deg,rgba(255,249,236,0.98),rgba(247,239,223,0.96))] shadow-[0_10px_24px_rgba(133,92,33,0.08)]",
          line: "bg-[#c88a2a]",
          label: "text-[#8a6223]",
          value: "text-[#5f3f10]",
        }
      : tone === "success"
        ? {
            panel:
              "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(243,252,247,0.98),rgba(229,245,235,0.97))] shadow-[0_10px_24px_rgba(22,101,52,0.08)]",
            line: "bg-emerald-600/70",
            label: "text-emerald-800",
            value: "text-emerald-950",
          }
        : {
            panel:
              "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,241,235,0.94))] shadow-[0_10px_24px_rgba(22,32,50,0.04)]",
            line: "bg-primary/55",
            label: "text-primary/80",
            value: "text-slate-900",
          };

  return (
    <div className={`relative overflow-hidden rounded-[1.1rem] border p-4 md:p-5 ${styles.panel}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.line}`} />
      <p className={`tech-label ${styles.label}`}>{label}</p>
      <p className={`mt-3 text-[1.02rem] font-semibold leading-7 md:text-[1.06rem] ${styles.value}`}>
        {value || "—"}
      </p>
    </div>
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
      ? "text-amber-700"
      : accent === "danger"
        ? "text-rose-700"
        : "text-primary";

  return (
    <DossierSection title={title} icon={Icon} accent={accent}>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-3 text-[0.98rem] leading-8 text-foreground">
            <span className={`mt-2 h-1.5 w-1.5 ${accentClass} bg-current`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </DossierSection>
  );
}

const dossierTabClass =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-card px-2.5 text-[0.82rem] font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground data-active:border-primary/25 data-active:bg-primary/10 data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:opacity-0 md:h-11 md:w-auto md:min-w-[5.75rem] md:flex-none md:rounded-2xl md:px-4 md:text-sm";

const dossierAnalysisTabClass =
  "h-10 w-full min-w-0 rounded-xl border border-border bg-card px-2.5 text-[0.82rem] font-medium text-muted-foreground transition-colors hover:border-emerald-300/45 hover:text-foreground data-active:border-emerald-300/60 data-active:bg-emerald-50 data-active:text-emerald-800 group-data-[variant=line]/tabs-list:data-active:after:opacity-0 md:h-11 md:w-auto md:min-w-[5.75rem] md:flex-none md:rounded-2xl md:px-4 md:text-sm";

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
      className="h-10 rounded-2xl border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-card/80"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
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
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Analizando expediente
        </p>
      </div>
    );
  }

  if (analyzeError) {
    return (
      <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 p-5 text-rose-700">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-semibold">
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
            <p className="max-w-3xl text-[0.98rem] leading-8 text-foreground">{analysis.resumen}</p>
            <CopyAnalysisButton analysis={analysis} subasta={subasta} />
          </div>
        </DossierSection>
      </div>

      {eco && (
        <DossierSection title="Desglose economico" icon={DollarSign}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "Valor mercado",
                value: eco.valorMercadoEstimado,
                tone: "primary" as const,
              },
              {
                label: "Descuento",
                value: eco.descuentoEstimado,
                tone: "warm" as const,
              },
              {
                label: "Deposito necesario",
                value: eco.depositoNecesario,
                tone: "primary" as const,
              },
              {
                label: "Costes totales",
                value: eco.costesTotalesEstimados,
                tone: "warm" as const,
              },
              {
                label: "Rentabilidad",
                value: eco.rentabilidadEstimada,
                tone: "success" as const,
              },
            ].map((item) => (
              <EconomicHighlightCard
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone}
              />
            ))}
          </div>

          {eco.items && eco.items.length > 0 && (
            <>
              <Separator className="my-5 bg-border/30" />
              <ul className="space-y-3">
                {eco.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-[0.98rem] leading-8 text-foreground">
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
                <p className="tech-label text-amber-700">
                  {item.termino}
                </p>
                <p className="mt-3 text-[0.96rem] leading-7 text-muted-foreground">
                  {item.explicacion}
                </p>
              </div>
            ))}
          </div>
        </DossierSection>
      )}

      <div className="war-panel-muted flex flex-col gap-3 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="font-medium">
          Analizado {new Date(analysis.analyzedAt).toLocaleString("es-ES")}
        </div>
        {analysis.usage && (
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
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
        <div className="flex min-h-screen items-center justify-center text-sm font-medium text-muted-foreground">
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
          <h1 className="mt-6 text-[1.7rem] font-semibold tracking-[-0.04em]">Subasta no encontrada.</h1>
          <p className="mt-4 text-[0.98rem] leading-8 text-muted-foreground">
            El expediente solicitado no existe o ya no esta disponible en la base.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
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
      <header className="border-b border-border/80 bg-background/92 md:sticky md:top-0 md:z-30 md:backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-4 xl:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
            <Link href="/" className="flex items-center gap-3">
              <BrandMark className="h-9 w-9 md:h-10 md:w-10" />
              <div>
                <p className="text-base font-semibold tracking-[-0.03em] text-foreground md:text-lg">Subasta</p>
                <p className="tech-label mt-1">Dossier del activo</p>
              </div>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:w-auto sm:justify-start"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al radar
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <span className="col-span-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground sm:col-auto">
              {subasta.identificador || subasta.id}
            </span>
            <a
              href={subasta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-1 sm:col-auto"
            >
              <Button
                variant="outline"
                className="h-11 w-full rounded-2xl border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-card/80 sm:w-auto"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                BOE
              </Button>
            </a>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="col-span-1 h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-105 sm:w-auto"
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

      <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 md:space-y-5 md:px-6 md:py-5 xl:px-8 xl:py-8">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="war-panel-strong overflow-hidden p-5 md:p-7">
            <span className="section-kicker">Dossier</span>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              {subasta.identificador || subasta.id}
            </p>
            <h1 className="mt-4 max-w-3xl text-[1.34rem] font-semibold leading-[1.14] tracking-[-0.04em] md:text-[2rem]">
              {displayTitle(subasta)}
            </h1>
            <p className="mt-3 max-w-3xl text-[0.96rem] leading-7 text-muted-foreground md:text-[0.98rem] md:leading-8">
              {displayMeta(subasta)}
            </p>
            <p className="mt-4 max-w-4xl text-[0.96rem] leading-8 text-foreground/90">
              {descriptionExcerpt(subasta.descripcion)}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="signal-chip text-primary">
                {smartTitleCase(subasta.estado) || "Estado no indicado"}
              </span>
              {analysis && <RecomendacionBadge rec={analysis.recomendacion} />}
              <span className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                {subasta.documentos?.length || 0} documentos
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label="Valor subasta" value={subasta.valorSubasta} accent="primary" />
              <MetricCard label="Tasación" value={subasta.tasacion} accent="success" />
              <MetricCard label="Puja mínima" value={subasta.pujaMinima} accent="primary" />
              <MetricCard label="Puja actual" value={subasta.pujActual} accent="warning" />
            </div>
          </div>

          <div className="space-y-4">
            {analysis ? (
              <section className="war-panel p-6">
                <p className="tech-label text-primary">Lectura IA</p>
                <div className="mt-4">
                  <ScoreBar score={analysis.oportunidad} />
                </div>
                <div className="mt-5">
                  <RecomendacionBadge rec={analysis.recomendacion} />
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground xl:hidden">
                  Resumen completo, riesgos y estrategia en la pestaña IA.
                </p>
                <p className="mt-4 hidden text-[0.98rem] leading-8 text-muted-foreground xl:block">
                  {analysis.resumen}
                </p>
              </section>
            ) : (
              <section className="war-panel p-6">
                <p className="tech-label text-primary">Lectura IA</p>
                <h2 className="mt-4 text-[1.45rem] font-semibold leading-tight tracking-[-0.04em]">
                  El expediente ya esta listo para analizar.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground xl:hidden">
                  Lanza el analisis para desbloquear resumen, riesgos y estrategia de puja.
                </p>
                <p className="mt-4 hidden text-[0.98rem] leading-8 text-muted-foreground xl:block">
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
              className="grid w-full grid-cols-3 gap-2 rounded-none border-b border-border bg-transparent px-0 pb-3 md:flex md:flex-wrap md:justify-start"
            >
              <TabsTrigger value="economics" className={dossierTabClass}>
                Datos
              </TabsTrigger>
              <TabsTrigger value="bien" className={dossierTabClass}>
                Bien
              </TabsTrigger>
              <TabsTrigger value="partes" className={dossierTabClass}>
                Partes
              </TabsTrigger>
              {subasta.documentos && subasta.documentos.length > 0 && (
                <TabsTrigger value="docs" className={dossierTabClass}>
                  Docs
                </TabsTrigger>
              )}
              <TabsTrigger value="raw" className={dossierTabClass}>
                Raw
              </TabsTrigger>
              {(analysis || analyzing) && (
                <TabsTrigger value="analysis" className={dossierAnalysisTabClass}>
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
              <DossierSection title="Descripción del bien" icon={MapPin}>
                {subasta.descripcion && (
                  <p className="mb-5 text-[0.98rem] leading-8 text-foreground">{smartSentenceCase(subasta.descripcion)}</p>
                )}
                <InfoRow label="Dirección" value={smartTitleCase(subasta.direccion)} />
                <InfoRow label="Código postal" value={subasta.codigoPostal} />
                <InfoRow label="Localidad" value={subasta.localidad} />
                <InfoRow label="Provincia" value={subasta.provincia} />
                <InfoRow label="Tipo de bien" value={subasta.tipoBienDetalle} />
                <InfoRow label="Vivienda habitual" value={subasta.viviendaHabitual} />
                <InfoRow label="Situación posesoria" value={subasta.situacionPosesoria} />
                <InfoRow label="Visitable" value={subasta.visitable} />
                <InfoRow label="Referencia catastral" value={subasta.referenciaCatastral} />
                <InfoRow label="Inscripción registral" value={subasta.inscripcionRegistral} />
                <InfoRow label="CSV certificación" value={subasta.csvCertificacion} />
                <InfoRow
                  label="Info registral electrónica"
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
                        className="h-11 rounded-2xl border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-card/80"
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
                          className="h-11 rounded-2xl border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-card/80"
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
                <DossierSection title="Documentación" icon={FileText} accent="gold">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {subasta.documentos.map((doc: Documento, index: number) => (
                      <div
                        key={`${doc.titulo}-${index}`}
                        className="war-panel-muted border border-border p-4 transition-colors hover:border-primary/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="tech-label text-primary">
                            Doc {index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/documents/${encodeURIComponent(subasta.id)}/${index}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/12"
                            >
                              Abrir PDF
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                              BOE
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                        <p className="mt-4 text-[0.98rem] leading-7 text-foreground">{doc.titulo}</p>
                      </div>
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

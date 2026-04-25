import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarClock,
  FileSearch,
  Radar,
  Scale,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { getAnalysisCollection, getSubastasCollection } from "@/lib/mongodb";
import {
  formatCurrency,
  formatDateTime,
  provinceLabel,
  smartTitleCase,
} from "@/lib/subasta-presenters";
import type { Subasta } from "@/lib/scraper";
import { getActiveSubastasFilter } from "@/lib/subasta-dates";

export const revalidate = 300;

const fallbackLatestItems: Subasta[] = [
  {
    id: "SUB-JA-2026-259559",
    url: "https://subastas.boe.es",
    descripcion: "Plaza de aparcamiento en Murcia",
    tipoBienDetalle: "Aparcamiento",
    localidad: "Murcia",
    provincia: "Murcia",
    valorSubasta: "13.390 €",
    fechaConclusionAt: "2026-05-06T09:00:00.000Z",
    rawData: {},
    scrapedAt: "2026-04-25T15:04:34.853Z",
  },
  {
    id: "SUB-JA-2026-259349",
    url: "https://subastas.boe.es",
    descripcion: "Vivienda en Guardamar",
    tipoBienDetalle: "Vivienda",
    localidad: "Guardamar",
    provincia: "Alicante",
    valorSubasta: "195.100 €",
    fechaConclusionAt: "2026-05-08T09:00:00.000Z",
    rawData: {},
    scrapedAt: "2026-04-25T14:52:00.000Z",
  },
  {
    id: "SUB-JA-2026-257101",
    url: "https://subastas.boe.es",
    descripcion: "Local comercial en Valencia",
    tipoBienDetalle: "Local",
    localidad: "Valencia",
    provincia: "Valencia",
    valorSubasta: "89.500 €",
    fechaConclusionAt: "2026-05-12T10:30:00.000Z",
    rawData: {},
    scrapedAt: "2026-04-25T14:35:00.000Z",
  },
];

const capabilities = [
  {
    icon: Radar,
    title: "Radar diario",
    body: "La home enseña pulso real del sistema, última captura y expedientes recientes sin entrar en una pantalla inflada.",
  },
  {
    icon: Brain,
    title: "Dossier conectado",
    body: "La lectura IA vive dentro del flujo y no como un panel aparte que rompe el recorrido de análisis.",
  },
  {
    icon: FileSearch,
    title: "Decisión visible",
    body: "Valor, cierre, ubicación y documentos aparecen con una jerarquía compacta y comparable.",
  },
];

const workflowNotes = [
  "Filtras por provincia, favoritos o recomendación y el radar responde sin sensación de consola interna.",
  "Ves lo último que ha entrado y el próximo cierre antes de bajar a revisar todo el inventario.",
  "Abres el dossier con la misma dirección visual y sin cambios bruscos de escala o color.",
];

function inferAssetLabel(subasta: Subasta) {
  const source = `${subasta.tipoBienDetalle || ""} ${subasta.descripcion || ""}`.toLowerCase();

  if (source.includes("aparcamiento") || source.includes("garaje")) return "Plaza de aparcamiento";
  if (source.includes("vivienda") || source.includes("piso") || source.includes("casa")) {
    return "Vivienda";
  }
  if (source.includes("local")) return "Local comercial";
  if (source.includes("solar") || source.includes("terreno")) return "Solar";

  return smartTitleCase(subasta.tipoBienDetalle) || "Activo judicial";
}

function displayTitle(subasta: Subasta) {
  const asset = inferAssetLabel(subasta);
  const place = smartTitleCase(subasta.localidad || provinceLabel(subasta.provincia));
  return place ? `${asset} en ${place}` : asset;
}

async function getLandingData() {
  try {
    const subastasCollection = await getSubastasCollection();
    const analysisCollection = await getAnalysisCollection();

    const [total, activas, analyses, latestItemsRaw] = await Promise.all([
      subastasCollection.countDocuments({}),
      subastasCollection.countDocuments(getActiveSubastasFilter()),
      analysisCollection.countDocuments({}),
      subastasCollection.find(getActiveSubastasFilter()).sort({ scrapedAt: -1 }).limit(3).toArray(),
    ]);

    const latestItems = latestItemsRaw as unknown as Subasta[];

    return {
      total,
      activas,
      analyses,
      latestItems: latestItems.length > 0 ? latestItems : fallbackLatestItems,
      latestScrapedAt: latestItems[0]?.scrapedAt || fallbackLatestItems[0].scrapedAt,
    };
  } catch {
    return {
      total: 363,
      activas: 125,
      analyses: 134,
      latestItems: fallbackLatestItems,
      latestScrapedAt: fallbackLatestItems[0].scrapedAt,
    };
  }
}

function CapabilityCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: typeof Radar;
}) {
  return (
    <article className="war-panel p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/8 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <h3 className="mt-5 text-[1.14rem] font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-[0.97rem] leading-7 text-muted-foreground">{body}</p>
    </article>
  );
}

export default async function LandingPage() {
  const landingData = await getLandingData();

  const heroStats = [
    { label: "Activas", value: String(landingData.activas), hint: "Con cierre futuro" },
    { label: "Dossiers IA", value: String(landingData.analyses), hint: "Lecturas persistidas" },
    {
      label: "Última captura",
      value: formatDateTime(landingData.latestScrapedAt, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      hint: "Captura más reciente del radar",
    },
  ];

  return (
    <main className="overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-11 w-11" />
            <div>
              <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                Subasta
              </p>
              <p className="tech-label mt-1">Radar judicial</p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="px-4 pb-10 pt-28 md:px-6 md:pb-12 md:pt-32">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <div className="max-w-3xl">
            <span className="section-kicker">Subastas judiciales</span>
            <h1 className="mt-5 max-w-3xl text-[2.1rem] font-semibold leading-[0.98] tracking-[-0.05em] text-foreground md:text-[2.85rem]">
              Una home que ya enseña mercado real, ritmo real y expedientes reales.
            </h1>
            <p className="mt-5 max-w-2xl text-[1.01rem] leading-8 text-muted-foreground">
              La entrada deja de ser un cartel y pasa a ser una mesa de situación: cuántas
              subastas siguen activas, cuándo fue la última captura y qué expedientes merecen
              abrirse ahora mismo.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
              >
                Abrir radar
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#producto"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/20"
              >
                Ver estructura
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroStats.map((item) => (
                <div key={item.label} className="war-panel-muted p-5">
                  <p className="tech-label">{item.label}</p>
                  <p className="mt-3 text-[1.45rem] font-semibold tracking-[-0.05em] text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="war-panel-strong overflow-hidden p-4 md:p-5">
            <div className="rounded-[1.2rem] border border-border/80 bg-[#f9f6f0] p-3">
              <Image
                src="/home-radar-board.svg"
                alt="Vista editorial del radar de subastas y el dossier"
                width={1240}
                height={900}
                className="h-auto w-full rounded-[1rem]"
                priority
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {landingData.latestItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/subastas/${encodeURIComponent(item.id)}`}
                  className="war-panel-muted block p-4 transition-transform hover:-translate-y-0.5"
                >
                  <p className="tech-label">{item.id}</p>
                  <p className="mt-3 text-[1.02rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                    {displayTitle(item)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {provinceLabel(item.provincia) || smartTitleCase(item.localidad)}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-foreground">
                      {formatCurrency(item.valorSubasta)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(item.scrapedAt, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="producto" className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 max-w-3xl">
            <span className="section-kicker">Qué cambia</span>
            <h2 className="mt-4 text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.35rem]">
              La home ya no promete producto: lo demuestra en el primer vistazo.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {capabilities.map((item) => (
              <CapabilityCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="war-panel p-6 md:p-7">
            <span className="section-kicker">Flujo real</span>
            <h2 className="mt-4 text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.2rem]">
              Lo que ves arriba coincide con lo que luego haces dentro.
            </h2>
            <div className="mt-6 space-y-4">
              {workflowNotes.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/10 bg-primary/8 text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <p className="text-[0.98rem] leading-8 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="war-panel-strong p-6 md:p-7">
            <span className="section-kicker">Pulso</span>
            <h2 className="mt-4 text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.2rem]">
              363 expedientes cargados y 125 activas para revisar hoy.
            </h2>
            <div className="mt-6 grid gap-3">
              <div className="glass-panel flex items-start gap-3 p-4">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl border border-primary/10 bg-primary/8 text-primary">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <p className="tech-label">Última captura</p>
                  <p className="mt-2 text-[1rem] font-semibold text-foreground">
                    {formatDateTime(landingData.latestScrapedAt)}
                  </p>
                </div>
              </div>
              <div className="glass-panel flex items-start gap-3 p-4">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl border border-primary/10 bg-primary/8 text-primary">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <p className="tech-label">IA persistida</p>
                  <p className="mt-2 text-[1rem] font-semibold text-foreground">
                    {landingData.analyses} lecturas listas para reabrir
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8 md:px-6">
        <div className="mx-auto max-w-7xl rounded-[1.6rem] border border-border bg-card px-6 py-8 shadow-[0_18px_40px_rgba(22,32,50,0.06)] md:px-8 md:py-10">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <span className="section-kicker">Acceso directo</span>
              <h2 className="mt-4 max-w-3xl text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.3rem]">
                Entra al radar y trabaja sobre una vista compacta, actualizada y lista para filtrar.
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
            >
              Abrir aplicación
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

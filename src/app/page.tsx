import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Brain,
  FileArchive,
  Gavel,
  HeartHandshake,
  MapPinned,
  Radar,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const trustPoints = [
  "Datos públicos del BOE organizados en una sola superficie operativa",
  "Análisis IA con señales económicas, jurídicas y documentales",
  "Archivo centralizado de PDFs, favoritos y seguimiento de sesión",
  "Diseñado para inversores, analistas y equipos de sourcing inmobiliario",
];

const workflow = [
  {
    step: "01",
    title: "Scrapea el mercado",
    body: "Captura subastas activas por provincia y tipo de bien sin depender del portal oficial como superficie principal.",
  },
  {
    step: "02",
    title: "Analiza cada caso",
    body: "La IA resume la oportunidad, detecta riesgos, estima descuento y deja una lectura mucho más accionable.",
  },
  {
    step: "03",
    title: "Decide con criterio",
    body: "Ordena por score, revisa la documentación y convierte cada expediente en una tesis de inversión concreta.",
  },
];

const features = [
  {
    icon: Brain,
    title: "Prioridad IA",
    body: "Scoring, recomendación y resumen ejecutivo para no revisar expedientes a ciegas.",
  },
  {
    icon: Scale,
    title: "Lectura jurídica",
    body: "Situación posesoria, cargas, autoridad gestora y contexto legal en una sola vista.",
  },
  {
    icon: FileArchive,
    title: "Dossier documental",
    body: "Documentos adjuntos y referencias clave preparados para análisis posterior.",
  },
  {
    icon: MapPinned,
    title: "Señal territorial",
    body: "Ubicación, provincia y contexto operativo para filtrar por estrategia de búsqueda.",
  },
  {
    icon: ShieldCheck,
    title: "Monitor de sesión",
    body: "Control de cookies y estado BOE para que el pipeline operativo no se corte en mitad del proceso.",
  },
  {
    icon: Sparkles,
    title: "Favoritos y enfoque",
    body: "Guarda oportunidades, limpia ruido y mantén un shortlist de alta convicción.",
  },
];

const dashboardPreviewRows = [
  {
    type: "Vivienda",
    description: "Piso en avenida costera con documentación adjunta y puja activa",
    location: "Alicante",
    value: "168.000 €",
    score: "82",
    status: "Comprar",
  },
  {
    type: "Local",
    description: "Activo bancario en zona comercial con descuento visible frente a tasación",
    location: "Murcia",
    value: "112.000 €",
    score: "64",
    status: "Observar",
  },
  {
    type: "Solar",
    description: "Expediente con riesgo jurídico elevado y escasa información registral",
    location: "Valencia",
    value: "91.000 €",
    score: "29",
    status: "Descartar",
  },
];

function LandingMetric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="paper-panel rounded-[28px] px-5 py-4">
      <p className="font-heading text-3xl leading-none text-foreground md:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function PreviewStatus({
  label,
  tone,
}: {
  label: string;
  tone: "positive" | "neutral" | "negative";
}) {
  const toneClasses = {
    positive:
      "border-emerald-700/15 bg-emerald-700/8 text-emerald-900",
    neutral: "border-[var(--border)] bg-[var(--accent)] text-foreground",
    negative: "border-rose-900/10 bg-rose-900/6 text-rose-950",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(161,97,45,0.18),transparent_48%),radial-gradient(circle_at_top_right,rgba(43,88,66,0.14),transparent_38%)]" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/86 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-primary/20 bg-primary/10 text-primary shadow-[0_12px_30px_rgba(154,91,49,0.12)]">
              <Gavel className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading text-2xl leading-none tracking-[-0.04em] text-foreground">
                Subasta
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Judicial Intelligence
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              Método
            </a>
            <a href="#producto" className="transition-colors hover:text-foreground">
              Producto
            </a>
            <a href="#caso" className="transition-colors hover:text-foreground">
              Caso
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary"
            >
              Entrar al panel
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 md:px-6 md:pb-16 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            <Radar className="h-3.5 w-3.5" />
            Radar editorial para subastas BOE
          </div>

          <div className="space-y-5">
            <h1 className="max-w-4xl font-heading text-5xl leading-[0.94] tracking-[-0.06em] text-foreground md:text-7xl">
              Encuentra oportunidades judiciales con una lectura de mercado, no
              con una hoja caótica.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              Subasta convierte expedientes públicos del BOE en una mesa de
              trabajo clara: captura, analiza, ordena y decide con una capa de
              inteligencia pensada para inversión inmobiliaria.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_rgba(154,91,49,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(154,91,49,0.22)]"
            >
              Abrir dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary"
            >
              Ver cómo funciona
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LandingMetric value="IA + BOE" label="Fuente y lectura" />
            <LandingMetric value="PDFs" label="Archivo centralizado" />
            <LandingMetric value="Score" label="Decisión priorizada" />
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(154,91,49,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(41,92,67,0.18),transparent_36%)] blur-3xl" />
          <div className="paper-panel-strong relative overflow-hidden rounded-[36px] p-5 md:p-7">
            <div className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(154,91,49,0.5),transparent)]" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="editorial-label">Vista editorial</span>
              <span className="inline-flex items-center rounded-full border border-emerald-700/15 bg-emerald-700/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-900">
                Sesión operativa activa
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] border border-border/70 bg-[rgba(255,255,255,0.54)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Oportunidad destacada
                </p>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-heading text-3xl tracking-[-0.05em] text-foreground">
                      Piso exterior en Alicante
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Expediente con documentación adjunta, descuento visible
                      frente a tasación y recomendación positiva.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-emerald-700/15 bg-emerald-700/8 px-4 py-3 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-900">
                      Score
                    </p>
                    <p className="mt-1 font-heading text-4xl leading-none text-emerald-950">
                      82
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] bg-background/75 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Valor subasta
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      168.000 €
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-background/75 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Tasación
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      244.000 €
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-background/75 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Docs
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      4 adjuntos
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-border/70 bg-[rgba(255,255,255,0.6)] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Prioridad semanal
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Comprar", "12 activos"],
                      ["Observar", "19 expedientes"],
                      ["Descartar", "9 señales rojas"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-[20px] bg-background/80 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-primary/12 bg-primary/8 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Tesis de producto
                  </p>
                  <p className="mt-3 text-sm leading-7 text-foreground">
                    Menos navegación manual y más criterio acumulado por
                    expediente. La interfaz pública inspira confianza; el panel
                    operativo concentra la ejecución.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="paper-panel grid gap-4 rounded-[32px] p-5 md:grid-cols-2 md:p-7 lg:grid-cols-4">
          {trustPoints.map((point) => (
            <div key={point} className="rounded-[24px] bg-background/70 px-4 py-4">
              <p className="text-sm leading-6 text-foreground">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="como-funciona"
        className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24"
      >
        <div className="flex flex-col gap-4 md:max-w-3xl">
          <span className="editorial-label">Cómo funciona</span>
          <h2 className="font-heading text-4xl leading-tight tracking-[-0.05em] text-foreground md:text-6xl">
            Un flujo pensado para pasar del expediente al criterio inversor sin
            fricción.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {workflow.map((item) => (
            <article key={item.step} className="paper-panel rounded-[30px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                {item.step}
              </p>
              <h3 className="mt-4 font-heading text-3xl tracking-[-0.04em] text-foreground">
                {item.title}
              </h3>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="producto"
        className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 md:px-6 lg:grid-cols-[0.78fr_1.22fr]"
      >
        <div className="paper-panel rounded-[32px] p-6 md:p-7">
          <span className="editorial-label">Producto</span>
          <h2 className="mt-4 font-heading text-4xl leading-tight tracking-[-0.05em] text-foreground md:text-5xl">
            Una interfaz pública impecable y un backoffice listo para operar.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            La experiencia combina la calma de una publicación premium con la
            densidad útil de un terminal de análisis. Nada suena a SaaS
            genérico; todo empuja a una lectura más rápida y más informada.
          </p>
          <div className="soft-divider mt-8" />
          <div className="mt-8 space-y-4">
            {[
              {
                icon: HeartHandshake,
                text: "Una landing que transmite confianza y posicionamiento claro.",
              },
              {
                icon: TrendingUp,
                text: "Un dashboard para detectar oportunidades y ejecutar seguimiento diario.",
              },
              {
                icon: BookOpenText,
                text: "Una vista de detalle que se comporta como expediente y memo de inversión.",
              },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm leading-7 text-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <article key={title} className="paper-panel rounded-[28px] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-heading text-2xl tracking-[-0.04em] text-foreground">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="caso"
        className="mx-auto max-w-7xl px-4 pb-16 md:px-6 md:pb-24"
      >
        <div className="paper-panel-strong rounded-[34px] p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <span className="editorial-label">Caso de uso</span>
              <h2 className="mt-4 font-heading text-4xl leading-tight tracking-[-0.05em] text-foreground md:text-5xl">
                Cada expediente termina convertido en una tesis legible.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                El rediseño pone foco en lectura, criterio y confianza. La vista
                ya no parece un listado táctico sin alma, sino un sistema serio
                para trabajar oportunidades judiciales.
              </p>
            </div>

            <div className="rounded-[30px] border border-border/70 bg-background/78 p-4 md:p-5">
              <div className="overflow-hidden rounded-[24px] border border-border/80">
                <div className="grid grid-cols-[1.1fr_1.8fr_0.9fr_0.7fr_0.9fr] gap-3 border-b border-border/80 bg-card px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  <span>Tipo</span>
                  <span>Descripción</span>
                  <span>Ubicación</span>
                  <span>Score</span>
                  <span>Estado</span>
                </div>
                <div className="divide-y divide-border/80 bg-[rgba(255,255,255,0.68)]">
                  {dashboardPreviewRows.map((row) => (
                    <div
                      key={row.description}
                      className="grid grid-cols-[1.1fr_1.8fr_0.9fr_0.7fr_0.9fr] gap-3 px-4 py-4 text-sm text-foreground"
                    >
                      <span className="font-medium">{row.type}</span>
                      <div>
                        <p className="font-medium">{row.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.value}
                        </p>
                      </div>
                      <span className="text-muted-foreground">{row.location}</span>
                      <span className="font-heading text-2xl leading-none">
                        {row.score}
                      </span>
                      <PreviewStatus
                        label={row.status}
                        tone={
                          row.status === "Comprar"
                            ? "positive"
                            : row.status === "Observar"
                              ? "neutral"
                              : "negative"
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="paper-panel rounded-[36px] px-6 py-8 md:px-10 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="editorial-label">Cierre</span>
              <h2 className="mt-4 font-heading text-4xl leading-tight tracking-[-0.05em] text-foreground md:text-5xl">
                Una nueva primera impresión y un producto operativo mucho más
                sólido.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                La remodelación propone una web pública que vende confianza y un
                dashboard que transmite rigor analítico desde el primer vistazo.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_rgba(154,91,49,0.18)] transition-all hover:-translate-y-0.5"
            >
              Entrar ahora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background/76">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>Subasta. Rediseño editorial para inteligencia de subastas judiciales.</p>
          <div className="flex items-center gap-4">
            <a href="#como-funciona" className="hover:text-foreground">
              Método
            </a>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  Binary,
  Gavel,
  Radar,
  Scale,
  Sparkles,
  TimerReset,
} from "lucide-react";

const heroStats = [
  { label: "Expedientes priorizados", value: "238" },
  { label: "Casos con IA", value: "133" },
  { label: "Shortlist de hoy", value: "12" },
];

const workflow = [
  {
    step: "01",
    title: "Scrapea y centraliza",
    body: "Captura subastas del BOE sin vivir atrapado en la interfaz oficial. Todo entra en una misma superficie de trabajo.",
  },
  {
    step: "02",
    title: "Cruza senales",
    body: "La IA resume el expediente, cuantifica oportunidad, detecta riesgos y prepara una lectura mucho mas inversora.",
  },
  {
    step: "03",
    title: "Decide con tension real",
    body: "No miras una lista plana: trabajas con shortlist, urgencia, documentos y tesis de puja en el mismo sitio.",
  },
];

const advantages = [
  {
    icon: Radar,
    title: "Radar operativo",
    body: "Filtros, shortlist, provincia, favoritos y estados de recomendacion con una densidad de lectura propia de un war room.",
  },
  {
    icon: Scale,
    title: "Dossier legal",
    body: "Cada subasta se convierte en expediente: datos, bien, partes, documentos, raw y lectura IA articulada.",
  },
  {
    icon: Sparkles,
    title: "Inteligencia accionable",
    body: "Resumen ejecutivo, score, riesgos, oportunidades y estrategia de puja para ir mas alla del simple scraping.",
  },
  {
    icon: TimerReset,
    title: "Ritmo diario",
    body: "Sesion BOE, refresh, scrape y seguimiento continuo para que la operacion no dependa del caos manual.",
  },
];

const dossierRows = [
  {
    type: "Residencial",
    caseId: "SUB-ESP-24-9921",
    description: "Residential Complex Mirador del Sol, Marbella",
    score: "94.2",
    value: "1,42 M EUR",
    state: "Comprar",
  },
  {
    type: "Industrial",
    caseId: "SUB-ESP-24-6714",
    description: "Nave logistica con descuento y baja competencia",
    score: "88.6",
    value: "930 k EUR",
    state: "Observar",
  },
  {
    type: "Retail",
    caseId: "SUB-ESP-24-4810",
    description: "Activo comercial con riesgo posesorio moderado",
    score: "72.4",
    value: "640 k EUR",
    state: "Revisar",
  },
];

const comparison = [
  "Del listado publico a un radar con criterio visual y operativo.",
  "Del expediente disperso a un dossier legible con IA, docs y raw juntos.",
  "De revisar cien casos iguales a entrar solo donde hay tesis.",
];

export default function LandingPage() {
  return (
    <main className="overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <p className="font-heading text-2xl leading-none tracking-[-0.05em]">
                Subasta
              </p>
              <p className="tech-label mt-1 text-[0.58rem] text-primary/80">
                Radar premium
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#metodo"
              className="tech-label text-[0.62rem] transition-colors hover:text-primary"
            >
              Metodo
            </a>
            <a
              href="#producto"
              className="tech-label text-[0.62rem] transition-colors hover:text-primary"
            >
              Producto
            </a>
            <a
              href="#ventaja"
              className="tech-label text-[0.62rem] transition-colors hover:text-primary"
            >
              Ventaja
            </a>
          </nav>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 border border-primary/20 bg-primary px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground transition-all hover:bg-[#e5be74]"
          >
            Acceder
          </Link>
        </div>
      </header>

      <section className="relative px-4 pb-10 pt-32 md:px-6 md:pb-16 md:pt-40">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative z-10">
            <span className="section-kicker">Mesa de control</span>
            <h1 className="mt-6 max-w-5xl text-5xl leading-[0.88] tracking-[-0.07em] text-foreground md:text-7xl lg:text-8xl">
              La inteligencia
              <br />
              juridica que decide
              <br />
              <span className="text-[#e5be74]">antes que la puja.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              Subasta convierte el BOE en una sala de evidencias para
              inversores: captura, puntua, documenta y prepara cada caso como un
              dossier de decision.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-3 bg-primary px-7 py-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground transition-all hover:bg-[#e5be74]"
              >
                Acceder al comando
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#producto"
                className="inline-flex items-center justify-center gap-3 border border-border bg-card px-7 py-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground transition-all hover:border-primary/30 hover:text-primary"
              >
                Ver producto
              </a>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {heroStats.map((item) => (
                <div key={item.label} className="war-panel-muted p-4">
                  <p className="tech-label">{item.label}</p>
                  <p className="mt-3 font-mono text-3xl font-semibold tracking-[-0.05em] text-primary">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(171,200,255,0.26),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(229,190,116,0.18),transparent_28%)] blur-3xl" />
            <div className="war-panel-strong relative overflow-hidden p-5 md:p-7">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div>
                  <p className="tech-label text-primary">Caso destacado</p>
                  <h2 className="mt-2 font-heading text-3xl leading-[0.95] tracking-[-0.05em] md:text-4xl">
                    Residential Complex
                    <br />
                    Mirador del Sol
                  </h2>
                </div>
                <div className="border-l-2 border-[#e5be74] pl-4 text-right">
                  <p className="tech-label text-[#e5be74]">Score IA</p>
                  <p className="score-ring mt-2 text-5xl font-light text-[#e5be74]">
                    94<span className="text-2xl text-primary">.2</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                <div className="war-panel-muted p-4">
                  <div className="flex items-center justify-between">
                    <span className="signal-chip text-[#e5be74]">
                      Alta conviccion
                    </span>
                    <span className="tech-label text-primary">SUB-ESP-24-9921</span>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="tech-label">Tasacion</p>
                      <p className="mt-2 font-mono text-xl text-primary">1,42 M</p>
                    </div>
                    <div>
                      <p className="tech-label">Puja minima</p>
                      <p className="mt-2 font-mono text-xl text-[#e5be74]">680 k</p>
                    </div>
                    <div>
                      <p className="tech-label">Docs</p>
                      <p className="mt-2 font-mono text-xl text-foreground">12</p>
                    </div>
                  </div>
                  <div className="editorial-divider my-5" />
                  <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                    Complejo residencial con arbitraje potencial, riesgo
                    posesorio moderado y mejora de precio frente a valor de
                    mercado estimado.
                  </p>
                </div>

                <div className="glass-panel p-4">
                  <p className="tech-label text-primary">Radar de senales</p>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Riesgo legal", "controlado"],
                      ["Liquidez local", "alta"],
                      ["Competencia", "baja"],
                      ["Cierre", "72h"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between border-b border-border/25 pb-3 text-sm last:border-b-0 last:pb-0"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono uppercase tracking-[0.18em] text-[#e5be74]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {dossierRows.map((row) => (
                  <div key={row.caseId} className="war-panel-muted p-4">
                    <p className="tech-label text-primary">{row.type}</p>
                    <p className="mt-3 font-heading text-2xl leading-[0.94] tracking-[-0.04em]">
                      {row.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono uppercase tracking-[0.16em]">
                        {row.caseId}
                      </span>
                      <span className="font-mono text-[#e5be74]">{row.score}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-sm text-foreground">
                        {row.value}
                      </span>
                      <span className="border-l-2 border-[#e5be74] pl-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#e5be74]">
                        {row.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="metodo" className="px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-7xl">
          <span className="section-kicker">El metodo archivista</span>
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="war-panel p-6 md:p-8">
              <h2 className="max-w-2xl text-4xl leading-[0.94] tracking-[-0.06em] md:text-6xl">
                Del expediente bruto a la lectura con criterio.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
                La interfaz no intenta ser amable ni vacia: esta construida para
                trabajar mejor, más rapido y con jerarquia real.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {workflow.map((item) => (
                <article key={item.step} className="war-panel-muted p-5">
                  <p className="font-mono text-sm font-semibold tracking-[0.2em] text-[#e5be74]">
                    {item.step}
                  </p>
                  <h3 className="mt-5 text-3xl leading-[0.96] tracking-[-0.05em]">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="producto" className="px-4 pb-14 md:px-6 md:pb-20">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="war-panel-strong p-6 md:p-8">
            <span className="section-kicker">Mas alla del BOE</span>
            <h2 className="mt-5 text-4xl leading-[0.94] tracking-[-0.06em] md:text-5xl">
              Una superficie operativa hecha para encontrar ventaja.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">
              Donde el BOE te deja navegando entre ruido, Subasta te mete en una
              sala de evidencias: shortlist, urgencia, documentos y criterio IA
              en una sola lectura.
            </p>
            <div className="editorial-divider my-8" />
            <div className="space-y-4">
              {comparison.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center border border-primary/15 bg-primary/10 text-primary">
                    <Binary className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-7 text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {advantages.map(({ icon: Icon, title, body }) => (
              <article key={title} className="war-panel-muted p-5 md:p-6">
                <div className="flex h-11 w-11 items-center justify-center border border-primary/15 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-3xl leading-[0.96] tracking-[-0.05em]">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ventaja" className="px-4 pb-16 md:px-6 md:pb-24">
        <div className="mx-auto max-w-7xl war-panel-strong p-6 md:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <span className="section-kicker">Dossier visual</span>
              <h2 className="mt-5 text-4xl leading-[0.94] tracking-[-0.06em] md:text-5xl">
                Un producto que se recuerda por criterio, no por plantilla.
              </h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground">
                Landing, dashboard y expediente comparten un mismo lenguaje:
                oscuro, editorial, tenso y tecnico. Todo apunta a una sensación
                de inteligencia operativa premium.
              </p>
            </div>

            <div className="war-panel p-4 md:p-5">
              <div className="grid grid-cols-[1.15fr_2fr_0.9fr_0.7fr_0.8fr] gap-3 border-b border-border/40 px-3 py-3">
                <span className="tech-label">Tipo</span>
                <span className="tech-label">Caso</span>
                <span className="tech-label">Valor</span>
                <span className="tech-label">Score</span>
                <span className="tech-label">Estado</span>
              </div>
              <div className="divide-y divide-border/25">
                {dossierRows.map((row) => (
                  <div
                    key={row.caseId}
                    className="grid grid-cols-[1.15fr_2fr_0.9fr_0.7fr_0.8fr] gap-3 px-3 py-4 text-sm"
                  >
                    <div>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-primary">
                        {row.type}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {row.caseId}
                      </p>
                    </div>
                    <p className="font-heading text-2xl leading-[0.96] tracking-[-0.04em]">
                      {row.description}
                    </p>
                    <span className="font-mono text-sm text-foreground">
                      {row.value}
                    </span>
                    <span className="font-mono text-lg text-[#e5be74]">
                      {row.score}
                    </span>
                    <span className="border-l-2 border-[#e5be74] pl-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#e5be74]">
                      {row.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 md:px-6">
        <div className="mx-auto max-w-7xl border border-[#e5be74]/25 bg-[#d7b46a] px-6 py-8 text-[#201608] md:px-10 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-[#4a3508]">
                Acceso directo
              </p>
              <h2 className="mt-4 max-w-3xl font-heading text-4xl leading-[0.94] tracking-[-0.06em] md:text-5xl">
                Entra al radar operativo y trabaja subastas como un caso, no
                como una tabla mas.
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-3 border border-[#4a3508]/20 bg-[#1a2027] px-7 py-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#ebeff4] transition-all hover:bg-[#071a33]"
            >
              Abrir dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

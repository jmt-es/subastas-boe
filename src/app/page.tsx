import Link from "next/link";
import {
  ArrowRight,
  Brain,
  FileSearch,
  Filter,
  Radar,
  ShieldCheck,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

const heroStats = [
  { label: "Activas", value: "217", hint: "Expedientes con cierre en curso" },
  { label: "Dossiers IA", value: "133", hint: "Lecturas persistidas y reutilizables" },
  { label: "Shortlist", value: "12", hint: "Casos marcados para seguimiento" },
];

const capabilities = [
  {
    icon: Filter,
    title: "Filtro con criterio",
    body: "Búsqueda, provincia, favoritos y recomendación conviven en una barra limpia y utilizable todos los días.",
  },
  {
    icon: Brain,
    title: "IA dentro del flujo",
    body: "El análisis no vive aparte. Se integra en la card y en el dossier para decidir sin saltos de contexto.",
  },
  {
    icon: FileSearch,
    title: "Dossier legible",
    body: "Datos, documentos, partes y raw se presentan con una jerarquía estable y sin bloques gigantes compitiendo entre sí.",
  },
];

const previewCases = [
  {
    id: "SUB-JA-2026-259129",
    title: "Vivienda en Guardamar",
    meta: "Valencia · Judicial",
    value: "195.100 €",
    score: "76/100",
  },
  {
    id: "SUB-JA-2026-257101",
    title: "Plaza de aparcamiento en Murcia",
    meta: "Murcia · Judicial",
    value: "13.390 €",
    score: "82/100",
  },
];

const productSteps = [
  "Abres el radar y filtras por provincia, descuento, favoritos o lectura IA.",
  "Lees cards densas y comparables, sin microtipografía ni paneles inflados.",
  "Entras al dossier con el mismo lenguaje visual y todo el contexto ya ordenado.",
];

const dossierBlocks = [
  "Resumen ejecutivo arriba, no enterrado.",
  "Importes, autoridad y ubicación visibles de un vistazo.",
  "Tabs limpias para datos, documentos, raw e IA.",
];

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
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/8 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-5 text-[1.18rem] font-semibold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-[0.98rem] leading-7 text-muted-foreground">{body}</p>
    </article>
  );
}

export default function LandingPage() {
  return (
    <main className="overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
                Subasta
              </p>
              <p className="tech-label mt-1">Radar judicial</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#producto"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Producto
            </a>
            <a
              href="#uso"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Uso
            </a>
          </nav>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="px-4 pb-12 pt-28 md:px-6 md:pb-14 md:pt-32">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="max-w-3xl">
            <span className="section-kicker">Aplicación</span>
            <h1 className="mt-5 max-w-3xl text-[2.35rem] font-semibold leading-[0.95] tracking-[-0.06em] text-foreground md:text-[3.15rem]">
              Radar y dossier para invertir en subastas con criterio y sin ruido.
            </h1>
            <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-muted-foreground">
              Subasta está pensada como una herramienta de trabajo real: encontrar expedientes,
              compararlos, guardarlos y abrir un dossier claro sin tener que pelearte con una
              interfaz improvisada.
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
                  <p className="mt-3 text-[1.7rem] font-semibold tracking-[-0.05em] text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="war-panel-strong overflow-hidden p-4 md:p-5">
            <div className="flex items-center justify-between gap-4 border-b border-border/80 pb-4">
              <div>
                <p className="tech-label text-primary">Vista del radar</p>
                <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-foreground">
                  Un panel sobrio, denso y fácil de recorrer.
                </h2>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Valencia
                </span>
                <span className="rounded-full border border-primary/12 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
                  IA activa
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-[1.1rem] border border-border bg-white/80 p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-3">
                  <div className="glass-panel flex items-center gap-3 px-4 py-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      Buscar expediente, dirección, localidad o ID
                    </p>
                    <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      Favoritos
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {previewCases.map((item) => (
                      <div key={item.id} className="war-panel-muted p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="tech-label">{item.id}</p>
                            <p className="mt-3 text-[1.12rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                              {item.title}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">{item.meta}</p>
                          </div>
                          <span className="rounded-full border border-primary/12 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
                            {item.score}
                          </span>
                        </div>
                        <div className="mt-4 border-t border-border/70 pt-3">
                          <p className="tech-label">Valor subasta</p>
                          <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="war-panel p-4">
                  <p className="tech-label text-primary">Dossier enlazado</p>
                  <p className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-foreground">
                    Plaza de aparcamiento en Murcia
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Lectura económica favorable, documentación suficiente y riesgo posesorio
                    contenido.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="glass-panel p-4">
                      <p className="tech-label">Score IA</p>
                      <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground">
                        82
                        <span className="ml-1 text-sm font-medium text-muted-foreground">/100</span>
                      </p>
                    </div>
                    <div className="glass-panel p-4">
                      <p className="tech-label">Recomendación</p>
                      <p className="mt-2 text-sm font-semibold text-[#25604b]">Comprar</p>
                    </div>
                    <div className="glass-panel p-4">
                      <p className="tech-label">Documentos</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">Edicto · Certificación · Decreto</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="producto" className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 max-w-3xl">
            <span className="section-kicker">Qué cambia</span>
            <h2 className="mt-4 text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.35rem]">
              La aplicación deja de parecer una maqueta y empieza a parecer una mesa de trabajo.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {capabilities.map((item) => (
              <CapabilityCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="uso" className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2 lg:items-start">
          <div className="war-panel p-6 md:p-7">
            <span className="section-kicker">Radar</span>
            <h2 className="mt-4 text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.2rem]">
              El flujo principal cabe en una sola superficie clara.
            </h2>
            <div className="mt-6 space-y-4">
              {productSteps.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/10 bg-primary/8 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p className="text-[0.98rem] leading-8 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="war-panel-strong p-6 md:p-7">
            <span className="section-kicker">Dossier</span>
            <h2 className="mt-4 text-[1.8rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.2rem]">
              El detalle guía la lectura en vez de competir por atención.
            </h2>

            <div className="mt-6 space-y-3">
              {dossierBlocks.map((item) => (
                <div key={item} className="glass-panel flex items-start gap-3 p-4">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-xl border border-primary/10 bg-primary/8 text-primary">
                    <Brain className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[0.97rem] leading-7 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8 md:px-6">
        <div className="mx-auto max-w-7xl rounded-[1.6rem] border border-border bg-card px-6 py-8 shadow-[0_18px_40px_rgba(22,32,50,0.06)] md:px-8 md:py-10">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <span className="section-kicker">Acceso directo</span>
              <h2 className="mt-4 max-w-3xl text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground md:text-[2.4rem]">
                Entra al radar y trabaja con una interfaz compacta, coherente y lista para uso real.
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

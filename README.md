# Subastas BOE — Analisis de Subastas Judiciales

Herramienta para scrapear, analizar y evaluar subastas judiciales del BOE con IA.

## Stack

- **Next.js 16** + React 19 + TypeScript + Tailwind CSS 4
- **MongoDB Atlas** — subastas, analisis, documentos PDF (gzip)
- **Google Gemini** — analisis IA de oportunidades (puntuacion 0-100)
- **Cheerio** — scraping del BOE
- **Vercel** — despliegue

## Setup

```bash
npm install
cp .env.example .env.local  # Configurar variables
npm run dev
```

### Variables de entorno (.env.local)

```
GEMINI_API_KEY=tu_api_key_de_google
MONGODB_URI=mongodb+srv://...
BOE_SESSID=cookie_sessid_del_boe
BOE_SIMPLESAML=cookie_simplesaml_del_boe
```

## Obtener cookies del BOE

Las cookies son necesarias para descargar documentos (PDFs) y acceder a datos extra.

1. Ve a [subastas.boe.es](https://subastas.boe.es) y haz login con **Cl@ve**
2. Abre DevTools (F12) -> **Application** -> **Cookies** -> `subastas.boe.es`
3. Copia los valores de:
   - `SESSID` -> `BOE_SESSID`
   - `SimpleSAML` -> `BOE_SIMPLESAML`
4. Las cookies caducan cada pocas horas. Cuando el LED de la app sale rojo, hay que renovarlas.

## Scripts de pipeline

### Scrapear todas las provincias + analizar

```bash
npx tsx scripts/scrape-all.ts
```

Scrapea inmuebles activos de Alicante, Murcia, Albacete y Valencia. Descarga PDFs, los comprime con gzip y los guarda en MongoDB. Analiza todo con Gemini (0-100).

Para cambiar provincias, edita el array `PROVINCES` en el script. Codigos: 03=Alicante, 30=Murcia, 02=Albacete, 46=Valencia, 28=Madrid, 08=Barcelona, etc.

### Solo analizar (sin re-scrapear)

```bash
npx tsx scripts/analyze-only.ts
```

Lee `data/results/subastas.json` y analiza con Gemini. Guarda progreso -- si se corta, continua.

### Utilidades

```bash
npx tsx scripts/check-mongo.ts   # Ver estado de MongoDB
npx tsx scripts/clean-mongo.ts   # Limpiar toda la DB
```

## Arquitectura

```
src/
  app/
    page.tsx              -- Dashboard principal
    subastas/[id]/        -- Detalle de subasta
    api/                  -- API routes (scrape, analyze, session, etc.)
  lib/
    scraper.ts            -- Scraper del BOE con Cheerio
    gemini.ts             -- Analisis con Gemini + gestion de PDFs
    mongodb.ts            -- Conexion a MongoDB Atlas
    storage.ts            -- Tipos TypeScript
scripts/                  -- Scripts de pipeline (tsx)
data/                     -- Datos locales (gitignored)
```

## Despliegue

Push a `main` -> Vercel auto-despliega.

```bash
git push origin main
```

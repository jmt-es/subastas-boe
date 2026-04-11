# Subastas BOE — Analisis de Subastas Judiciales

Herramienta para scrapear, analizar y evaluar subastas judiciales del BOE con IA.

## Stack

- **Next.js 16** + React 19 + TypeScript + Tailwind CSS 4
- **MongoDB Atlas** — subastas, analisis, documentos PDF (gzip)
- **Vercel Blob** — cache privada opcional para servir PDFs sin depender del BOE en caliente
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
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token_opcional
BOE_SESSID=cookie_sessid_del_boe
BOE_SIMPLESAML=cookie_simplesaml_del_boe
BOE_LOGIN_USER=correo_o_telefono_del_boe
BOE_LOGIN_PASSWORD=contrasena_del_boe
BOE_ADMIN_TOKEN=token_para_endpoints_privados_boe
CRON_SECRET=token_bearer_para_cron_de_vercel
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER_ID=me
BOE_GMAIL_QUERY=from:noresponder-subastas@boe.es newer_than:2d
```

## Obtener cookies del BOE

Las cookies son necesarias para descargar documentos (PDFs) y acceder a datos extra.

1. Ve a [subastas.boe.es](https://subastas.boe.es) y haz login con **Cl@ve**
2. Abre DevTools (F12) -> **Application** -> **Cookies** -> `subastas.boe.es`
3. Copia los valores de:
   - `SESSID` -> `BOE_SESSID`
   - `SimpleSAML` -> `BOE_SIMPLESAML`
4. Las cookies caducan cada pocas horas. Cuando el LED de la app sale rojo, hay que renovarlas.

## Automatizar el login BOE

La ruta manual por cookies sigue funcionando, pero no es la mejor base para automatizar.

Lo que hemos confirmado del portal:

- El alta inicial del usuario del Portal se hace con certificado o Cl@ve.
- El acceso normal con `correo/telefono + contrasena` tiene doble factor.
- Antes del OTP, BOE mete una pantalla intermedia con CAPTCHA.
- El reseteo de contrasena usa un codigo por email y otro distinto por SMS.
- El login normal del Portal envia el segundo factor tambien por correo, asi que se puede leer desde un buzon dedicado.

La estrategia recomendada para automatizar la ingesta es:

1. Mantener `BOE_LOGIN_USER` y `BOE_LOGIN_PASSWORD` en el backend.
2. Resolver el CAPTCHA intermedio del BOE con Gemini Vision.
3. Leer el OTP del BOE por Gmail API con permisos `readonly`.
4. Guardar la sesion BOE valida en MongoDB y reutilizarla mientras siga viva.
5. Solo cuando esa sesion falle, refrescarla con `usuario + contrasena + CAPTCHA + OTP`.
6. Dejar el flujo de `reset password` como recuperacion manual, porque ahi si intervienen email y SMS distintos.

Esto evita depender de cookies copiadas a mano y no necesita IMAP. En Vercel encaja mejor Gmail API por HTTPS que un cliente IMAP tradicional.

La app intenta resolver la sesion en este orden:

1. Cookies enviadas en la peticion actual.
2. Sesion en memoria del proceso.
3. Sesion persistida en MongoDB (`runtime_state/_id=boe-session`).
4. Login completo por BOE + OTP de Gmail solo si todo lo anterior ha caducado.

### Verificar lectura del OTP por Gmail API

```bash
npm run check:boe-otp
npm run check:boe-otp -- password_reset
```

El script busca los correos de `noresponder-subastas@boe.es` y extrae el ultimo codigo compatible con el tipo de flujo indicado.

### Endpoint privado de diagnostico

Hay un endpoint privado para verificar desde backend si Gmail y la sesion BOE estan listos:

```bash
curl -H "x-boe-admin-token: $BOE_ADMIN_TOKEN" \
  "http://localhost:3000/api/boe-auth?purpose=login&includeCode=1"
```

En desarrollo, si `BOE_ADMIN_TOKEN` no esta definido, el endpoint solo responde en `localhost`. En Vercel conviene definir siempre ese token y no exponerlo al frontend.

Tambien hay un `POST /api/boe-auth` privado para forzar un login completo por `usuario + contrasena + OTP de Gmail` y comprobar que devuelve una sesion nueva:

```bash
curl -X POST -H "x-boe-admin-token: $BOE_ADMIN_TOKEN" \
  "http://localhost:3000/api/boe-auth?includeSession=1"
```

La ruta manual `POST /api/session` sigue existiendo para desarrollo local, pero en produccion queda protegida por `BOE_ADMIN_TOKEN` para no permitir que cualquiera sobrescriba la sesion persistida.

## Cron nativo en Vercel

La parte automatica queda montada dentro de Vercel:

- `vercel.json` fija la ejecucion de funciones Node en `cdg1` para evitar que el refresco BOE salga desde `iad1`.
- Hay una ruta protegida por `CRON_SECRET` para refrescar subastas por provincia:
  - `GET /api/cron/refresh-subastas/03`
  - `GET /api/cron/refresh-subastas/30`
  - `GET /api/cron/refresh-subastas/02`
  - `GET /api/cron/refresh-subastas/46`
- Cada ejecucion guarda su ultimo estado en MongoDB (`runtime_state/_id=subastas-refresh:<provincia>`).

Si `CRON_SECRET` esta definido, Vercel enviara `Authorization: Bearer <CRON_SECRET>` a esas rutas. Para inspeccionar el ultimo estado de los jobs manualmente:

```bash
curl -H "x-boe-admin-token: $BOE_ADMIN_TOKEN" \
  "http://localhost:3000/api/cron/refresh-subastas"
```

## Scripts de pipeline

### Scrapear todas las provincias + analizar

```bash
npx tsx scripts/scrape-all.ts --force-reanalyze
```

Scrapea inmuebles activos de Alicante, Murcia, Albacete y Valencia. Precarga los PDFs en Vercel Blob si `BLOB_READ_WRITE_TOKEN` existe; si no, cae a cache local + gzip en MongoDB. Luego analiza todo con Gemini (0-100).

Para cambiar provincias, edita el array `PROVINCES` en el script. Codigos: 03=Alicante, 30=Murcia, 02=Albacete, 46=Valencia, 28=Madrid, 08=Barcelona, etc.

### Solo analizar (sin re-scrapear)

```bash
npx tsx scripts/analyze-only.ts
npx tsx scripts/analyze-only.ts --force
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

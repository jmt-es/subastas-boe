import * as cheerio from "cheerio";

const BASE_URL = "https://subastas.boe.es";
const SEARCH_URL = `${BASE_URL}/subastas_ava.php`;
const RESULTS_PER_PAGE = 40;
const REQUEST_DELAY = 800;

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export const TIPO_BIEN: Record<string, string> = {
  inmuebles: "I",
  vehiculos: "V",
  muebles: "M",
  todos: "",
};

export const ESTADOS: Record<string, string> = {
  celebrandose: "EJ",
  proxima: "PU",
  finalizada: "FI",
  suspendida: "SU",
  todos: "",
};

export const PROVINCIAS: Record<string, string> = {
  "": "Todas",
  "01": "Álava",
  "02": "Albacete",
  "03": "Alicante",
  "04": "Almería",
  "05": "Ávila",
  "06": "Badajoz",
  "07": "Baleares",
  "08": "Barcelona",
  "09": "Burgos",
  "10": "Cáceres",
  "11": "Cádiz",
  "12": "Castellón",
  "13": "Ciudad Real",
  "14": "Córdoba",
  "15": "A Coruña",
  "16": "Cuenca",
  "17": "Girona",
  "18": "Granada",
  "19": "Guadalajara",
  "20": "Guipúzcoa",
  "21": "Huelva",
  "22": "Huesca",
  "23": "Jaén",
  "24": "León",
  "25": "Lleida",
  "26": "La Rioja",
  "27": "Lugo",
  "28": "Madrid",
  "29": "Málaga",
  "30": "Murcia",
  "31": "Navarra",
  "32": "Ourense",
  "33": "Asturias",
  "34": "Palencia",
  "35": "Las Palmas",
  "36": "Pontevedra",
  "37": "Salamanca",
  "38": "S.C. Tenerife",
  "39": "Cantabria",
  "40": "Segovia",
  "41": "Sevilla",
  "42": "Soria",
  "43": "Tarragona",
  "44": "Teruel",
  "45": "Toledo",
  "46": "Valencia",
  "47": "Valladolid",
  "48": "Vizcaya",
  "49": "Zamora",
  "50": "Zaragoza",
  "51": "Ceuta",
  "52": "Melilla",
};

export interface Acreedor {
  nombre?: string;
  nif?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  pais?: string;
}

export interface Documento {
  titulo: string;
  url: string;
}

export interface Subasta {
  id: string;
  url: string;
  identificador?: string;
  estado?: string;
  tipoSubasta?: string;
  fechaInicio?: string;
  fechaConclusion?: string;
  valorSubasta?: string;
  tasacion?: string;
  pujaMinima?: string;
  tramosEntrePujas?: string;
  importeDeposito?: string;
  cantidadReclamada?: string;
  pujActual?: string;
  lotes?: string;
  // Bien
  descripcion?: string;
  tipoBienDetalle?: string;
  direccion?: string;
  codigoPostal?: string;
  localidad?: string;
  provincia?: string;
  situacionPosesoria?: string;
  visitable?: string;
  referenciaCatastral?: string;
  viviendaHabitual?: string;
  cargas?: string;
  // General
  anuncioBOE?: string;
  cuentaExpediente?: string;
  // Autoridad gestora
  autoridad?: string;
  autoridadCodigo?: string;
  autoridadDireccion?: string;
  autoridadTelefono?: string;
  autoridadFax?: string;
  autoridadEmail?: string;
  // Relacionados (acreedor)
  acreedor?: Acreedor;
  // Documentos
  documentos?: Documento[];
  rawData: Record<string, string>;
  scrapedAt: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function limpiarTexto(texto: string): string {
  return texto.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function parsearFecha(texto: string): string {
  const match1 = texto.match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/);
  if (match1) return match1[1];
  const match2 = texto.match(/(\d{4}-\d{2}-\d{2}T[\d:]+)/);
  if (match2) return match2[1];
  return texto.includes("CET") ? texto.split("CET")[0].trim() : texto.trim();
}

// Cookie jar simulation
let cookies: string[] = [];

async function fetchWithCookies(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...HEADERS,
    ...(options.headers as Record<string, string>),
  };
  if (cookies.length > 0) {
    headers["Cookie"] = cookies.join("; ");
  }

  const resp = await fetch(url, {
    ...options,
    headers,
    redirect: "follow",
  });

  const setCookies = resp.headers.getSetCookie?.() || [];
  for (const c of setCookies) {
    const name = c.split("=")[0];
    cookies = cookies.filter((existing) => !existing.startsWith(name + "="));
    cookies.push(c.split(";")[0]);
  }

  return resp;
}

function extraerTabla(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const datos: Record<string, string> = {};

  $("tr").each((_, tr) => {
    const ths = $(tr).find("th");
    const tds = $(tr).find("td");

    if (ths.length === 1 && tds.length >= 1) {
      const clave = limpiarTexto($(ths[0]).text());
      const valor = limpiarTexto($(tds[0]).text());
      if (clave) datos[clave] = valor;
    } else if (ths.length > 1) {
      ths.each((i, th) => {
        const td = tds[i];
        if (td) {
          const clave = limpiarTexto($(th).text());
          const valor = limpiarTexto($(td).text());
          if (clave) datos[clave] = valor;
        }
      });
    }
  });

  return datos;
}

function extraerLinksSubastas(html: string): Array<{ id: string; url: string }> {
  const $ = cheerio.load(html);
  const subastas: Array<{ id: string; url: string }> = [];

  $("a[href]").each((_, el) => {
    const title = $(el).attr("title") || "";
    const clases = ($(el).attr("class") || "").split(/\s+/);

    if (
      title.startsWith("Subasta") &&
      clases.includes("resultado-busqueda-link-defecto")
    ) {
      const subastaId = title.replace("Subasta ", "").trim();
      let href = $(el).attr("href") || "";
      if (href.startsWith("./")) href = href.slice(2);
      if (!href.startsWith("http")) href = `${BASE_URL}/${href}`;
      subastas.push({ id: subastaId, url: href });
    }
  });

  return subastas;
}

function extraerLinkSiguiente(html: string): string | null {
  const $ = cheerio.load(html);
  let siguiente: string | null = null;

  $("a[href]").each((_, el) => {
    const texto = $(el).text().trim();
    if (texto.toLowerCase().includes("siguiente")) {
      let href = $(el).attr("href") || "";
      if (href.startsWith("./")) href = href.slice(2);
      if (!href.startsWith("http")) href = `${BASE_URL}/${href}`;
      siguiente = href;
      return false;
    }
  });

  return siguiente;
}

function extraerTotalResultados(html: string): number | null {
  const texto = cheerio.load(html).text();
  const match = texto.match(/(\d+)\s*resultado/);
  return match ? parseInt(match[1].replace(".", "")) : null;
}

function mapearCampos(raw: Record<string, string>): Partial<Subasta> {
  const result: Partial<Subasta> = {
    identificador: raw["Identificador"],
    estado: raw["Estado"],
    tipoSubasta: raw["Tipo de subasta"],
    fechaInicio: raw["Fecha de inicio"] ? parsearFecha(raw["Fecha de inicio"]) : undefined,
    fechaConclusion: raw["Fecha de conclusión"] ? parsearFecha(raw["Fecha de conclusión"]) : undefined,
    valorSubasta: raw["Valor subasta"],
    tasacion: raw["Tasación"],
    pujaMinima: raw["Puja mínima"],
    tramosEntrePujas: raw["Tramos entre pujas"],
    importeDeposito: raw["Importe del depósito"],
    cantidadReclamada: raw["Cantidad reclamada"],
    pujActual: raw["Precio puja actual"],
    lotes: raw["Lotes"],
    // Bien
    descripcion: raw["Descripción"],
    tipoBienDetalle: raw["_tipoBienDetalle"],
    direccion: raw["Dirección"],
    codigoPostal: raw["Código Postal"],
    localidad: raw["Localidad"],
    provincia: raw["Provincia"],
    situacionPosesoria: raw["Situación posesoria"],
    visitable: raw["Visitable"],
    referenciaCatastral: raw["Referencia catastral"],
    viviendaHabitual: raw["Vivienda habitual"],
    cargas: raw["Cargas"],
    // General
    anuncioBOE: raw["Anuncio BOE"],
    cuentaExpediente: raw["Cuenta expediente"],
    // Autoridad gestora
    autoridad: raw["_autoridadDescripcion"] || raw["Descripción"],
    autoridadCodigo: raw["_autoridadCodigo"],
    autoridadDireccion: raw["_autoridadDireccion"],
    autoridadTelefono: raw["_autoridadTelefono"],
    autoridadFax: raw["_autoridadFax"],
    autoridadEmail: raw["_autoridadEmail"],
  };

  // Acreedor (Relacionados tab)
  if (raw["_acreedorNombre"]) {
    result.acreedor = {
      nombre: raw["_acreedorNombre"],
      nif: raw["_acreedorNIF"],
      direccion: raw["_acreedorDireccion"],
      localidad: raw["_acreedorLocalidad"],
      provincia: raw["_acreedorProvincia"],
      pais: raw["_acreedorPais"],
    };
  }

  return result;
}

function extraerDocumentos(html: string): Documento[] {
  const $ = cheerio.load(html);
  const docs: Documento[] = [];

  // Look for document links in the "Información complementaria" section
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const texto = limpiarTexto($(el).text());
    // Document links typically point to verDocumento.php or contain "documento"
    if (
      (href.includes("verDocumento") || href.includes("documento")) &&
      texto &&
      texto !== "*"
    ) {
      let fullUrl = href;
      if (!fullUrl.startsWith("http")) {
        fullUrl = `${BASE_URL}/${fullUrl.replace(/^\.\//, "")}`;
      }
      docs.push({ titulo: texto, url: fullUrl });
    }
  });

  return docs;
}

function extraerTipoBien(html: string): string | undefined {
  const $ = cheerio.load(html);
  // The bien type is in a heading like "Bien 1 - Inmueble (Vivienda)"
  let tipoBien: string | undefined;
  $("h4, h3, h2").each((_, el) => {
    const text = $(el).text();
    const match = text.match(/Bien\s+\d+\s*-\s*(.+)/);
    if (match) {
      tipoBien = match[1].trim();
      return false;
    }
  });
  return tipoBien;
}

async function obtenerDetalleSubasta(
  urlSubasta: string,
  delayMs: number = 800
): Promise<{ datos: Record<string, string>; documentos: Documento[] }> {
  const datos: Record<string, string> = { url: urlSubasta };
  let documentos: Documento[] = [];

  let urlBase = urlSubasta;
  let urlSufijo = "";
  if (urlSubasta.includes("&idBus")) {
    const parts = urlSubasta.split("&idBus");
    urlBase = parts[0];
    urlSufijo = "&idBus" + parts[1];
  }
  urlBase = urlBase.replace(/&ver=\d+/, "");

  const vistas: Array<[number, string]> = [
    [1, "general"],
    [2, "autoridad"],
    [3, "bienes"],
    [4, "relacionados"],
    [5, "pujas"],
  ];

  let numLotes = 0;

  for (const [numVista] of vistas) {
    const urlVista = `${urlBase}&ver=${numVista}${urlSufijo}`;

    try {
      const resp = await fetchWithCookies(urlVista);
      if (!resp.ok) continue;
      const html = await resp.text();
      const tabla = extraerTabla(html);

      if (numVista === 1) {
        // General info + extract documents
        const lotesStr = tabla["Lotes"] || "Sin lotes";
        if (lotesStr === "Sin lotes" || lotesStr === "0") {
          numLotes = 0;
        } else {
          const m = lotesStr.match(/\d+/);
          numLotes = m ? parseInt(m[0]) : 0;
        }
        Object.assign(datos, tabla);
        documentos = extraerDocumentos(html);
      } else if (numVista === 2) {
        // Autoridad gestora - prefix keys to avoid collision with bien data
        datos["_autoridadCodigo"] = tabla["Código"] || "";
        datos["_autoridadDescripcion"] = tabla["Descripción"] || "";
        datos["_autoridadDireccion"] = tabla["Dirección"] || "";
        datos["_autoridadTelefono"] = tabla["Teléfono"] || "";
        datos["_autoridadFax"] = tabla["Fax"] || "";
        datos["_autoridadEmail"] = tabla["Correo electrónico"] || "";
      } else if (numVista === 3) {
        // Bienes
        const tipoBien = extraerTipoBien(html);
        if (tipoBien) datos["_tipoBienDetalle"] = tipoBien;

        if (numLotes > 1) {
          for (let n = 1; n <= numLotes; n++) {
            const urlLote = `${urlVista}&idLote=${n}&numPagBus=`;
            try {
              const rLote = await fetchWithCookies(urlLote);
              const htmlLote = await rLote.text();
              const tablaLote = extraerTabla(htmlLote);
              const tipoLote = extraerTipoBien(htmlLote);
              if (tipoLote) datos[`Lote${n}_Tipo`] = tipoLote;
              for (const [k, v] of Object.entries(tablaLote)) {
                datos[`Lote${n}_${k}`] = v;
              }
              await delay(delayMs * 0.5);
            } catch {
              continue;
            }
          }
        } else {
          Object.assign(datos, tabla);
        }
      } else if (numVista === 4) {
        // Relacionados (acreedor)
        datos["_acreedorNombre"] = tabla["Nombre"] || "";
        datos["_acreedorNIF"] = tabla["NIF"] || "";
        datos["_acreedorDireccion"] = tabla["Dirección"] || "";
        datos["_acreedorLocalidad"] = tabla["Localidad"] || "";
        datos["_acreedorProvincia"] = tabla["Provincia"] || "";
        datos["_acreedorPais"] = tabla["País"] || "";
      } else if (numVista === 5) {
        // Pujas
        const $ = cheerio.load(html);
        const bloque = $("#idBloqueDatos8");
        if (bloque.length) {
          const strong = bloque.find("strong.destaca");
          if (strong.length) {
            datos["Precio puja actual"] = limpiarTexto(strong.text());
          }
        }
        Object.assign(datos, tabla);
      }

      await delay(delayMs * 0.5);
    } catch {
      continue;
    }
  }

  return { datos, documentos };
}

export interface ScrapeOptions {
  tipoBien?: string;
  estado?: string;
  provincia?: string;
  maxPaginas?: number;
  delayMs?: number;
}

export interface ScrapeProgress {
  pagina: number;
  total: number | null;
  subastasEnPagina: number;
  procesadas: number;
  subastaActual: string;
}

export async function scrapeSubastas(
  options: ScrapeOptions = {},
  onProgress?: (progress: ScrapeProgress) => void
): Promise<Subasta[]> {
  const {
    tipoBien = "I",
    estado = "EJ",
    provincia = "",
    maxPaginas = 2,
    delayMs = REQUEST_DELAY,
  } = options;

  cookies = [];
  const todasSubastas: Subasta[] = [];
  let pagina = 0;

  // Init cookies
  await fetchWithCookies(`${BASE_URL}/index.php`);

  // First request: POST search form
  const formData = new URLSearchParams({
    "campo[2]": "SUBASTA.ESTADO.CODIGO",
    "dato[2]": estado,
    "campo[3]": "BIEN.TIPO",
    "dato[3]": tipoBien,
    "campo[8]": "BIEN.COD_PROVINCIA",
    "dato[8]": provincia,
    "campo[18]": "SUBASTA.FECHA_INICIO",
    "dato[18][0]": "",
    "dato[18][1]": "",
    page_hits: String(RESULTS_PER_PAGE),
    "sort_field[0]": "SUBASTA.FECHA_FIN",
    "sort_order[0]": "desc",
    accion: "Buscar",
  });

  let resp = await fetchWithCookies(SEARCH_URL, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!resp.ok) {
    throw new Error(`Error en búsqueda: ${resp.status}`);
  }

  let html = await resp.text();

  while (true) {
    const total = extraerTotalResultados(html);
    const links = extraerLinksSubastas(html);

    if (links.length === 0) break;

    onProgress?.({
      pagina: pagina + 1,
      total,
      subastasEnPagina: links.length,
      procesadas: todasSubastas.length,
      subastaActual: "",
    });

    for (let i = 0; i < links.length; i++) {
      const info = links[i];
      onProgress?.({
        pagina: pagina + 1,
        total,
        subastasEnPagina: links.length,
        procesadas: todasSubastas.length,
        subastaActual: info.id,
      });

      try {
        const { datos: rawData, documentos } = await obtenerDetalleSubasta(info.url, delayMs);
        const campos = mapearCampos(rawData);
        todasSubastas.push({
          id: info.id,
          url: info.url,
          ...campos,
          documentos: documentos.length > 0 ? documentos : undefined,
          rawData,
          scrapedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`Error scraping ${info.id}:`, e);
      }

      await delay(delayMs);
    }

    pagina++;
    if (maxPaginas > 0 && pagina >= maxPaginas) break;

    const urlSiguiente = extraerLinkSiguiente(html);
    if (!urlSiguiente) break;

    await delay(delayMs);
    resp = await fetchWithCookies(urlSiguiente);
    if (!resp.ok) break;
    html = await resp.text();
  }

  return todasSubastas;
}

import { GoogleGenAI } from "@google/genai";
import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";
import { getUsableBoeSession } from "./boe-session-runtime";
import { getStoredPdfBuffer } from "./document-storage";

const MAX_ATTACHED_DOCS = 6;
const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_SINGLE_ATTACHMENT_BYTES = 12 * 1024 * 1024;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenAI({ apiKey });
}

function buildDataSections(subasta: Subasta): string {
  const field = (label: string, value?: string | null) =>
    value && value !== "No disponible" && value !== "no consta"
      ? `- ${label}: ${value}`
      : null;

  const sections: string[] = [];

  sections.push("## DATOS GENERALES DE LA SUBASTA");
  sections.push(
    [
      field("Identificador", subasta.identificador || subasta.id),
      field("Estado", subasta.estado),
      field("Tipo de subasta", subasta.tipoSubasta),
      field("Anuncio BOE", subasta.anuncioBOE),
      field("Cuenta expediente", subasta.cuentaExpediente),
      field("Fecha inicio", subasta.fechaInicio),
      field("Fecha conclusión", subasta.fechaConclusion),
      field("Lotes", subasta.lotes),
    ]
      .filter(Boolean)
      .join("\n")
  );

  sections.push("\n## DATOS ECONÓMICOS");
  sections.push(
    [
      field("Valor subasta", subasta.valorSubasta),
      field("Tasación", subasta.tasacion),
      field("Puja mínima", subasta.pujaMinima),
      field("Puja actual", subasta.pujActual),
      field("Tramos entre pujas", subasta.tramosEntrePujas),
      field("Importe depósito", subasta.importeDeposito),
      field("Cantidad reclamada", subasta.cantidadReclamada),
    ]
      .filter(Boolean)
      .join("\n")
  );

  sections.push("\n## DESCRIPCIÓN DEL BIEN");
  sections.push(
    [
      field("Tipo de bien", subasta.tipoBienDetalle),
      field("Descripción completa", subasta.descripcion),
      field("Dirección", subasta.direccion),
      field("Código postal", subasta.codigoPostal),
      field("Localidad", subasta.localidad),
      field("Provincia", subasta.provincia),
      field("Vivienda habitual", subasta.viviendaHabitual),
      field("Situación posesoria", subasta.situacionPosesoria),
      field("Visitable", subasta.visitable),
      field("Referencia catastral", subasta.referenciaCatastral),
      field("Inscripción registral", subasta.inscripcionRegistral),
      field("CSV Certificación registral", subasta.csvCertificacion),
      field(
        "Información registral electrónica",
        subasta.infoRegistralElectronica
      ),
      field("Información adicional", subasta.infoAdicional),
      field("Cargas", subasta.cargas),
    ]
      .filter(Boolean)
      .join("\n")
  );

  sections.push("\n## AUTORIDAD GESTORA");
  sections.push(
    [
      field("Descripción", subasta.autoridad),
      field("Código", subasta.autoridadCodigo),
      field("Dirección", subasta.autoridadDireccion),
      field("Teléfono", subasta.autoridadTelefono),
      field("Email", subasta.autoridadEmail),
      field("Fax", subasta.autoridadFax),
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (subasta.acreedor) {
    sections.push("\n## ACREEDOR");
    sections.push(
      [
        field("Nombre", subasta.acreedor.nombre),
        field("NIF", subasta.acreedor.nif),
        field("Dirección", subasta.acreedor.direccion),
        field("Localidad", subasta.acreedor.localidad),
        field("Provincia", subasta.acreedor.provincia),
        field("País", subasta.acreedor.pais),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (subasta.documentos && subasta.documentos.length > 0) {
    sections.push("\n## DOCUMENTOS DISPONIBLES");
    sections.push(
      subasta.documentos.map((d) => `- ${d.titulo} (${d.url})`).join("\n")
    );
  }

  if (subasta.rawData) {
    const mappedKeys = new Set([
      "url",
      "Identificador",
      "Estado",
      "Tipo de subasta",
      "Fecha de inicio",
      "Fecha de conclusión",
      "Valor subasta",
      "Tasación",
      "Puja mínima",
      "Tramos entre pujas",
      "Importe del depósito",
      "Cantidad reclamada",
      "Precio puja actual",
      "Lotes",
      "Descripción",
      "Dirección",
      "Código Postal",
      "Localidad",
      "Provincia",
      "Situación posesoria",
      "Visitable",
      "Referencia catastral",
      "Vivienda habitual",
      "Cargas",
      "Anuncio BOE",
      "Cuenta expediente",
    ]);
    const extra = Object.entries(subasta.rawData).filter(
      ([k]) => !mappedKeys.has(k) && !k.startsWith("_")
    );
    if (extra.length > 0) {
      sections.push("\n## DATOS ADICIONALES (RAW)");
      sections.push(extra.map(([k, v]) => `- ${k}: ${v}`).join("\n"));
    }
  }

  return sections.join("\n");
}

function buildPrompt(subasta: Subasta): string {
  const data = buildDataSections(subasta);

  const numDocs = subasta.documentos?.length || 0;
  const hasCertCargas = subasta.documentos?.some(
    (d) =>
      d.titulo.toLowerCase().includes("carga") ||
      d.titulo.toLowerCase().includes("certificac")
  );
  const hasEdicto = subasta.documentos?.some((d) =>
    d.titulo.toLowerCase().includes("edicto")
  );

  return `Eres un analista de inversiones inmobiliarias especializado en subastas judiciales españolas. Tu trabajo es hacer un análisis CONSERVADOR y RIGUROSO. El inversor que lee esto arriesga su dinero real, así que más vale que le digas que una subasta no merece la pena y que se la pierda, a que le recomiendes algo que le haga perder dinero.

Tu método de análisis SIEMPRE sigue este orden:
1. Estimar el valor de mercado REALISTA del inmueble (ajustando por planta, ascensor, antigüedad, estado probable)
2. Calcular TODOS los costes desde la puja hasta tener el piso listo para vender o alquilar
3. Trabajar hacia atrás: a partir del valor de mercado, restar costes, restar un margen mínimo de seguridad del 15-20%, y así obtener la puja máxima real
4. Solo ENTONCES decidir si merece la pena

Devuelve un JSON con EXACTAMENTE esta estructura (sin markdown, solo JSON puro):

{
  "oportunidad": <número del 0 al 100 — ver escala abajo>,
  "recomendacion": "<comprar|observar|descartar>",
  "resumen": "<resumen de 3-4 frases claro y directo. Incluye la conclusión económica: 'Para que sea rentable, la puja no debería superar X€'>",

  "economico": {
    "valorMercadoEstimado": "<rango conservador basado en €/m2 de la zona, ajustado por: planta (sin ascensor penaliza), antigüedad, estado probable. Ej: '100.000€ - 115.000€'>",
    "factoresAjuste": "<qué factores has aplicado al precio/m2 base: ascensor, planta alta, antigüedad, orientación, estado desconocido>",
    "depositoNecesario": "<importe exacto del depósito>",
    "costesPostAdjudicacion": {
      "itp": "<ITP según CCAA — 10% en Valencia, 6% en Madrid, etc.>",
      "notariaRegistro": "<1.500€ - 2.500€ según precio>",
      "cargasSubsistentes": "<importe de hipotecas o cargas anteriores que subsisten, o '0€ - sin cargas previas'>",
      "deudaComunitariaPendiente": "<estimación de cuotas de comunidad impagadas más allá de lo reclamado>",
      "ibiSuministros": "<estimación de IBI y suministros pendientes — típicamente 1.000€-3.000€>",
      "reformaEstimada": "<si estado desconocido: 10.000€-25.000€ para reforma media de vivienda. Si hay datos, ajustar>",
      "costesDesahucio": "<si ocupación desconocida o confirmada: 3.000€-6.000€ en abogado+procurador + 6-12 meses de coste de oportunidad. Si vacía: 0€>",
      "total": "<suma de todo lo anterior como rango, SIN incluir la puja>"
    },
    "pujaMaximaRentable": "<ESTE ES EL DATO MÁS IMPORTANTE. Calcula: valorMercado - costesPostAdjudicacion - margenSeguridad(15%). Muestra la operación completa>",
    "rentabilidadEstimada": "<calcular para DOS escenarios: (a) reventa tras reforma, (b) alquiler. Usar números concretos, no porcentajes vagos>",
    "items": [
      "Valor subasta (referencia): X€",
      "Tasación oficial: X€ (si 0€ = no declarada)",
      "Puja mínima: X€ o 'sin mínimo'",
      "Depósito: X€ (5% del valor subasta, reembolsable si no ganas)",
      "ITP: X€",
      "Notaría + registro: X€",
      "Cargas subsistentes: X€",
      "Reforma estimada: X€",
      "Costes legales (desahucio si aplica): X€",
      "Deudas pendientes (comunidad, IBI): X€",
      "COSTE TOTAL (puja recomendada + gastos): X€ - Y€",
      "Valor mercado estimado: X€ - Y€",
      "MARGEN NETO ESTIMADO: X€ - Y€"
    ]
  },

  "cargas": [
    "Clasificar cada carga como ANTERIOR (subsiste, el comprador se subroga) o POSTERIOR (se extingue con la subasta)",
    "Importe concreto de cada carga subsistente",
    "Si hay hipoteca anterior: importe pendiente estimado y entidad. Esto es CRÍTICO — una hipoteca previa puede comerse todo el margen",
    "Total cargas subsistentes que asume el comprador: X€",
    "Si NO hay cargas anteriores, decirlo explícitamente — es un punto muy positivo"
  ],

  "situacionJuridica": [
    "Tipo de procedimiento y qué implica para el comprador",
    "Quién es el acreedor y qué tipo de entidad es",
    "Si es vivienda habitual: implicaciones legales concretas para el desahucio (arts. 704 LEC)",
    "Estado procesal y posibles incidentes"
  ],

  "posesion": [
    "Estado de ocupación: ocupada (por quién), vacía, o desconocida",
    "Si desconocida: asumir PEOR CASO en los costes (ocupada) y explicar qué debería hacer el inversor ANTES de pujar (visitar la finca, preguntar a vecinos, consultar administrador)",
    "Coste estimado del desahucio si es necesario: honorarios abogado, procurador, plazo",
    "Plazo realista hasta tomar posesión: X-Y meses"
  ],

  "ubicacion": [
    "Precio medio €/m2 en la zona para este tipo de inmueble (citar fuente si posible: Idealista, Tinsa, INE)",
    "Ajustes al precio/m2 por planta, ascensor, antigüedad",
    "Demanda de alquiler en la zona y renta mensual estimada para este tipo de piso",
    "Perfil de la zona: en auge, estable, o en declive"
  ],

  "riesgos": [
    "Cada riesgo REAL con formato: 'RIESGO: descripción — COSTE ESTIMADO: X€ — PROBABILIDAD: alta/media/baja'",
    "Solo riesgos que tengan base en los datos concretos de esta subasta",
    "Cuantificar cada riesgo en euros siempre que sea posible"
  ],

  "oportunidades": [
    "Puntos fuertes concretos de esta subasta, cuantificados cuando sea posible",
    "Comparación con alternativas de mercado (ej: 'un piso similar en la zona cuesta X€, aquí podrías conseguirlo por Y€')"
  ],

  "estrategiaPuja": [
    "PUJA MÁXIMA ABSOLUTA: X€ — por encima de esto, el deal deja de ser rentable (mostrar el cálculo)",
    "RANGO ÓPTIMO: X€ - Y€ — zona donde el margen es atractivo (>20% sobre coste total)",
    "PUJA IDEAL: X€ — la que maximiza rentabilidad con probabilidad razonable de ganar",
    "Momento de pujar: esperar a las últimas horas para evaluar competencia",
    "Si la puja actual ya supera el máximo rentable: DESCARTAR sin dudar"
  ],

  "glosario": [
    { "termino": "Certificación de cargas", "explicacion": "Documento del registro de la propiedad que lista TODAS las cargas que pesan sobre el inmueble." },
    { "termino": "ITP", "explicacion": "Impuesto de Transmisiones Patrimoniales. En subastas de segunda mano varía por CCAA (6-10%)." },
    { "termino": "<otro término relevante>", "explicacion": "<explicación clara>" }
  ]
}

ESCALA DE OPORTUNIDAD — La puntuación mide la CALIDAD RELATIVA de esta subasta frente a otras. Piensa en percentiles: si vieras 100 subastas, ¿en qué posición estaría esta? Usa números variados y concretos (47, 63, 71...), no redondees a múltiplos de 5 o 10.

Punto de partida según tipo de bien:
- Vivienda urbana con documentación básica (edicto): empieza en 50
- Vivienda urbana con cert. cargas + edicto: empieza en 55
- Local/garaje/trastero: empieza en 40
- Solar/rústica: empieza en 35

IMPORTANTE sobre información "desconocida": En subastas judiciales, lo NORMAL es que la posesión no conste y el estado no se conozca. NO penalices por esto como si fuera algo raro o negativo. Solo resta puntos si hay indicios CONCRETOS de problema (ej: consta que es vivienda habitual, o que hay inquilino con contrato).

Factores que SUMAN puntos (aplica los que procedan):
+12-18: Sin hipoteca previa confirmado en cert. cargas (esto es raro y muy valioso)
+8-12: Margen calculado >20% entre valor mercado y coste total estimado
+5-8: Zona urbana con demanda activa de alquiler/compra
+3-5: Sin puja mínima
+3-5: Vivienda visitable o posesión vacía confirmada
+2-4: Deuda reclamada muy baja vs valor del inmueble (señal de oportunidad por deuda comunitaria)

Factores que RESTAN puntos:
-15-25: Hipoteca previa subsistente con saldo alto (deal-breaker potencial)
-8-12: Posesión CONFIRMADA ocupada por tercero con título
-5-10: Sin NINGÚN documento disponible
-5-8: Zona rural o pueblo <10k hab con mercado ilíquido
-3-5: Cargas subsistentes significativas (>20% del valor)

Ejemplo concreto: Vivienda con edicto+cert.cargas (55 base) + sin hipoteca (+15) + zona urbana buena (+6) + posesión no consta (0, es lo normal) + estado desconocido (0, es lo normal) = 76. Eso sería "comprar".

Otro ejemplo: Vivienda solo con edicto (50 base) + hipoteca previa de 80k (-20) + pueblo pequeño (-7) = 23. Eso es "descartar".

Recomendación: "comprar" si >= 62, "observar" si 38-61, "descartar" si < 38.

REGLAS:
- Haz SIEMPRE el cálculo inverso: valorMercado - costes - margen = pujaMaxima.
- TODOS los arrays deben tener AL MENOS 3 items específicos para ESTA subasta.
- Tasación "0,00€" = no declarada, NO vale 0.
- Si la situación posesoria es desconocida, INCLUYE costes de desahucio en el escenario conservador.
- Si el estado de conservación es desconocido, INCLUYE reforma en los costes (15.000€-25.000€ para vivienda media).
- ${numDocs > 0 ? `Hay ${numDocs} documento(s) descargables. Tenerlos es POSITIVO — reduce incertidumbre.` : "No hay documentos disponibles — esto AUMENTA el riesgo."} ${hasCertCargas ? "TIENE CERTIFICADO DE CARGAS — puedes verificar cargas reales, no suponer." : ""} ${hasEdicto ? "TIENE EDICTO — puedes extraer datos procesales concretos." : ""}
- Sé realista con el valor de mercado: ni optimista ni pesimista. Usa precios/m2 de la zona y ajusta por factores concretos.
- En "glosario" incluye 4-8 términos que aparezcan en esta subasta.

${data}

IMPORTANTE: Responde SOLO con el JSON, sin bloques de código ni texto adicional.`;
}

// Gemini 3.1 Flash-Lite pricing (USD per 1M tokens)
const MODEL_NAME = "gemini-3.1-flash-lite-preview";
const PRICE_INPUT_PER_M = 0.25; // $0.25 / 1M input tokens
const PRICE_OUTPUT_PER_M = 1.5; // $1.50 / 1M output tokens

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M
  );
}

function getDocumentPriority(title: string): number {
  const normalized = title.toLowerCase();

  if (
    normalized.includes("nota simple") ||
    normalized.includes("certificacion de cargas") ||
    normalized.includes("certificación de cargas") ||
    normalized.includes("certificado de cargas") ||
    normalized.includes("certificado dominio y cargas") ||
    normalized.includes("certificación de dominio y cargas")
  ) {
    return 100;
  }

  if (normalized.includes("edicto")) return 90;
  if (normalized.includes("tasacion") || normalized.includes("tasación")) return 80;
  if (normalized.includes("catastral") || normalized.includes("catastr")) return 70;
  if (normalized.includes("ibi") || normalized.includes("deuda")) return 60;
  if (normalized.includes("condiciones")) return 50;
  return 40;
}

function isInvalidModelInputError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("INVALID_ARGUMENT") ||
    message.includes("maximum number of tokens allowed")
  );
}

async function loadPrioritizedPdfParts(
  subasta: Subasta,
  sessionId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const documents = subasta.documentos || [];
  if (documents.length === 0) return [];

  const pdfs = await Promise.all(
    documents.map(async (doc, index) => {
      const session = await getUsableBoeSession({ sessionId });
      const buffer = await getStoredPdfBuffer(doc.url, doc.titulo, subasta.id, session);
      return buffer
        ? {
            index,
            titulo: doc.titulo,
            bytes: buffer.length,
            base64: buffer.toString("base64"),
            priority: getDocumentPriority(doc.titulo),
          }
        : null;
    })
  );

  let attachedCount = 0;
  let attachedBytes = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];

  const selected = pdfs
    .filter((pdf): pdf is NonNullable<typeof pdf> => Boolean(pdf))
    .filter((pdf) => pdf.bytes <= MAX_SINGLE_ATTACHMENT_BYTES)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.bytes !== b.bytes) return a.bytes - b.bytes;
      return a.index - b.index;
    });

  for (const pdf of selected) {
    if (attachedCount >= MAX_ATTACHED_DOCS) break;
    if (attachedBytes + pdf.bytes > MAX_TOTAL_ATTACHMENT_BYTES) continue;

    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pdf.base64,
      },
    });
    parts.push({
      text: `[Documento adjunto: "${pdf.titulo}"]`,
    });

    attachedCount += 1;
    attachedBytes += pdf.bytes;
  }

  return parts;
}

async function generateAnalysisResponse(
  ai: GoogleGenAI,
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfParts: any[]
) {
  const parts = [...pdfParts, { text: prompt }];

  return ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: "user", parts }],
  });
}

export async function analizarSubasta(
  subasta: Subasta,
  sessionId?: string
): Promise<AnalysisResult> {
  const ai = getClient();
  const prompt = buildPrompt(subasta);
  const pdfParts = await loadPrioritizedPdfParts(subasta, sessionId);
  const docsAttached = pdfParts.filter((p) => p.inlineData).length;

  let response;
  try {
    response = await generateAnalysisResponse(ai, prompt, pdfParts);
  } catch (error) {
    if (!isInvalidModelInputError(error)) throw error;
    response = await generateAnalysisResponse(ai, prompt, []);
  }

  // Extract token usage
  const meta = response.usageMetadata;
  const inputTokens = meta?.promptTokenCount ?? 0;
  const outputTokens = meta?.candidatesTokenCount ?? 0;
  const totalTokens = meta?.totalTokenCount ?? 0;
  const costUsd = calculateCost(inputTokens, outputTokens);

  const text = (response.text ?? "").trim();

  let jsonStr = text;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  return {
    subastaId: subasta.id,
    oportunidad: parsed.oportunidad,
    recomendacion: parsed.recomendacion,
    resumen: parsed.resumen,
    economico: parsed.economico || {
      valorMercadoEstimado: "No estimado",
      descuentoEstimado: "No estimado",
      depositoNecesario: "No estimado",
      costesTotalesEstimados: "No estimado",
      rentabilidadEstimada: "No estimado",
      items: [],
    },
    cargas: parsed.cargas || [],
    situacionJuridica: parsed.situacionJuridica || [],
    posesion: parsed.posesion || [],
    ubicacion: parsed.ubicacion || [],
    riesgos: parsed.riesgos || [],
    oportunidades: parsed.oportunidades || [],
    estrategiaPuja: parsed.estrategiaPuja || [],
    glosario: parsed.glosario || [],
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      model: MODEL_NAME,
      docsAttached,
    },
    analyzedAt: new Date().toISOString(),
  };
}

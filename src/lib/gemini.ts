import { GoogleGenAI } from "@google/genai";
import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";
import { getDocumentsCollection } from "./mongodb";

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

  return `Eres un experto en subastas judiciales españolas, inversión inmobiliaria, derecho hipotecario y análisis de riesgos legales. Un inversor te pide que analices esta subasta con el MÁXIMO detalle posible.

Devuelve un JSON con EXACTAMENTE esta estructura (sin markdown, solo JSON puro):

{
  "oportunidad": <número del 1 al 10>,
  "recomendacion": "<comprar|observar|descartar>",
  "resumen": "<resumen de 3-4 frases claro y directo de la oportunidad, como si se lo explicaras a alguien que no sabe nada>",

  "economico": {
    "valorMercadoEstimado": "<tu estimación del valor de mercado real de este inmueble basado en zona, m2, tipo — ej: '180.000€ - 220.000€'>",
    "descuentoEstimado": "<porcentaje de descuento respecto al mercado — ej: '35-45% bajo mercado'>",
    "depositoNecesario": "<cuánto hay que depositar para participar — ej: '12.500€'>",
    "costesTotalesEstimados": "<suma de: precio puja + ITP/IVA + notaría + registro + posibles cargas — ej: '85.000€ - 105.000€'>",
    "rentabilidadEstimada": "<si se compra para alquilar o revender, qué rentabilidad se puede esperar — ej: 'Alquiler: 6-8% bruto. Reventa: 40-60% plusvalía potencial'>",
    "items": [
      "Precio de salida: X€ (es el Y% de la tasación)",
      "Tasación oficial: X€",
      "Puja mínima: X€ — esto es lo MÍNIMO que puedes ofertar",
      "Depósito: X€ (5% del valor subasta) — lo recuperas si no ganas",
      "ITP estimado (si segunda mano): X€ (entre 6-10% según CCAA)",
      "Notaría + registro estimado: X€",
      "Si hay cargas anteriores: se deducen del precio o se extinguen (ver sección cargas)",
      "<cualquier otro coste relevante>"
    ]
  },

  "cargas": [
    "Explicación de qué cargas tiene el inmueble (hipotecas, embargos, anotaciones)",
    "Si hay certificado de cargas disponible: qué dice exactamente",
    "Qué cargas se EXTINGUEN con la subasta (las posteriores al crédito del ejecutante)",
    "Qué cargas SUBSISTEN (las anteriores o preferentes) y cuánto cuestan",
    "Importe total de cargas que tendría que asumir el comprador: X€",
    "Si no hay info de cargas: explicar qué hacer para averiguarlo"
  ],

  "situacionJuridica": [
    "Tipo de procedimiento (ejecución hipotecaria, apremio, etc.) y qué implica",
    "Quién es el acreedor y qué tipo de entidad es (banco, fondo buitre, particular)",
    "Si es vivienda habitual del deudor: derecho de uso, posible prórrogas, realojos",
    "Estado procesal: si puede haber incidentes, suspensiones, o impugnaciones",
    "Si hay cesiones de crédito (ej: banco vendió deuda a un fondo) — qué implica"
  ],

  "posesion": [
    "¿Está ocupada la vivienda? ¿Por quién? (deudor, inquilino, okupa)",
    "Si está ocupada: procedimiento y coste estimado de desahucio (tiempo y dinero)",
    "Si NO consta situación posesoria: qué significa y qué debería hacer el comprador",
    "Si dice 'visitable': es buena señal, significa que se puede ver por dentro",
    "Plazo estimado para tomar posesión real del inmueble"
  ],

  "ubicacion": [
    "Análisis de la zona: barrio, entorno, servicios, transporte",
    "Precio medio €/m2 en esa zona para este tipo de inmueble",
    "Demanda de mercado: ¿es zona con mucha demanda o zona deprimida?",
    "Perfil de comprador/inquilino típico de la zona",
    "Tendencia del mercado en esa zona (subiendo, bajando, estable)"
  ],

  "riesgos": [
    "Cada riesgo REAL y concreto en formato: 'RIESGO: descripción — IMPACTO: qué pasa si ocurre'",
    "Solo riesgos que tengan base en los datos. NO inventar riesgos genéricos",
    "Si hay documentos disponibles (edicto, cert. cargas), eso REDUCE riesgo — no lo pongas como riesgo"
  ],

  "oportunidades": [
    "Cada punto fuerte de esta subasta",
    "Descuento vs mercado, documentación disponible, zona buena, etc.",
    "Potencial de revalorización, alquiler, reforma+reventa"
  ],

  "estrategiaPuja": [
    "Puja máxima recomendada para que siga siendo rentable: X€",
    "Rango óptimo de puja: entre X€ y Y€",
    "Si hay puja actual: análisis de si sigue mereciendo la pena",
    "Momento óptimo para pujar (principio, medio, final de la subasta)",
    "Plan B si no se gana la subasta"
  ],

  "glosario": [
    { "termino": "Certificación de cargas", "explicacion": "Documento del registro de la propiedad que lista TODAS las cargas (hipotecas, embargos, etc.) que pesan sobre el inmueble. Es fundamental revisarlo." },
    { "termino": "ITP", "explicacion": "Impuesto de Transmisiones Patrimoniales. Se paga al comprar inmuebles de segunda mano en subasta. Varía por CCAA (6-10%)." },
    { "termino": "<otro término relevante que aparezca en esta subasta>", "explicacion": "<explicación clara>" }
  ]
}

REGLAS IMPORTANTES:
- TODOS los arrays deben tener AL MENOS 3 items útiles y específicos para ESTA subasta. No pongas genéricos.
- En "economico.items" pon TODOS los números concretos que puedas calcular. El inversor quiere saber EXACTAMENTE cuánto le va a costar todo.
- En "glosario" incluye entre 4-8 términos que aparezcan en esta subasta y que alguien no experto podría no entender (ej: cesión de crédito, ejecución hipotecaria, anotación preventiva, dominio, carga preferente, etc.)
- Si un campo dice "No consta" o está vacío, NO lo cuentes como riesgo. Simplemente di que no hay info y qué debería hacer el inversor.
- ${numDocs > 0 ? `Hay ${numDocs} documento(s) descargables. Tenerlos es POSITIVO.` : "No hay documentos disponibles."} ${hasCertCargas ? "TIENE CERTIFICADO DE CARGAS — valora esto muy positivamente." : ""} ${hasEdicto ? "TIENE EDICTO." : ""}
- Tasación "0,00€" = no declarada, NO vale 0.
- Sé CONCRETO con números. Estima precios, costes, plazos. El inversor quiere cifras, no vaguedades.

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

// Get PDF base64: check MongoDB cache first, download from BOE if not cached
async function getPdfBase64(
  url: string,
  titulo: string,
  subastaId: string,
  sessionId?: string
): Promise<string | null> {
  const col = await getDocumentsCollection();

  // Check cache
  const cached = await col.findOne({ url });
  if (cached?.base64) {
    return cached.base64;
  }

  // Download from BOE
  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/pdf,*/*",
    };
    if (sessionId) {
      headers["Cookie"] = `SESSID=${sessionId}`;
    }

    const resp = await fetch(url, {
      headers,
      redirect: "follow",
    });

    if (!resp.ok) return null;

    const buffer = await resp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // Skip tiny responses (likely error/login pages)
    if (base64.length < 500) return null;

    // Save to MongoDB
    await col.updateOne(
      { url },
      {
        $set: {
          url,
          subastaId,
          titulo,
          base64,
          sizeBytes: buffer.byteLength,
          downloadedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    return base64;
  } catch {
    return null;
  }
}

export async function analizarSubasta(
  subasta: Subasta,
  sessionId?: string
): Promise<AnalysisResult> {
  const ai = getClient();
  const prompt = buildPrompt(subasta);

  // Use env var as fallback for BOE session
  const session = sessionId || process.env.BOE_SESSID;

  // Build parts: PDFs first, then text prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];

  // Download/cache and attach PDFs
  if (subasta.documentos && subasta.documentos.length > 0) {
    const pdfs = await Promise.all(
      subasta.documentos.map((doc) =>
        getPdfBase64(doc.url, doc.titulo, subasta.id, session)
      )
    );

    for (let i = 0; i < pdfs.length; i++) {
      const base64 = pdfs[i];
      if (base64) {
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: base64,
          },
        });
        parts.push({
          text: `[Documento adjunto: "${subasta.documentos[i].titulo}"]`,
        });
      }
    }
  }

  // Add the main prompt last
  parts.push({ text: prompt });

  const docsAttached = parts.filter((p) => p.inlineData).length;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: "user", parts }],
  });

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

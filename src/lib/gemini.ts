import { GoogleGenAI } from "@google/genai";
import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenAI({ apiKey });
}

function buildPrompt(subasta: Subasta): string {
  const field = (label: string, value?: string | null) =>
    value && value !== "No disponible" && value !== "no consta"
      ? `- ${label}: ${value}`
      : null;

  const sections: string[] = [];

  // Datos generales
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

  // Datos económicos
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

  // Bien
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
      field("Información registral electrónica", subasta.infoRegistralElectronica),
      field("Información adicional", subasta.infoAdicional),
      field("Cargas", subasta.cargas),
    ]
      .filter(Boolean)
      .join("\n")
  );

  // Autoridad gestora
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

  // Acreedor
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

  // Documentos
  if (subasta.documentos && subasta.documentos.length > 0) {
    sections.push("\n## DOCUMENTOS DISPONIBLES");
    sections.push(
      subasta.documentos.map((d) => `- ${d.titulo} (${d.url})`).join("\n")
    );
  }

  // Raw data extra (campos que no están mapeados)
  if (subasta.rawData) {
    const mappedKeys = new Set([
      "url", "Identificador", "Estado", "Tipo de subasta", "Fecha de inicio",
      "Fecha de conclusión", "Valor subasta", "Tasación", "Puja mínima",
      "Tramos entre pujas", "Importe del depósito", "Cantidad reclamada",
      "Precio puja actual", "Lotes", "Descripción", "Dirección", "Código Postal",
      "Localidad", "Provincia", "Situación posesoria", "Visitable",
      "Referencia catastral", "Vivienda habitual", "Cargas", "Anuncio BOE",
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

  return `Eres un experto en subastas judiciales españolas, inversión inmobiliaria y análisis de riesgos legales. Analiza la siguiente subasta de forma exhaustiva y devuelve un JSON con exactamente esta estructura (sin markdown, solo JSON puro):

{
  "oportunidad": <número del 1 al 10>,
  "riesgos": ["riesgo1", "riesgo2", ...],
  "resumen": "<resumen de 2-3 frases de la oportunidad>",
  "recomendacion": "<comprar|observar|descartar>",
  "detalles": "<análisis detallado>"
}

Criterios de análisis:
1. PRECIO: Compara valor de subasta vs tasación. Calcula el descuento real.
2. UBICACIÓN: Analiza localidad, provincia, CP para estimar demanda de mercado.
3. CARGAS Y SITUACIÓN REGISTRAL: Analiza inscripción registral, cargas, hipotecas previas.
4. POSESIÓN: Si está ocupada (situación posesoria), factor de riesgo alto.
5. ACREEDOR: Identifica si es banco, fondo, particular. Los bancos suelen tener procesos más limpios.
6. DOCUMENTOS: Valora la disponibilidad de edicto, certificación de cargas.
7. CANTIDAD RECLAMADA vs VALOR: Si la deuda es mucho menor que el valor, puede haber margen.
8. TIPO DE BIEN: Vivienda habitual tiene protecciones especiales del deudor.
9. PUJAS: Si hay puja actual, analiza si sigue siendo interesante.
10. DEPÓSITO: Calcula el capital necesario para participar.

En "detalles" incluye: análisis del precio, ubicación, riesgos legales, estrategia de puja recomendada, estimación de rentabilidad, y cualquier red flag que detectes.

${sections.join("\n")}

IMPORTANTE: Responde SOLO con el JSON, sin bloques de código ni texto adicional.`;
}

export async function analizarSubasta(
  subasta: Subasta
): Promise<AnalysisResult> {
  const ai = getClient();
  const prompt = buildPrompt(subasta);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = (response.text ?? "").trim();

  // Parse JSON - remove markdown code blocks if present
  let jsonStr = text;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  return {
    subastaId: subasta.id,
    oportunidad: parsed.oportunidad,
    riesgos: parsed.riesgos,
    resumen: parsed.resumen,
    recomendacion: parsed.recomendacion,
    detalles: parsed.detalles,
    analyzedAt: new Date().toISOString(),
  };
}

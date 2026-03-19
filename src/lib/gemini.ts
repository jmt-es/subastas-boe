import { GoogleGenAI } from "@google/genai";
import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenAI({ apiKey });
}

export async function analizarSubasta(
  subasta: Subasta
): Promise<AnalysisResult> {
  const ai = getClient();

  const prompt = `Eres un experto en subastas judiciales españolas e inversión inmobiliaria. Analiza la siguiente subasta y devuelve un JSON con exactamente esta estructura (sin markdown, solo JSON puro):

{
  "oportunidad": <número del 1 al 10>,
  "riesgos": ["riesgo1", "riesgo2", ...],
  "resumen": "<resumen de 2-3 frases de la oportunidad>",
  "recomendacion": "<comprar|observar|descartar>",
  "detalles": "<análisis detallado de 4-6 párrafos incluyendo: valoración del precio vs tasación, análisis de la ubicación, posibles cargas, situación posesoria, estrategia de puja recomendada, y estimación de rentabilidad>"
}

Datos de la subasta:
- Identificador: ${subasta.identificador || subasta.id}
- Estado: ${subasta.estado || "No disponible"}
- Tipo: ${subasta.tipoSubasta || "No disponible"}
- Valor subasta: ${subasta.valorSubasta || "No disponible"}
- Tasación: ${subasta.tasacion || "No disponible"}
- Puja mínima: ${subasta.pujaMinima || "No disponible"}
- Puja actual: ${subasta.pujActual || "No disponible"}
- Cantidad reclamada: ${subasta.cantidadReclamada || "No disponible"}
- Importe depósito: ${subasta.importeDeposito || "No disponible"}
- Fecha inicio: ${subasta.fechaInicio || "No disponible"}
- Fecha conclusión: ${subasta.fechaConclusion || "No disponible"}
- Descripción del bien: ${subasta.descripcion || "No disponible"}
- Dirección: ${subasta.direccion || "No disponible"}
- Código postal: ${subasta.codigoPostal || "No disponible"}
- Localidad: ${subasta.localidad || "No disponible"}
- Provincia: ${subasta.provincia || "No disponible"}
- Situación posesoria: ${subasta.situacionPosesoria || "No disponible"}
- Visitable: ${subasta.visitable || "No disponible"}
- Referencia catastral: ${subasta.referenciaCatastral || "No disponible"}
- Lotes: ${subasta.lotes || "Sin lotes"}

Datos adicionales:
${JSON.stringify(subasta.rawData, null, 2)}

IMPORTANTE: Responde SOLO con el JSON, sin bloques de código ni texto adicional.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
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

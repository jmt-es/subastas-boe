// Storage types shared between client and server.

export interface AnalysisResult {
  subastaId: string;
  oportunidad: number;
  recomendacion: "comprar" | "observar" | "descartar";
  resumen: string;

  // Desglose económico detallado
  economico: {
    valorMercadoEstimado: string;
    descuentoEstimado: string;
    depositoNecesario: string;
    costesTotalesEstimados: string;
    rentabilidadEstimada: string;
    items: string[];
  };

  // Secciones con bullet points
  cargas: string[];
  situacionJuridica: string[];
  posesion: string[];
  ubicacion: string[];
  riesgos: string[];
  oportunidades: string[];
  estrategiaPuja: string[];
  glosario: { termino: string; explicacion: string }[];

  // Coste del análisis
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    model: string;
    docsAttached?: number;
  };

  analyzedAt: string;
}

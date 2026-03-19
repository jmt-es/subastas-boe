// Storage types shared between client and server.
// In production (Vercel), data lives in the client (localStorage).
// API routes are stateless — they process and return data directly.

export interface AnalysisResult {
  subastaId: string;
  oportunidad: number;
  riesgos: string[];
  resumen: string;
  recomendacion: "comprar" | "observar" | "descartar";
  detalles: string;
  analyzedAt: string;
}

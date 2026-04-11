"use client";

import { useRef, useState } from "react";
import { Download, KeyRound, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Subasta } from "@/lib/scraper";

interface ScrapeDialogProps {
  onClose: () => void;
  onComplete: (subastas: Subasta[]) => void;
}

interface Progress {
  pagina: number;
  total: number | null;
  subastasEnPagina: number;
  procesadas: number;
  subastaActual: string;
}

export function ScrapeDialog({ onClose, onComplete }: ScrapeDialogProps) {
  const [tipoBien, setTipoBien] = useState("inmuebles");
  const [estado, setEstado] = useState("celebrandose");
  const [provincia, setProvincia] = useState("");
  const [maxPaginas, setMaxPaginas] = useState("1");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [lastSubasta, setLastSubasta] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const subastasRef = useRef<Subasta[]>([]);

  const handleScrape = async () => {
    setLoading(true);
    setResult(null);
    setError(false);
    setProgress(null);
    setScrapedCount(0);
    setLastSubasta("");
    subastasRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoBien,
          estado,
          provincia,
          maxPaginas: parseInt(maxPaginas, 10) || 1,
          sessionId: sessionId.trim() || undefined,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "progress") {
                setProgress(data);
              } else if (eventType === "subasta") {
                subastasRef.current.push(data as Subasta);
                setScrapedCount(subastasRef.current.length);
                setLastSubasta((data as Subasta).id);
              } else if (eventType === "complete") {
                setResult(`${subastasRef.current.length} subastas scrapeadas`);
                setTimeout(() => onComplete(subastasRef.current), 800);
              } else if (eventType === "error") {
                setError(true);
                setResult(data.error);
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      }

      if (subastasRef.current.length > 0 && !result) {
        setResult(`${subastasRef.current.length} subastas scrapeadas`);
        setTimeout(() => onComplete(subastasRef.current), 800);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        if (subastasRef.current.length > 0) {
          setResult(`Cancelado - ${subastasRef.current.length} subastas guardadas`);
          setTimeout(() => onComplete(subastasRef.current), 800);
        } else {
          setResult("Scraping cancelado");
        }
      } else {
        setError(true);
        setResult(String(e));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setResult("Scraping cancelado");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#162032]/24 px-4 backdrop-blur-sm">
      <div className="war-panel-strong w-full max-w-xl overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
          <div>
            <p className="section-kicker">Scrape BOE</p>
            <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.03em] text-foreground">
              Nueva captura operativa
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="tech-label">Tipo</label>
              <Select value={tipoBien} onValueChange={(value) => value && setTipoBien(value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-input text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inmuebles">Inmuebles</SelectItem>
                  <SelectItem value="vehiculos">Vehiculos</SelectItem>
                  <SelectItem value="muebles">Muebles</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="tech-label">Estado</label>
              <Select value={estado} onValueChange={(value) => value && setEstado(value)}>
                <SelectTrigger className="h-11 rounded-2xl border-border bg-input text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celebrandose">Celebrandose</SelectItem>
                  <SelectItem value="proxima">Proxima</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                  <SelectItem value="suspendida">Suspendida</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="tech-label">Provincia</label>
              <Input
                placeholder="28 = Madrid"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="h-11 rounded-2xl border-border bg-input text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="tech-label">Paginas</label>
              <Input
                type="number"
                min="1"
                max="999"
                value={maxPaginas}
                onChange={(e) => setMaxPaginas(e.target.value)}
                className="h-11 rounded-2xl border-border bg-input text-sm"
              />
            </div>
          </div>

          <div className="war-panel-muted p-4">
            <label className="tech-label flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" />
              SESSID opcional
            </label>
            <Input
              placeholder="Cookie de sesion para documentos"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="mt-3 h-11 rounded-2xl border-border bg-input text-sm"
            />
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Si quieres acceso documental ampliado, pega la cookie SESSID de
              subastas.boe.es.
            </p>
          </div>

          {loading && (scrapedCount > 0 || progress) && (
            <div className="war-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="tech-label text-primary">Pipeline activo</p>
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-amber-700">
                  {scrapedCount} capturas
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      progress?.total && progress.total > 0
                        ? `${Math.min(100, (progress.procesadas / progress.total) * 100)}%`
                        : "12%",
                  }}
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {progress && (
                  <div>
                    <p className="tech-label">Pagina</p>
                    <p className="mt-2 font-mono text-lg text-foreground">
                      {progress.pagina}
                      {progress.total ? ` / ${progress.total}` : ""}
                    </p>
                  </div>
                )}
                <div>
                  <p className="tech-label">Ultimo expediente</p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {lastSubasta || progress?.subastaActual || "Preparando"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`border p-4 text-sm leading-7 ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-primary/12 bg-primary/8 text-primary"
              }`}
            >
              {result}
            </div>
          )}

          <div className="flex flex-col gap-3 md:flex-row">
            {!loading ? (
              <Button
                onClick={handleScrape}
                className="h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:brightness-105"
              >
                <Download className="h-4 w-4" />
                Iniciar scraping
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                variant="outline"
                className="h-11 flex-1 rounded-2xl border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Square className="h-4 w-4" />
                Detener
              </Button>
            )}

            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-2xl border-border bg-card text-sm font-medium text-foreground hover:bg-card/80"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

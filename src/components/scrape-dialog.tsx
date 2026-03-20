"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, X, KeyRound, Square } from "lucide-react";
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
  const [lastSubasta, setLastSubasta] = useState<string>("");
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
          maxPaginas: parseInt(maxPaginas) || 1,
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
              // JSON parse error, skip
            }
          }
        }
      }

      // If stream ends without complete event, still deliver what we have
      if (subastasRef.current.length > 0 && !result) {
        setResult(`${subastasRef.current.length} subastas scrapeadas`);
        setTimeout(() => onComplete(subastasRef.current), 800);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        // Deliver partial results on cancel
        if (subastasRef.current.length > 0) {
          setResult(`Cancelado — ${subastasRef.current.length} subastas guardadas`);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-4 rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Scrapear BOE</h2>
              <p className="text-[10px] text-muted-foreground tracking-wide uppercase">
                subastas.boe.es
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Tipo
              </label>
              <Select
                value={tipoBien}
                onValueChange={(v) => v && setTipoBien(v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inmuebles">Inmuebles</SelectItem>
                  <SelectItem value="vehiculos">Vehículos</SelectItem>
                  <SelectItem value="muebles">Muebles</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Estado
              </label>
              <Select
                value={estado}
                onValueChange={(v) => v && setEstado(v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celebrandose">Celebrándose</SelectItem>
                  <SelectItem value="proxima">Próxima</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                  <SelectItem value="suspendida">Suspendida</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Provincia
              </label>
              <Input
                placeholder="28 = Madrid"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Páginas
              </label>
              <Input
                type="number"
                min="1"
                max="999"
                value={maxPaginas}
                onChange={(e) => setMaxPaginas(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              SESSID BOE (opcional)
            </label>
            <Input
              placeholder="Cookie de sesión para datos extra"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="h-9 text-sm font-mono"
            />
            <p className="text-[9px] text-muted-foreground">
              Loguéate en subastas.boe.es y copia la cookie SESSID para acceder a documentos
            </p>
          </div>

          {/* Progress monitor */}
          {loading && (scrapedCount > 0 || progress) && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-primary uppercase animate-pulse">
                  Scrapeando en vivo...
                </span>
                <span className="text-sm font-mono font-black text-primary tabular-nums">
                  {scrapedCount}
                </span>
              </div>
              {progress && progress.total && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((scrapedCount / progress.total) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {progress ? `Pág ${progress.pagina}` : "Iniciando..."}
                  {progress?.total ? ` — ${progress.total} total` : ""}
                </span>
                <span className="font-mono truncate ml-2 max-w-[180px] text-primary/70">
                  {lastSubasta || progress?.subastaActual || ""}
                </span>
              </div>
            </div>
          )}

          {result && !loading && (
            <div
              className={`p-3 rounded-md text-sm font-medium ${
                error
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {result}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={loading ? handleStop : handleScrape}
              variant={loading ? "destructive" : "default"}
              className={`flex-1 h-10 font-semibold ${!loading ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
            >
              {loading ? (
                <>
                  <Square className="h-3.5 w-3.5 mr-2" />
                  Parar
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Iniciar Scraping
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

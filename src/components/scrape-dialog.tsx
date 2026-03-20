"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, X, Loader2, KeyRound } from "lucide-react";
import type { Subasta } from "@/lib/scraper";

interface ScrapeDialogProps {
  onClose: () => void;
  onComplete: (subastas: Subasta[]) => void;
}

export function ScrapeDialog({ onClose, onComplete }: ScrapeDialogProps) {
  const [tipoBien, setTipoBien] = useState("inmuebles");
  const [estado, setEstado] = useState("celebrandose");
  const [provincia, setProvincia] = useState("");
  const [maxPaginas, setMaxPaginas] = useState("1");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleScrape = async () => {
    setLoading(true);
    setResult(null);
    setError(false);
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
        }),
      });
      const data = await resp.json();
      if (data.success && data.subastas) {
        setResult(`${data.count} subastas encontradas`);
        setTimeout(() => onComplete(data.subastas), 1200);
      } else {
        setError(true);
        setResult(data.error || "Error desconocido");
      }
    } catch (e) {
      setError(true);
      setResult(String(e));
    } finally {
      setLoading(false);
    }
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
                max="10"
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

          {result && (
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

          <Button
            onClick={handleScrape}
            disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scrapeando... (puede tardar)
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
  );
}

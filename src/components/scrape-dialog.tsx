"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, X, Loader2 } from "lucide-react";

interface ScrapeDialogProps {
  onClose: () => void;
  onComplete: () => void;
}

export function ScrapeDialog({ onClose, onComplete }: ScrapeDialogProps) {
  const [tipoBien, setTipoBien] = useState("inmuebles");
  const [estado, setEstado] = useState("celebrandose");
  const [provincia, setProvincia] = useState("");
  const [maxPaginas, setMaxPaginas] = useState("1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleScrape = async () => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoBien,
          estado,
          provincia,
          maxPaginas: parseInt(maxPaginas) || 1,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setResult(
          `Scraping completado: ${data.nuevas} nuevas subastas (${data.total} total)`
        );
        setTimeout(onComplete, 2000);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (e) {
      setResult(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Scrapear Subastas BOE
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de bien</label>
            <Select value={tipoBien} onValueChange={(v) => v && setTipoBien(v)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <Select value={estado} onValueChange={(v) => v && setEstado(v)}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Provincia (código, ej: 28=Madrid)
            </label>
            <Input
              placeholder="Vacío = todas"
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Máx. páginas</label>
            <Input
              type="number"
              min="1"
              max="10"
              value={maxPaginas}
              onChange={(e) => setMaxPaginas(e.target.value)}
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-md text-sm ${
                result.startsWith("Error")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-green-500/10 text-green-700 dark:text-green-400"
              }`}
            >
              {result}
            </div>
          )}

          <Button
            onClick={handleScrape}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scrapeando... (puede tardar unos minutos)
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Iniciar Scraping
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

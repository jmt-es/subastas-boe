"use client";

import { useState, useEffect, useCallback } from "react";
import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";

export function useSubastas() {
  const [subastas, setSubastas] = useState<Subasta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubastas = useCallback(async () => {
    try {
      const resp = await fetch("/api/subastas");
      const data = await resp.json();
      setSubastas(data.subastas || []);
    } catch (e) {
      console.error("Error fetching subastas:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load from MongoDB on mount
  useEffect(() => {
    fetchSubastas();
  }, [fetchSubastas]);

  const addSubastas = useCallback(
    async (nuevas: Subasta[]) => {
      // Optimistic update
      setSubastas((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const s of nuevas) {
          map.set(s.id, s);
        }
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
        );
      });

      // Persist to MongoDB
      try {
        await fetch("/api/subastas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subastas: nuevas }),
        });
      } catch (e) {
        console.error("Error saving subastas:", e);
      }
    },
    []
  );

  const clearSubastas = useCallback(async () => {
    setSubastas([]);
    try {
      await fetch("/api/subastas", { method: "DELETE" });
    } catch (e) {
      console.error("Error clearing subastas:", e);
    }
  }, []);

  const getSubasta = useCallback(
    (id: string): Subasta | null => {
      return subastas.find((s) => s.id === id) || null;
    },
    [subastas]
  );

  return { subastas, loading, addSubastas, clearSubastas, getSubasta, refetch: fetchSubastas };
}

export function useAnalysis() {
  const getAnalysis = useCallback(
    async (subastaId: string): Promise<AnalysisResult | null> => {
      try {
        const resp = await fetch(
          `/api/analysis?subastaId=${encodeURIComponent(subastaId)}`
        );
        const data = await resp.json();
        return data;
      } catch {
        return null;
      }
    },
    []
  );

  const saveAnalysis = useCallback(async (analysis: AnalysisResult) => {
    try {
      await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis),
      });
    } catch (e) {
      console.error("Error saving analysis:", e);
    }
  }, []);

  return { getAnalysis, saveAnalysis };
}

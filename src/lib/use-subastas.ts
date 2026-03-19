"use client";

import { useState, useEffect, useCallback } from "react";
import type { Subasta } from "./scraper";
import type { AnalysisResult } from "./storage";

const STORAGE_KEY = "subastas-boe-data";
const ANALYSIS_KEY = "subastas-boe-analysis";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Error saving to localStorage:", e);
  }
}

export function useSubastas() {
  const [subastas, setSubastas] = useState<Subasta[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage<Subasta[]>(STORAGE_KEY, []);
    setSubastas(stored);
    setLoading(false);
  }, []);

  const addSubastas = useCallback(
    (nuevas: Subasta[]) => {
      setSubastas((prev) => {
        const idsExistentes = new Set(prev.map((s) => s.id));
        const nuevasUnicas = nuevas.filter((s) => !idsExistentes.has(s.id));
        const todas = [...nuevasUnicas, ...prev];
        saveToStorage(STORAGE_KEY, todas);
        return todas;
      });
    },
    []
  );

  const clearSubastas = useCallback(() => {
    setSubastas([]);
    saveToStorage(STORAGE_KEY, []);
  }, []);

  const getSubasta = useCallback(
    (id: string): Subasta | null => {
      return subastas.find((s) => s.id === id) || null;
    },
    [subastas]
  );

  return { subastas, loading, addSubastas, clearSubastas, getSubasta };
}

export function useAnalysis() {
  const getAnalysis = useCallback(
    (subastaId: string): AnalysisResult | null => {
      const all = loadFromStorage<Record<string, AnalysisResult>>(
        ANALYSIS_KEY,
        {}
      );
      return all[subastaId] || null;
    },
    []
  );

  const saveAnalysis = useCallback((analysis: AnalysisResult) => {
    const all = loadFromStorage<Record<string, AnalysisResult>>(
      ANALYSIS_KEY,
      {}
    );
    all[analysis.subastaId] = analysis;
    saveToStorage(ANALYSIS_KEY, all);
  }, []);

  return { getAnalysis, saveAnalysis };
}

// Export/import for data portability
export function exportData(): string {
  const subastas = loadFromStorage<Subasta[]>(STORAGE_KEY, []);
  const analysis = loadFromStorage<Record<string, AnalysisResult>>(
    ANALYSIS_KEY,
    {}
  );
  return JSON.stringify({ subastas, analysis }, null, 2);
}

export function importData(json: string): {
  subastas: number;
  analysis: number;
} {
  const data = JSON.parse(json);
  if (data.subastas) saveToStorage(STORAGE_KEY, data.subastas);
  if (data.analysis) saveToStorage(ANALYSIS_KEY, data.analysis);
  return {
    subastas: data.subastas?.length || 0,
    analysis: Object.keys(data.analysis || {}).length,
  };
}

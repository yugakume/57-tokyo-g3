"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

// =============================================
// CountdownContext
// =============================================

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string; // ISO date string in JST e.g. "2026-04-01"
  createdBy: string;
}

interface CountdownContextType {
  countdowns: CountdownItem[];
  addCountdown: (item: Omit<CountdownItem, "id">) => void;
  deleteCountdown: (id: string) => void;
}

const CountdownContext = createContext<CountdownContextType | undefined>(undefined);

// =============================================
// localStorage helpers
// =============================================

const STORAGE_KEY = "portal_countdowns";

function loadFromStorage(): CountdownItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data: CountdownItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// =============================================
// デフォルトデータ
// =============================================

const DEFAULT_COUNTDOWNS: CountdownItem[] = [
  {
    id: "countdown-default-1",
    title: "来期スタート",
    targetDate: "2026-04-01",
    createdBy: "yuga_kume@dot-jp.or.jp",
  },
];

// =============================================
// Provider
// =============================================

export function CountdownProvider({ children }: { children: ReactNode }) {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      setCountdowns(stored);
    } else {
      setCountdowns(DEFAULT_COUNTDOWNS);
      saveToStorage(DEFAULT_COUNTDOWNS);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveToStorage(countdowns);
    }
  }, [countdowns, loaded]);

  const addCountdown = useCallback((item: Omit<CountdownItem, "id">) => {
    const newItem: CountdownItem = {
      ...item,
      id: `countdown-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setCountdowns(prev => [...prev, newItem]);
  }, []);

  const deleteCountdown = useCallback((id: string) => {
    setCountdowns(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <CountdownContext.Provider value={{ countdowns, addCountdown, deleteCountdown }}>
      {children}
    </CountdownContext.Provider>
  );
}

export function useCountdown() {
  const ctx = useContext(CountdownContext);
  if (!ctx) throw new Error("useCountdown must be used within CountdownProvider");
  return ctx;
}

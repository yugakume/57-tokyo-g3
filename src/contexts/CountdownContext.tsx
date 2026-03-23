"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

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
// Provider
// =============================================

export function CountdownProvider({ children }: { children: ReactNode }) {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Firestoreリアルタイムリスナー
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "countdowns"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as CountdownItem);
      setCountdowns(data);
      setLoaded(true);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addCountdown = useCallback((item: Omit<CountdownItem, "id">) => {
    const newItem: CountdownItem = {
      ...item,
      id: `countdown-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setCountdowns((prev) => [...prev, newItem]);
    const { id, ...data } = newItem;
    setDoc(doc(db, "countdowns", id), data);
  }, []);

  const deleteCountdown = useCallback((id: string) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
    deleteDoc(doc(db, "countdowns", id));
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

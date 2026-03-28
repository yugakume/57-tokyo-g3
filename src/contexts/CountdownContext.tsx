"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_COUNTDOWNS } from "@/lib/demoData";
import { loadCache, saveCache, trackQuotaError } from "@/lib/firestoreCache";

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string;
  createdBy: string;
}

interface CountdownContextType {
  countdowns: CountdownItem[];
  addCountdown: (item: Omit<CountdownItem, "id">) => void;
  deleteCountdown: (id: string) => void;
}

const CountdownContext = createContext<CountdownContextType | undefined>(undefined);

const CACHE_KEY = "portal_countdowns";

export function CountdownProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isDemoUser) {
      setCountdowns(DEMO_COUNTDOWNS);
      setLoaded(true);
      return;
    }

    const cached = loadCache<CountdownItem>(CACHE_KEY);
    if (cached) {
      setCountdowns(cached);
      setLoaded(true);
      return;
    }

    getDocs(collection(db, "countdowns"))
      .then(snap => {
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id }) as CountdownItem);
        setCountdowns(data);
        saveCache(CACHE_KEY, data);
        setLoaded(true);
      })
      .catch(() => {
        trackQuotaError();
        setLoaded(true);
      });
  }, [isDemoUser, isLoading]);

  useEffect(() => {
    if (loaded && !isDemoUser) saveCache(CACHE_KEY, countdowns);
  }, [countdowns, loaded, isDemoUser]);

  const addCountdown = useCallback((item: Omit<CountdownItem, "id">) => {
    if (isDemoUser) return;
    const newItem: CountdownItem = {
      ...item,
      id: `countdown-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setCountdowns(prev => [...prev, newItem]);
    const { id, ...data } = newItem;
    setDoc(doc(db, "countdowns", id), data);
  }, [isDemoUser]);

  const deleteCountdown = useCallback((id: string) => {
    if (isDemoUser) return;
    setCountdowns(prev => prev.filter(c => c.id !== id));
    deleteDoc(doc(db, "countdowns", id));
  }, [isDemoUser]);

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

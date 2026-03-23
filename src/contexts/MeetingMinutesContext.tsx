"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { MeetingMinutes } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

// =============================================
// MeetingMinutesContext
// =============================================

interface MeetingMinutesContextType {
  minutes: MeetingMinutes[];
  addMinutes: (m: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => void;
  updateMinutes: (id: string, updates: Partial<MeetingMinutes>) => void;
  deleteMinutes: (id: string) => void;
  updateAttendance: (id: string, email: string, status: "出席" | "欠席" | "遅刻" | "未回答") => void;
}

const MeetingMinutesContext = createContext<MeetingMinutesContextType | undefined>(undefined);

// =============================================
// Provider
// =============================================

export function MeetingMinutesProvider({ children }: { children: ReactNode }) {
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);

  // Firestoreリアルタイムリスナー
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "meetingMinutes"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as MeetingMinutes);
      setMinutes(data);
    });
    return () => unsub();
  }, []);

  const addMinutes = useCallback((m: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const newMinutes: MeetingMinutes = {
      ...m,
      id: `minutes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setMinutes((prev) => [newMinutes, ...prev]);
    const { id, ...data } = newMinutes;
    setDoc(doc(db, "meetingMinutes", id), data);
  }, []);

  const updateMinutes = useCallback((id: string, updates: Partial<MeetingMinutes>) => {
    const updatedAt = new Date().toISOString();
    setMinutes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates, updatedAt } : m))
    );
    setDoc(doc(db, "meetingMinutes", id), { ...updates, updatedAt }, { merge: true });
  }, []);

  const deleteMinutes = useCallback((id: string) => {
    setMinutes((prev) => prev.filter((m) => m.id !== id));
    deleteDoc(doc(db, "meetingMinutes", id));
  }, []);

  const updateAttendance = useCallback((id: string, email: string, status: "出席" | "欠席" | "遅刻" | "未回答") => {
    setMinutes((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const attendance = { ...(m.attendance || {}) };
        if (status === "未回答") {
          delete attendance[email];
        } else {
          attendance[email] = status;
        }
        return { ...m, attendance, updatedAt: new Date().toISOString() };
      })
    );
    // Firestoreへの部分更新
    const target = minutes.find((m) => m.id === id);
    const attendance = { ...(target?.attendance || {}) };
    if (status === "未回答") {
      delete attendance[email];
    } else {
      attendance[email] = status;
    }
    setDoc(doc(db, "meetingMinutes", id), { attendance, updatedAt: new Date().toISOString() }, { merge: true });
  }, [minutes]);

  return (
    <MeetingMinutesContext.Provider value={{ minutes, addMinutes, updateMinutes, deleteMinutes, updateAttendance }}>
      {children}
    </MeetingMinutesContext.Provider>
  );
}

export function useMeetingMinutes() {
  const ctx = useContext(MeetingMinutesContext);
  if (!ctx) throw new Error("useMeetingMinutes must be used within MeetingMinutesProvider");
  return ctx;
}

"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import type { MeetingMinutes } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MEETING_MINUTES } from "@/lib/demoData";

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
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const minutesRef = useRef<MeetingMinutes[]>([]);
  useEffect(() => { minutesRef.current = minutes; }, [minutes]);

  useEffect(() => {
    if (isLoading) return;
    if (isDemoUser) {
      setMinutes(DEMO_MEETING_MINUTES);
      return;
    }
    const unsub = onSnapshot(collection(db, "meetingMinutes"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as MeetingMinutes);
      setMinutes(data);
    });
    return () => unsub();
  }, [isDemoUser, isLoading]);

  const addMinutes = useCallback((m: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => {
    if (isDemoUser) return;
    const now = new Date().toISOString();
    const id = `minutes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMinutes: MeetingMinutes = { ...m, id, createdAt: now, updatedAt: now };
    const { id: _id, ...data } = newMinutes;
    // onSnapshot handles the state update via Firestore latency compensation
    setDoc(doc(db, "meetingMinutes", id), data);
  }, [isDemoUser]);

  const updateMinutes = useCallback((id: string, updates: Partial<MeetingMinutes>) => {
    if (isDemoUser) return;
    const updatedAt = new Date().toISOString();
    // onSnapshot handles the state update via Firestore latency compensation
    setDoc(doc(db, "meetingMinutes", id), { ...updates, updatedAt }, { merge: true });
  }, [isDemoUser]);

  const deleteMinutes = useCallback((id: string) => {
    if (isDemoUser) return;
    // onSnapshot handles the state update via Firestore latency compensation
    deleteDoc(doc(db, "meetingMinutes", id));
  }, [isDemoUser]);

  const updateAttendance = useCallback((id: string, email: string, status: "出席" | "欠席" | "遅刻" | "未回答") => {
    if (isDemoUser) return;
    const target = minutesRef.current.find(m => m.id === id);
    if (!target) return;
    const updatedAt = new Date().toISOString();
    const attendance = { ...(target.attendance || {}) };
    if (status === "未回答") {
      delete attendance[email];
    } else {
      attendance[email] = status;
    }
    // onSnapshot handles the state update via Firestore latency compensation
    setDoc(doc(db, "meetingMinutes", id), { attendance, updatedAt }, { merge: true });
  }, [isDemoUser]);

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

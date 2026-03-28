"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import type { MeetingMinutes, AttendanceStatus } from "@/types";
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
  updateAttendance: (id: string, email: string, status: AttendanceStatus | "未回答") => void;
  updateAttendanceNote: (id: string, email: string, note: string) => void;
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
    // JSON round-trip removes undefined fields (Firestore rejects undefined values)
    setDoc(doc(db, "meetingMinutes", id), JSON.parse(JSON.stringify(data)));
  }, [isDemoUser]);

  const updateMinutes = useCallback((id: string, updates: Partial<MeetingMinutes>) => {
    if (isDemoUser) return;
    const updatedAt = new Date().toISOString();
    // JSON round-trip removes undefined fields (Firestore rejects undefined values)
    setDoc(doc(db, "meetingMinutes", id), JSON.parse(JSON.stringify({ ...updates, updatedAt })), { merge: true });
  }, [isDemoUser]);

  const deleteMinutes = useCallback((id: string) => {
    if (isDemoUser) return;
    // onSnapshot handles the state update via Firestore latency compensation
    deleteDoc(doc(db, "meetingMinutes", id));
  }, [isDemoUser]);

  const updateAttendance = useCallback((id: string, email: string, status: AttendanceStatus | "未回答") => {
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
    setDoc(doc(db, "meetingMinutes", id), { attendance, updatedAt }, { merge: true });
  }, [isDemoUser]);

  const updateAttendanceNote = useCallback((id: string, email: string, note: string) => {
    if (isDemoUser) return;
    const target = minutesRef.current.find(m => m.id === id);
    if (!target) return;
    const attendanceNotes = { ...(target.attendanceNotes || {}) };
    if (!note.trim()) {
      delete attendanceNotes[email];
    } else {
      attendanceNotes[email] = note.trim();
    }
    setDoc(doc(db, "meetingMinutes", id), { attendanceNotes, updatedAt: new Date().toISOString() }, { merge: true });
  }, [isDemoUser]);

  return (
    <MeetingMinutesContext.Provider value={{ minutes, addMinutes, updateMinutes, deleteMinutes, updateAttendance, updateAttendanceNote }}>
      {children}
    </MeetingMinutesContext.Provider>
  );
}

export function useMeetingMinutes() {
  const ctx = useContext(MeetingMinutesContext);
  if (!ctx) throw new Error("useMeetingMinutes must be used within MeetingMinutesProvider");
  return ctx;
}

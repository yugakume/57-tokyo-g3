"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import type { MeetingMinutes, AttendanceStatus } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MEETING_MINUTES } from "@/lib/demoData";
import { loadCache, saveCache, trackQuotaError } from "@/lib/firestoreCache";

interface MeetingMinutesContextType {
  minutes: MeetingMinutes[];
  addMinutes: (m: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => void;
  updateMinutes: (id: string, updates: Partial<MeetingMinutes>) => void;
  deleteMinutes: (id: string) => void;
  updateAttendance: (id: string, email: string, status: AttendanceStatus | "未回答") => void;
  updateAttendanceNote: (id: string, email: string, note: string) => void;
}

const MeetingMinutesContext = createContext<MeetingMinutesContextType | undefined>(undefined);

const CACHE_KEY = "portal_meetingMinutes";

export function MeetingMinutesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [loaded, setLoaded] = useState(false);
  const minutesRef = useRef<MeetingMinutes[]>([]);
  useEffect(() => { minutesRef.current = minutes; }, [minutes]);

  useEffect(() => {
    if (isLoading) return;
    if (isDemoUser) {
      setMinutes(DEMO_MEETING_MINUTES);
      setLoaded(true);
      return;
    }

    const cached = loadCache<MeetingMinutes>(CACHE_KEY);
    if (cached) {
      setMinutes(cached);
      setLoaded(true);
      return;
    }

    getDocs(collection(db, "meetingMinutes"))
      .then(snap => {
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id }) as MeetingMinutes);
        setMinutes(data);
        saveCache(CACHE_KEY, data);
        setLoaded(true);
      })
      .catch(() => {
        trackQuotaError();
        setLoaded(true);
      });
  }, [isDemoUser, isLoading]);

  useEffect(() => {
    if (loaded && !isDemoUser) saveCache(CACHE_KEY, minutes);
  }, [minutes, loaded, isDemoUser]);

  const addMinutes = useCallback((m: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => {
    if (isDemoUser) return;
    const now = new Date().toISOString();
    const id = `minutes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMinutes: MeetingMinutes = { ...m, id, createdAt: now, updatedAt: now };
    setMinutes(prev => [...prev, newMinutes]);
    const { id: _id, ...data } = newMinutes;
    setDoc(doc(db, "meetingMinutes", id), JSON.parse(JSON.stringify(data)));
  }, [isDemoUser]);

  const updateMinutes = useCallback((id: string, updates: Partial<MeetingMinutes>) => {
    if (isDemoUser) return;
    const updatedAt = new Date().toISOString();
    setMinutes(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt } : m));
    setDoc(doc(db, "meetingMinutes", id), JSON.parse(JSON.stringify({ ...updates, updatedAt })), { merge: true });
  }, [isDemoUser]);

  const deleteMinutes = useCallback((id: string) => {
    if (isDemoUser) return;
    setMinutes(prev => prev.filter(m => m.id !== id));
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
    setMinutes(prev => prev.map(m => m.id === id ? { ...m, attendance, updatedAt } : m));
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
    const updatedAt = new Date().toISOString();
    setMinutes(prev => prev.map(m => m.id === id ? { ...m, attendanceNotes, updatedAt } : m));
    setDoc(doc(db, "meetingMinutes", id), { attendanceNotes, updatedAt }, { merge: true });
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

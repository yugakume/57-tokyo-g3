"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { MeetingMinutes, MeetingLocation } from "@/types";

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
// localStorage helpers
// =============================================

const STORAGE_KEY = "portal_meeting_minutes";

function loadFromStorage(): MeetingMinutes[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data: MeetingMinutes[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// =============================================
// デフォルトデータ: 過去4回 + 次の土曜の定例MTG
// =============================================

function getPreviousSaturdays(count: number): Date[] {
  const results: Date[] = [];
  const now = new Date();
  // 直近の過去の土曜日を探す
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7) - 1);
  // 土曜日 = dayOfWeek 6
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() - 1);
  }
  for (let i = 0; i < count; i++) {
    results.push(new Date(d));
    d.setDate(d.getDate() - 7);
  }
  return results;
}

function getNextSaturday(): Date {
  const now = new Date();
  const d = new Date(now);
  const daysUntilSat = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (daysUntilSat === 0 ? 7 : daysUntilSat));
  return d;
}

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function generateDefaultMinutes(): MeetingMinutes[] {
  const minutes: MeetingMinutes[] = [];

  // 次の土曜（未来の予定として）
  const nextSat = getNextSaturday();
  minutes.push({
    id: "minutes-next",
    date: formatDateStr(nextSat),
    title: "定例MTG",
    startTime: "09:00",
    endTime: "12:00",
    location: "対面",
    attendees: [],
    content: "",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 過去4回分の土曜
  const pastSaturdays = getPreviousSaturdays(4);
  pastSaturdays.forEach((sat, i) => {
    minutes.push({
      id: `minutes-past-${i + 1}`,
      date: formatDateStr(sat),
      title: "定例MTG",
      startTime: "09:00",
      endTime: "12:00",
      location: "対面",
      attendees: [],
      content: i === 0 ? "議事録の内容をここに記入してください。" : "",
      createdBy: "system",
      createdAt: sat.toISOString(),
      updatedAt: sat.toISOString(),
    });
  });

  return minutes;
}

// =============================================
// Provider
// =============================================

export function MeetingMinutesProvider({ children }: { children: ReactNode }) {
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 初期ロード
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      setMinutes(stored);
    } else {
      const defaults = generateDefaultMinutes();
      setMinutes(defaults);
      saveToStorage(defaults);
    }
    setLoaded(true);
  }, []);

  // 変更時に保存
  useEffect(() => {
    if (loaded) {
      saveToStorage(minutes);
    }
  }, [minutes, loaded]);

  const addMinutes = useCallback((m: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const newMinutes: MeetingMinutes = {
      ...m,
      id: `minutes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setMinutes(prev => [newMinutes, ...prev]);
  }, []);

  const updateMinutes = useCallback((id: string, updates: Partial<MeetingMinutes>) => {
    setMinutes(prev =>
      prev.map(m =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
      )
    );
  }, []);

  const deleteMinutes = useCallback((id: string) => {
    setMinutes(prev => prev.filter(m => m.id !== id));
  }, []);

  const updateAttendance = useCallback((id: string, email: string, status: "出席" | "欠席" | "遅刻" | "未回答") => {
    setMinutes(prev =>
      prev.map(m => {
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
  }, []);

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

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { ActivityReport, DailyTopic } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface ActivityContextType {
  reports: ActivityReport[];
  topics: DailyTopic[];
  addOrUpdateReport: (data: Omit<ActivityReport, "id" | "createdAt" | "updatedAt">) => void;
  setTopic: (date: string, question: string) => void;
  getReportByDateAndUser: (date: string, email: string) => ActivityReport | undefined;
  getTopicByDate: (date: string) => DailyTopic | undefined;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [topics, setTopics] = useState<DailyTopic[]>([]);

  useEffect(() => {
    if (isLoading || isDemoUser) return;
    const unsubReports = onSnapshot(collection(db, "activityReports"), (snap) => {
      setReports(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ActivityReport));
    });
    const unsubTopics = onSnapshot(collection(db, "dailyTopics"), (snap) => {
      setTopics(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as DailyTopic));
    });
    return () => { unsubReports(); unsubTopics(); };
  }, [isDemoUser, isLoading]);

  // Report id is deterministic: date + email so we can upsert cleanly
  const addOrUpdateReport = useCallback((data: Omit<ActivityReport, "id" | "createdAt" | "updatedAt">) => {
    if (isDemoUser || !user) return;
    const id = `report-${data.date}-${data.userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const now = new Date().toISOString();
    const existing = reports.find((r) => r.id === id);
    const record: ActivityReport = {
      ...data,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setReports((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return [...filtered, record];
    });
    const { id: _id, ...docData } = record;
    setDoc(doc(db, "activityReports", id), docData);
  }, [isDemoUser, user, reports]);

  const setTopic = useCallback((date: string, question: string) => {
    if (isDemoUser || !user) return;
    const id = `topic-${date}`;
    const now = new Date().toISOString();
    const existing = topics.find((t) => t.date === date);
    const record: DailyTopic = {
      id,
      date,
      question,
      createdBy: user.email,
      createdAt: existing?.createdAt ?? now,
    };
    setTopics((prev) => {
      const filtered = prev.filter((t) => t.date !== date);
      return [...filtered, record];
    });
    const { id: _id, ...docData } = record;
    setDoc(doc(db, "dailyTopics", id), docData);
  }, [isDemoUser, user, topics]);

  const getReportByDateAndUser = useCallback((date: string, email: string) => {
    const id = `report-${date}-${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return reports.find((r) => r.id === id);
  }, [reports]);

  const getTopicByDate = useCallback((date: string) => {
    return topics.find((t) => t.date === date);
  }, [topics]);

  return (
    <ActivityContext.Provider value={{ reports, topics, addOrUpdateReport, setTopic, getReportByDateAndUser, getTopicByDate }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}

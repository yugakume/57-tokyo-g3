"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { ActivityReport, DailyTopic } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { loadCache, saveCache, trackQuotaError } from "@/lib/firestoreCache";

interface ActivityContextType {
  reports: ActivityReport[];
  topics: DailyTopic[];
  addOrUpdateReport: (data: Omit<ActivityReport, "id" | "createdAt" | "updatedAt">) => void;
  setTopic: (date: string, question: string) => void;
  getReportByDateAndUser: (date: string, email: string) => ActivityReport | undefined;
  getTopicByDate: (date: string) => DailyTopic | undefined;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

const REPORTS_KEY = "portal_activityReports";
const TOPICS_KEY  = "portal_dailyTopics";

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [reports, setReports] = useState<ActivityReport[]>([]);
  const [topics,  setTopics]  = useState<DailyTopic[]>([]);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    if (isLoading || isDemoUser) return;

    const cachedReports = loadCache<ActivityReport>(REPORTS_KEY);
    const cachedTopics  = loadCache<DailyTopic>(TOPICS_KEY);

    if (cachedReports && cachedTopics) {
      setReports(cachedReports);
      setTopics(cachedTopics);
      setLoaded(true);
      return;
    }

    Promise.all([
      getDocs(collection(db, "activityReports")),
      getDocs(collection(db, "dailyTopics")),
    ])
      .then(([repSnap, topSnap]) => {
        const r = repSnap.docs.map(d => ({ ...d.data(), id: d.id }) as ActivityReport);
        const t = topSnap.docs.map(d => ({ ...d.data(), id: d.id }) as DailyTopic);
        setReports(r);
        setTopics(t);
        saveCache(REPORTS_KEY, r);
        saveCache(TOPICS_KEY, t);
        setLoaded(true);
      })
      .catch(() => {
        trackQuotaError();
        if (cachedReports) setReports(cachedReports);
        if (cachedTopics)  setTopics(cachedTopics);
        setLoaded(true);
      });
  }, [isDemoUser, isLoading]);

  useEffect(() => { if (loaded && !isDemoUser) saveCache(REPORTS_KEY, reports); }, [reports, loaded, isDemoUser]);
  useEffect(() => { if (loaded && !isDemoUser) saveCache(TOPICS_KEY, topics); },  [topics,  loaded, isDemoUser]);

  const addOrUpdateReport = useCallback((data: Omit<ActivityReport, "id" | "createdAt" | "updatedAt">) => {
    if (isDemoUser || !user) return;
    const id = `report-${data.date}-${data.userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const now = new Date().toISOString();
    const existing = reports.find(r => r.id === id);
    const record: ActivityReport = {
      ...data,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setReports(prev => [...prev.filter(r => r.id !== id), record]);
    const { id: _id, ...docData } = record;
    setDoc(doc(db, "activityReports", id), docData);
  }, [isDemoUser, user, reports]);

  const setTopic = useCallback((date: string, question: string) => {
    if (isDemoUser || !user) return;
    const id = `topic-${date}`;
    const now = new Date().toISOString();
    const existing = topics.find(t => t.date === date);
    const record: DailyTopic = {
      id,
      date,
      question,
      createdBy: user.email,
      createdAt: existing?.createdAt ?? now,
    };
    setTopics(prev => [...prev.filter(t => t.date !== date), record]);
    const { id: _id, ...docData } = record;
    setDoc(doc(db, "dailyTopics", id), docData);
  }, [isDemoUser, user, topics]);

  const getReportByDateAndUser = useCallback((date: string, email: string) => {
    const id = `report-${date}-${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    return reports.find(r => r.id === id);
  }, [reports]);

  const getTopicByDate = useCallback((date: string) => {
    return topics.find(t => t.date === date);
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

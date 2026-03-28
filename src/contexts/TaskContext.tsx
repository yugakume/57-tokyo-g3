"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { Task, TaskStatus } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_TASKS } from "@/lib/demoData";

// =============================================
// TaskContext
// =============================================

interface TaskContextType {
  tasks: Task[];
  addTask: (t: Omit<Task, "id" | "createdAt" | "updatedAt">) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

// =============================================
// Provider
// =============================================

const cleanData = (obj: Record<string, unknown>) => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned;
};

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isDemoUser) {
      setTasks(DEMO_TASKS);
      setLoaded(true);
      return;
    }
    const unsub = onSnapshot(collection(db, "tasks"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Task);
      setTasks(data);
      setLoaded(true);
    });
    return () => unsub();
  }, [isDemoUser, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTask = useCallback((t: Omit<Task, "id" | "createdAt" | "updatedAt">): Task => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...t,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    if (!isDemoUser) {
      setTasks((prev) => [newTask, ...prev]);
      const { id, ...data } = newTask;
      setDoc(doc(db, "tasks", id), cleanData(data as unknown as Record<string, unknown>));
    }
    return newTask;
  }, [isDemoUser]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    if (isDemoUser) return;
    const updatedAt = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt } : t)));
    setDoc(doc(db, "tasks", id), cleanData({ ...updates, updatedAt } as unknown as Record<string, unknown>), { merge: true });
  }, [isDemoUser]);

  const deleteTask = useCallback((id: string) => {
    if (isDemoUser) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteDoc(doc(db, "tasks", id));
  }, [isDemoUser]);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    if (isDemoUser) return;
    const updatedAt = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, updatedAt } : t)));
    setDoc(doc(db, "tasks", id), { status, updatedAt }, { merge: true });
  }, [isDemoUser]);

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, updateTaskStatus }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTask() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTask must be used within TaskProvider");
  return ctx;
}

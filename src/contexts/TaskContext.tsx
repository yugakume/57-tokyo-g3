"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";

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
// デフォルトデータ: サンプルタスク
// =============================================

function generateDefaultTasks(): Task[] {
  const now = new Date().toISOString();
  const today = new Date();

  function daysFromNow(days: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  return [
    {
      id: "task-demo-1",
      title: "説明会資料の作成",
      description: "次回説明会で使用するスライド資料を作成する。対象は新規参加希望者向け。",
      status: "in_progress" as TaskStatus,
      priority: "high" as TaskPriority,
      assigneeEmails: ["tanaka@dot-jp.or.jp"],
      dueDate: daysFromNow(3),
      createdBy: "tanaka@dot-jp.or.jp",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-demo-2",
      title: "ヒアリングシートの更新",
      description: "ヒアリング用の質問項目を見直し、最新版に更新する。",
      status: "todo" as TaskStatus,
      priority: "medium" as TaskPriority,
      assigneeEmails: ["sato@dot-jp.or.jp", "tanaka@dot-jp.or.jp"],
      dueDate: daysFromNow(7),
      createdBy: "tanaka@dot-jp.or.jp",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-demo-3",
      title: "会場予約の確認",
      description: "来月の定例MTG会場が確保されているか確認し、未予約なら手配する。",
      status: "done" as TaskStatus,
      priority: "high" as TaskPriority,
      assigneeEmails: ["suzuki@dot-jp.or.jp"],
      dueDate: daysFromNow(-2),
      createdBy: "sato@dot-jp.or.jp",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-demo-4",
      title: "選考基準のドキュメント整備",
      description: "1次選考の評価基準を明文化し、スタッフ全員が参照できるようにする。",
      status: "todo" as TaskStatus,
      priority: "low" as TaskPriority,
      assigneeEmails: ["all"],
      dueDate: daysFromNow(14),
      createdBy: "suzuki@dot-jp.or.jp",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-demo-5",
      title: "新メンバーオンボーディング資料",
      description: "新しく参加するスタッフ向けのオンボーディング資料を準備する。",
      status: "in_progress" as TaskStatus,
      priority: "medium" as TaskPriority,
      assigneeEmails: ["sato@dot-jp.or.jp"],
      dueDate: daysFromNow(5),
      createdBy: "sato@dot-jp.or.jp",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "task-demo-6",
      title: "活動報告書の提出",
      description: "今月の活動報告書を取りまとめ、代表に提出する。",
      status: "done" as TaskStatus,
      priority: "medium" as TaskPriority,
      assigneeEmails: ["suzuki@dot-jp.or.jp"],
      dueDate: daysFromNow(-5),
      createdBy: "tanaka@dot-jp.or.jp",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// =============================================
// Provider
// =============================================

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Firestoreリアルタイムリスナー
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tasks"), (snapshot) => {
      if (snapshot.empty && !loaded) {
        // 初回かつデータなし → デフォルトデータを投入
        const defaults = generateDefaultTasks();
        const batch = writeBatch(db);
        defaults.forEach((t) => {
          const { id, ...data } = t;
          batch.set(doc(db, "tasks", id), data);
        });
        batch.commit();
        return; // バッチ書き込み後にonSnapshotが再発火する
      }
      const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Task);
      setTasks(data);
      setLoaded(true);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTask = useCallback((t: Omit<Task, "id" | "createdAt" | "updatedAt">): Task => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...t,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [newTask, ...prev]);
    const { id, ...data } = newTask;
    setDoc(doc(db, "tasks", id), data);
    return newTask;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const updatedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt } : t))
    );
    setDoc(doc(db, "tasks", id), { ...updates, updatedAt }, { merge: true });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteDoc(doc(db, "tasks", id));
  }, []);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    const updatedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, updatedAt } : t))
    );
    setDoc(doc(db, "tasks", id), { status, updatedAt }, { merge: true });
  }, []);

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

"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LinkItem, LinkCategory, AccountInfo, Announcement } from "@/types";

interface DataContextType {
  links: LinkItem[];
  categories: LinkCategory[];
  accounts: AccountInfo[];
  announcements: Announcement[];
  addLink: (link: Omit<LinkItem, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateLink: (id: string, link: Partial<LinkItem>) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  addCategory: (category: Omit<LinkCategory, "id">) => Promise<void>;
  updateCategory: (id: string, category: Partial<LinkCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addAccount: (account: Omit<AccountInfo, "id">) => Promise<void>;
  updateAccount: (id: string, account: Partial<AccountInfo>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addAnnouncement: (announcement: Omit<Announcement, "id">) => Promise<void>;
  updateAnnouncement: (id: string, announcement: Partial<Announcement>) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<LinkCategory[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const loaded = loadedCount >= 4;

  // Firestore リアルタイム購読
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Links
    unsubs.push(onSnapshot(collection(db, "links"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id })) as LinkItem[];
      setLinks(data);
      setLoadedCount(prev => prev + 1);
    }));

    // Categories
    unsubs.push(onSnapshot(collection(db, "linkCategories"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id })) as LinkCategory[];
      setCategories(data);
      setLoadedCount(prev => prev + 1);
    }));

    // Accounts
    unsubs.push(onSnapshot(collection(db, "accounts"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id })) as AccountInfo[];
      setAccounts(data);
      setLoadedCount(prev => prev + 1);
    }));

    // Announcements
    unsubs.push(onSnapshot(collection(db, "announcements"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Announcement[];
      setAnnouncements(data);
      setLoadedCount(prev => prev + 1);
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // --- Links ---
  const addLink = useCallback(async (link: Omit<LinkItem, "id" | "createdAt" | "updatedAt">) => {
    const id = `link-${Date.now()}`;
    const now = new Date().toISOString();
    const newLink = { ...link, id, createdAt: now, updatedAt: now };
    await setDoc(doc(db, "links", id), newLink);
  }, []);

  const updateLink = useCallback(async (id: string, updates: Partial<LinkItem>) => {
    await updateDoc(doc(db, "links", id), { ...updates, updatedAt: new Date().toISOString() });
  }, []);

  const deleteLink = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "links", id));
  }, []);

  // --- Categories ---
  const addCategory = useCallback(async (category: Omit<LinkCategory, "id">) => {
    const id = `cat-${Date.now()}`;
    await setDoc(doc(db, "linkCategories", id), { ...category, id });
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<LinkCategory>) => {
    await updateDoc(doc(db, "linkCategories", id), updates);
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "linkCategories", id));
  }, []);

  // --- Accounts ---
  const addAccount = useCallback(async (account: Omit<AccountInfo, "id">) => {
    const id = `acc-${Date.now()}`;
    await setDoc(doc(db, "accounts", id), { ...account, id });
  }, []);

  const updateAccount = useCallback(async (id: string, updates: Partial<AccountInfo>) => {
    await updateDoc(doc(db, "accounts", id), updates);
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "accounts", id));
  }, []);

  // --- Announcements ---
  const addAnnouncement = useCallback(async (announcement: Omit<Announcement, "id">) => {
    const id = `ann-${Date.now()}`;
    await setDoc(doc(db, "announcements", id), { ...announcement, id });
  }, []);

  const updateAnnouncement = useCallback(async (id: string, updates: Partial<Announcement>) => {
    await updateDoc(doc(db, "announcements", id), updates);
  }, []);

  const deleteAnnouncement = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "announcements", id));
  }, []);

  return (
    <DataContext.Provider value={{
      links, categories, accounts, announcements,
      addLink, updateLink, deleteLink,
      addCategory, updateCategory, deleteCategory,
      addAccount, updateAccount, deleteAccount,
      addAnnouncement, updateAnnouncement, deleteAnnouncement,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

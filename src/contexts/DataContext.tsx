"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LinkItem, LinkCategory, AccountInfo, Announcement, AnnouncementCategory } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEMO_LINKS, DEMO_LINK_CATEGORIES, DEMO_ACCOUNTS,
  DEMO_ANNOUNCEMENTS, DEMO_ANNOUNCEMENT_CATEGORIES,
} from "@/lib/demoData";

interface DataContextType {
  links: LinkItem[];
  categories: LinkCategory[];
  accounts: AccountInfo[];
  announcements: Announcement[];
  announcementCategories: AnnouncementCategory[];
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
  addAnnouncementCategory: (category: Omit<AnnouncementCategory, "id">) => Promise<void>;
  updateAnnouncementCategory: (id: string, category: Partial<AnnouncementCategory>) => Promise<void>;
  deleteAnnouncementCategory: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<LinkCategory[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementCategories, setAnnouncementCategories] = useState<AnnouncementCategory[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const loaded = loadedCount >= 5;

  // デモユーザーはダミーデータを使用
  useEffect(() => {
    if (isLoading) return;
    if (isDemoUser) {
      setLinks(DEMO_LINKS);
      setCategories(DEMO_LINK_CATEGORIES);
      setAccounts(DEMO_ACCOUNTS);
      setAnnouncements(DEMO_ANNOUNCEMENTS);
      setAnnouncementCategories(DEMO_ANNOUNCEMENT_CATEGORIES);
      return;
    }

    // Firestore リアルタイム購読（実ユーザーのみ）
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

    // Announcement Categories
    unsubs.push(onSnapshot(collection(db, "announcementCategories"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id })) as AnnouncementCategory[];
      setAnnouncementCategories(data);
      setLoadedCount(prev => prev + 1);
    }));

    return () => unsubs.forEach(u => u());
  }, [isDemoUser, isLoading]);

  const demoNoOp = useCallback(async () => { /* デモモードでは変更不可 */ }, []);

  // --- Links ---
  const addLink = useCallback(async (link: Omit<LinkItem, "id" | "createdAt" | "updatedAt">) => {
    if (isDemoUser) return;
    const id = `link-${Date.now()}`;
    const now = new Date().toISOString();
    const newLink = { ...link, id, createdAt: now, updatedAt: now };
    await setDoc(doc(db, "links", id), newLink);
  }, [isDemoUser]);

  const updateLink = useCallback(async (id: string, updates: Partial<LinkItem>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "links", id), { ...updates, updatedAt: new Date().toISOString() });
  }, [isDemoUser]);

  const deleteLink = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "links", id));
  }, [isDemoUser]);

  // --- Categories ---
  const addCategory = useCallback(async (category: Omit<LinkCategory, "id">) => {
    if (isDemoUser) return;
    const id = `cat-${Date.now()}`;
    await setDoc(doc(db, "linkCategories", id), { ...category, id });
  }, [isDemoUser]);

  const updateCategory = useCallback(async (id: string, updates: Partial<LinkCategory>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "linkCategories", id), updates);
  }, [isDemoUser]);

  const deleteCategory = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "linkCategories", id));
  }, [isDemoUser]);

  // --- Accounts ---
  const addAccount = useCallback(async (account: Omit<AccountInfo, "id">) => {
    if (isDemoUser) return;
    const id = `acc-${Date.now()}`;
    await setDoc(doc(db, "accounts", id), { ...account, id });
  }, [isDemoUser]);

  const updateAccount = useCallback(async (id: string, updates: Partial<AccountInfo>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "accounts", id), updates);
  }, [isDemoUser]);

  const deleteAccount = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "accounts", id));
  }, [isDemoUser]);

  // --- Announcements ---
  const addAnnouncement = useCallback(async (announcement: Omit<Announcement, "id">) => {
    if (isDemoUser) return;
    const id = `ann-${Date.now()}`;
    await setDoc(doc(db, "announcements", id), { ...announcement, id });
  }, [isDemoUser]);

  const updateAnnouncement = useCallback(async (id: string, updates: Partial<Announcement>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "announcements", id), updates);
  }, [isDemoUser]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "announcements", id));
  }, [isDemoUser]);

  // --- Announcement Categories ---
  const addAnnouncementCategory = useCallback(async (category: Omit<AnnouncementCategory, "id">) => {
    if (isDemoUser) return;
    const id = `anncat-${Date.now()}`;
    await setDoc(doc(db, "announcementCategories", id), { ...category, id });
  }, [isDemoUser]);

  const updateAnnouncementCategory = useCallback(async (id: string, updates: Partial<AnnouncementCategory>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "announcementCategories", id), updates);
  }, [isDemoUser]);

  const deleteAnnouncementCategory = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "announcementCategories", id));
  }, [isDemoUser]);

  return (
    <DataContext.Provider value={{
      links, categories, accounts, announcements, announcementCategories,
      addLink, updateLink, deleteLink,
      addCategory, updateCategory, deleteCategory,
      addAccount, updateAccount, deleteAccount,
      addAnnouncement, updateAnnouncement, deleteAnnouncement,
      addAnnouncementCategory, updateAnnouncementCategory, deleteAnnouncementCategory,
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

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LinkItem, LinkCategory, AccountInfo, InstagramAccount, Announcement, AnnouncementCategory } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEMO_LINKS, DEMO_LINK_CATEGORIES, DEMO_ACCOUNTS, DEMO_INSTA_ACCOUNTS,
  DEMO_ANNOUNCEMENTS, DEMO_ANNOUNCEMENT_CATEGORIES,
} from "@/lib/demoData";
import type { ReactNode } from "react";

interface DataContextType {
  links: LinkItem[];
  categories: LinkCategory[];
  accounts: AccountInfo[];
  instaAccounts: InstagramAccount[];
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
  addInstaAccount: (account: Omit<InstagramAccount, "id">) => Promise<void>;
  updateInstaAccount: (id: string, updates: Partial<InstagramAccount>) => Promise<void>;
  deleteInstaAccount: (id: string) => Promise<void>;
  addAnnouncement: (announcement: Omit<Announcement, "id">) => Promise<void>;
  updateAnnouncement: (id: string, announcement: Partial<Announcement>) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  addAnnouncementCategory: (category: Omit<AnnouncementCategory, "id">) => Promise<void>;
  updateAnnouncementCategory: (id: string, category: Partial<AnnouncementCategory>) => Promise<void>;
  deleteAnnouncementCategory: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// ============================================================
// localStorage キャッシュ (TTL: 5分)
// ============================================================
const CACHE_TTL = 5 * 60 * 1000;

function loadCache<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T[]; ts: number };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore */ }
}

// ============================================================
// Provider
// ============================================================
export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const isDemoUser = user?.isDemoUser === true;

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<LinkCategory[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [instaAccounts, setInstaAccounts] = useState<InstagramAccount[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementCategories, setAnnouncementCategories] = useState<AnnouncementCategory[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ----------------------------------------------------------
  // デモユーザーはダミーデータを使用
  // ----------------------------------------------------------
  useEffect(() => {
    if (isLoading) return;
    if (isDemoUser) {
      setLinks(DEMO_LINKS);
      setCategories(DEMO_LINK_CATEGORIES);
      setAccounts(DEMO_ACCOUNTS);
      setInstaAccounts(DEMO_INSTA_ACCOUNTS);
      setAnnouncements(DEMO_ANNOUNCEMENTS);
      setAnnouncementCategories(DEMO_ANNOUNCEMENT_CATEGORIES);
      setLoaded(true);
      return;
    }

    // ----------------------------------------------------------
    // 実ユーザー: キャッシュ確認 → 期限切れなら Firestore から取得
    // ----------------------------------------------------------
    const cachedLinks     = loadCache<LinkItem>("portal_links");
    const cachedCats      = loadCache<LinkCategory>("portal_linkCategories");
    const cachedAccs      = loadCache<AccountInfo>("portal_accounts");
    const cachedInsta     = loadCache<InstagramAccount>("portal_instaAccounts");
    const cachedAnn       = loadCache<Announcement>("portal_announcements");
    const cachedAnnCats   = loadCache<AnnouncementCategory>("portal_announcementCategories");

    const allCached =
      cachedLinks && cachedCats && cachedAccs &&
      cachedInsta && cachedAnn && cachedAnnCats;

    if (allCached) {
      setLinks(cachedLinks);
      setCategories(cachedCats);
      setAccounts(cachedAccs);
      setInstaAccounts(cachedInsta);
      setAnnouncements(cachedAnn);
      setAnnouncementCategories(cachedAnnCats);
      setLoaded(true);
      return;
    }

    // キャッシュなし or 期限切れ → Firestore から一括取得
    Promise.all([
      getDocs(collection(db, "links")),
      getDocs(collection(db, "linkCategories")),
      getDocs(collection(db, "accounts")),
      getDocs(collection(db, "instaAccounts")),
      getDocs(collection(db, "announcements")),
      getDocs(collection(db, "announcementCategories")),
    ]).then(([linksSnap, catsSnap, accsSnap, instaSnap, annSnap, annCatSnap]) => {
      const l  = linksSnap.docs.map(d => ({ ...d.data(), id: d.id })) as LinkItem[];
      const c  = catsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as LinkCategory[];
      const a  = accsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as AccountInfo[];
      const i  = instaSnap.docs.map(d => ({ ...d.data(), id: d.id })) as InstagramAccount[];
      const an = annSnap.docs.map(d => ({ ...d.data(), id: d.id })) as Announcement[];
      const ac = annCatSnap.docs.map(d => ({ ...d.data(), id: d.id })) as AnnouncementCategory[];

      setLinks(l);
      setCategories(c);
      setAccounts(a);
      setInstaAccounts(i);
      setAnnouncements(an);
      setAnnouncementCategories(ac);

      // キャッシュ保存
      saveCache("portal_links", l);
      saveCache("portal_linkCategories", c);
      saveCache("portal_accounts", a);
      saveCache("portal_instaAccounts", i);
      saveCache("portal_announcements", an);
      saveCache("portal_announcementCategories", ac);

      setLoaded(true);
    }).catch(() => {
      // Quota exceeded 等: キャッシュから部分的にでも表示
      if (cachedLinks)   setLinks(cachedLinks);
      if (cachedCats)    setCategories(cachedCats);
      if (cachedAccs)    setAccounts(cachedAccs);
      if (cachedInsta)   setInstaAccounts(cachedInsta);
      if (cachedAnn)     setAnnouncements(cachedAnn);
      if (cachedAnnCats) setAnnouncementCategories(cachedAnnCats);
      setLoaded(true);
    });
  }, [isDemoUser, isLoading]);

  // ----------------------------------------------------------
  // 書き込み後にキャッシュを同期
  // ----------------------------------------------------------
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_links", links); }, [links, loaded, isDemoUser]);
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_linkCategories", categories); }, [categories, loaded, isDemoUser]);
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_accounts", accounts); }, [accounts, loaded, isDemoUser]);
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_instaAccounts", instaAccounts); }, [instaAccounts, loaded, isDemoUser]);
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_announcements", announcements); }, [announcements, loaded, isDemoUser]);
  useEffect(() => { if (loaded && !isDemoUser) saveCache("portal_announcementCategories", announcementCategories); }, [announcementCategories, loaded, isDemoUser]);

  // ----------------------------------------------------------
  // Write 関数 (各操作後に state も即時更新 → キャッシュも追従)
  // ----------------------------------------------------------

  // --- Links ---
  const addLink = useCallback(async (link: Omit<LinkItem, "id" | "createdAt" | "updatedAt">) => {
    if (isDemoUser) return;
    const id = `link-${Date.now()}`;
    const now = new Date().toISOString();
    const newLink = { ...link, id, createdAt: now, updatedAt: now };
    await setDoc(doc(db, "links", id), newLink);
    setLinks(prev => [...prev, newLink]);
  }, [isDemoUser]);

  const updateLink = useCallback(async (id: string, updates: Partial<LinkItem>) => {
    if (isDemoUser) return;
    const updatedAt = new Date().toISOString();
    await updateDoc(doc(db, "links", id), { ...updates, updatedAt });
    setLinks(prev => prev.map(l => l.id === id ? { ...l, ...updates, updatedAt } : l));
  }, [isDemoUser]);

  const deleteLink = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "links", id));
    setLinks(prev => prev.filter(l => l.id !== id));
  }, [isDemoUser]);

  // --- Categories ---
  const addCategory = useCallback(async (category: Omit<LinkCategory, "id">) => {
    if (isDemoUser) return;
    const id = `cat-${Date.now()}`;
    const newCat = { ...category, id };
    await setDoc(doc(db, "linkCategories", id), newCat);
    setCategories(prev => [...prev, newCat]);
  }, [isDemoUser]);

  const updateCategory = useCallback(async (id: string, updates: Partial<LinkCategory>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "linkCategories", id), updates);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [isDemoUser]);

  const deleteCategory = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "linkCategories", id));
    setCategories(prev => prev.filter(c => c.id !== id));
  }, [isDemoUser]);

  // --- Accounts ---
  const addAccount = useCallback(async (account: Omit<AccountInfo, "id">) => {
    if (isDemoUser) return;
    const id = `acc-${Date.now()}`;
    const newAcc = { ...account, id };
    await setDoc(doc(db, "accounts", id), newAcc);
    setAccounts(prev => [...prev, newAcc]);
  }, [isDemoUser]);

  const updateAccount = useCallback(async (id: string, updates: Partial<AccountInfo>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "accounts", id), updates);
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, [isDemoUser]);

  const deleteAccount = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "accounts", id));
    setAccounts(prev => prev.filter(a => a.id !== id));
  }, [isDemoUser]);

  // --- Instagram Accounts ---
  const addInstaAccount = useCallback(async (account: Omit<InstagramAccount, "id">) => {
    if (isDemoUser) return;
    const id = `insta-${Date.now()}`;
    const newAcc = JSON.parse(JSON.stringify({ ...account, id }));
    await setDoc(doc(db, "instaAccounts", id), newAcc);
    setInstaAccounts(prev => [...prev, newAcc]);
  }, [isDemoUser]);

  const updateInstaAccount = useCallback(async (id: string, updates: Partial<InstagramAccount>) => {
    if (isDemoUser) return;
    const cleaned = JSON.parse(JSON.stringify(updates));
    await updateDoc(doc(db, "instaAccounts", id), cleaned);
    setInstaAccounts(prev => prev.map(a => a.id === id ? { ...a, ...cleaned } : a));
  }, [isDemoUser]);

  const deleteInstaAccount = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "instaAccounts", id));
    setInstaAccounts(prev => prev.filter(a => a.id !== id));
  }, [isDemoUser]);

  // --- Announcements ---
  const addAnnouncement = useCallback(async (announcement: Omit<Announcement, "id">) => {
    if (isDemoUser) return;
    const id = `ann-${Date.now()}`;
    const newAnn = { ...announcement, id };
    await setDoc(doc(db, "announcements", id), newAnn);
    setAnnouncements(prev => [...prev, newAnn]);
  }, [isDemoUser]);

  const updateAnnouncement = useCallback(async (id: string, updates: Partial<Announcement>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "announcements", id), updates);
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, [isDemoUser]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "announcements", id));
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }, [isDemoUser]);

  // --- Announcement Categories ---
  const addAnnouncementCategory = useCallback(async (category: Omit<AnnouncementCategory, "id">) => {
    if (isDemoUser) return;
    const id = `anncat-${Date.now()}`;
    const newCat = { ...category, id };
    await setDoc(doc(db, "announcementCategories", id), newCat);
    setAnnouncementCategories(prev => [...prev, newCat]);
  }, [isDemoUser]);

  const updateAnnouncementCategory = useCallback(async (id: string, updates: Partial<AnnouncementCategory>) => {
    if (isDemoUser) return;
    await updateDoc(doc(db, "announcementCategories", id), updates);
    setAnnouncementCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [isDemoUser]);

  const deleteAnnouncementCategory = useCallback(async (id: string) => {
    if (isDemoUser) return;
    await deleteDoc(doc(db, "announcementCategories", id));
    setAnnouncementCategories(prev => prev.filter(c => c.id !== id));
  }, [isDemoUser]);

  return (
    <DataContext.Provider value={{
      links, categories, accounts, instaAccounts, announcements, announcementCategories,
      addLink, updateLink, deleteLink,
      addCategory, updateCategory, deleteCategory,
      addAccount, updateAccount, deleteAccount,
      addInstaAccount, updateInstaAccount, deleteInstaAccount,
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

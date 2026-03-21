"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { LinkItem, LinkCategory, AccountInfo, Announcement } from "@/types";

interface DataContextType {
  links: LinkItem[];
  categories: LinkCategory[];
  accounts: AccountInfo[];
  announcements: Announcement[];
  addLink: (link: Omit<LinkItem, "id" | "createdAt" | "updatedAt">) => void;
  updateLink: (id: string, link: Partial<LinkItem>) => void;
  deleteLink: (id: string) => void;
  addCategory: (category: Omit<LinkCategory, "id">) => void;
  updateCategory: (id: string, category: Partial<LinkCategory>) => void;
  deleteCategory: (id: string) => void;
  addAccount: (account: Omit<AccountInfo, "id">) => void;
  updateAccount: (id: string, account: Partial<AccountInfo>) => void;
  deleteAccount: (id: string) => void;
  addAnnouncement: (announcement: Omit<Announcement, "id">) => void;
  updateAnnouncement: (id: string, announcement: Partial<Announcement>) => void;
  deleteAnnouncement: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_CATEGORIES: LinkCategory[] = [
  { id: "cat-1", name: "全体", order: 1, description: "支部全体で使うツール・ドライブ" },
  { id: "cat-2", name: "コンシューマー", order: 2, description: "学生集客・管理関連" },
  { id: "cat-3", name: "クライアント", order: 3, description: "議員管理・営業関連" },
  { id: "cat-4", name: "プログラム", order: 4, description: "部署運営・ヒアリング関連" },
  { id: "cat-5", name: "一次選考会関連", order: 5, description: "一次選考会の運営資料" },
  { id: "cat-6", name: "二次選考会関連", order: 6, description: "二次選考会の運営資料" },
  { id: "cat-7", name: "フォロー・未来自治体関連", order: 7, description: "フォロー業務・未来自治体" },
  { id: "cat-8", name: "事務局", order: 8, description: "経費・予算・会場予約" },
  { id: "cat-9", name: "イベント関連", order: 9, description: "各種イベント管理" },
];

const DEFAULT_LINKS: LinkItem[] = [
  // 全体
  { id: "l-01", title: "SalesForce", url: "https://login.salesforce.com", description: "顧客管理システム", category: "cat-1", icon: "website", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-02", title: "クラウドサイン", url: "https://www.cloudsign.jp", description: "電子契約サービス", category: "cat-1", icon: "website", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-03", title: "支部ドライブ", url: "https://drive.google.com", description: "支部共有ドライブ", category: "cat-1", icon: "folder", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-04", title: "全社共有用ドライブ", url: "https://drive.google.com", description: "全社共有ドライブ", category: "cat-1", icon: "folder", order: 4, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-05", title: "タスク進捗", url: "https://docs.google.com/spreadsheets/", description: "タスク進捗管理シート", category: "cat-1", icon: "spreadsheet", order: 5, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-06", title: "シフト表兼スケジュール管理シート", url: "https://docs.google.com/spreadsheets/", description: "シフト・スケジュール管理", category: "cat-1", icon: "spreadsheet", order: 6, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-07", title: "G3支部フロー", url: "https://docs.google.com/document/", description: "支部業務フロー", category: "cat-1", icon: "document", order: 7, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-08", title: "事務所決定メール_テンプレ", url: "https://docs.google.com/document/", description: "事務所決定通知メールテンプレート", category: "cat-1", icon: "document", order: 8, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-09", title: "各支部SFパスワード一覧", url: "https://docs.google.com/spreadsheets/", description: "SalesForceパスワード一覧", category: "cat-1", icon: "spreadsheet", order: 9, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // コンシューマー
  { id: "l-10", title: "学生集客・業務管理書08_東京３", url: "https://docs.google.com/spreadsheets/", description: "学生集客と業務管理", category: "cat-2", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-11", title: "学生集客管理表", url: "https://docs.google.com/spreadsheets/", description: "学生集客の進捗管理", category: "cat-2", icon: "spreadsheet", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-12", title: "KGI・KPIマスター", url: "https://docs.google.com/spreadsheets/", description: "目標指標管理", category: "cat-2", icon: "spreadsheet", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-13", title: "【原本】学生管理シート", url: "https://docs.google.com/spreadsheets/", description: "学生情報管理テンプレート", category: "cat-2", icon: "spreadsheet", order: 4, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-14", title: "東京23区外・山梨の大学一覧", url: "https://docs.google.com/spreadsheets/", description: "対象大学リスト", category: "cat-2", icon: "spreadsheet", order: 5, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-15", title: "授業告知リスト", url: "https://docs.google.com/spreadsheets/", description: "授業告知の管理", category: "cat-2", icon: "spreadsheet", order: 6, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // クライアント
  { id: "l-16", title: "議員管理表", url: "https://docs.google.com/spreadsheets/", description: "受入議員の情報管理", category: "cat-3", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-17", title: "新規復活営業リスト", url: "https://docs.google.com/spreadsheets/", description: "新規・復活営業先リスト", category: "cat-3", icon: "spreadsheet", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-18", title: "55→56 最終訪問管理シート", url: "https://docs.google.com/spreadsheets/", description: "期間引き継ぎ訪問管理", category: "cat-3", icon: "spreadsheet", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-19", title: "企画書兼訪問シート＆議員カンペ", url: "https://docs.google.com/document/", description: "訪問用企画書・カンペ", category: "cat-3", icon: "document", order: 4, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-20", title: "【56】【原本】議員パンフレット", url: "https://docs.google.com/presentation/", description: "56期議員パンフレット", category: "cat-3", icon: "slide", order: 5, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-21", title: "【スタッフ向け】議員紹介スライド", url: "https://docs.google.com/presentation/", description: "スタッフ向け議員紹介", category: "cat-3", icon: "slide", order: 6, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-22", title: "アポ取りマニュアル", url: "https://docs.google.com/document/", description: "アポイント取得手順書", category: "cat-3", icon: "document", order: 7, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-23", title: "【55】【原本】議員パンフレット", url: "https://docs.google.com/presentation/", description: "55期議員パンフレット", category: "cat-3", icon: "slide", order: 8, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-24", title: "選挙の際の取扱いマニュアル", url: "https://docs.google.com/document/", description: "選挙時の対応マニュアル", category: "cat-3", icon: "document", order: 9, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // プログラム
  { id: "l-25", title: "部署運営シート", url: "https://docs.google.com/spreadsheets/", description: "部署の運営管理", category: "cat-4", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-26", title: "【原本】ヒアリングシート（学生管理シート）", url: "https://docs.google.com/spreadsheets/", description: "学生ヒアリング用テンプレート", category: "cat-4", icon: "spreadsheet", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-27", title: "ヒアリングスライド", url: "https://docs.google.com/presentation/", description: "ヒアリング用プレゼン資料", category: "cat-4", icon: "slide", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // 一次選考会関連
  { id: "l-28", title: "一次選考会WBS", url: "https://docs.google.com/spreadsheets/", description: "一次選考会のWBS", category: "cat-5", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-29", title: "一次選考会フロー", url: "https://docs.google.com/document/", description: "一次選考会の業務フロー", category: "cat-5", icon: "document", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-30", title: "一次選考会関連ドライブ", url: "https://drive.google.com", description: "一次選考会資料格納", category: "cat-5", icon: "folder", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-31", title: "一次選考会パンフ格納ドライブ", url: "https://drive.google.com", description: "パンフレット格納", category: "cat-5", icon: "folder", order: 4, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-32", title: "一次選考会面接シート格納ドライブ", url: "https://drive.google.com", description: "面接シート格納", category: "cat-5", icon: "folder", order: 5, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-33", title: "一次選考会RPチェックシート", url: "https://docs.google.com/spreadsheets/", description: "RPチェック用シート", category: "cat-5", icon: "spreadsheet", order: 6, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-34", title: "【G3】一次選考会シフト表（支部開催＆合同）", url: "https://docs.google.com/spreadsheets/", description: "選考会シフト管理", category: "cat-5", icon: "spreadsheet", order: 7, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // 二次選考会関連
  { id: "l-35", title: "二次選考会業務管理表", url: "https://docs.google.com/spreadsheets/", description: "二次選考会の業務管理", category: "cat-6", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-36", title: "二次選考会フロー", url: "https://docs.google.com/document/", description: "二次選考会の業務フロー", category: "cat-6", icon: "document", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-37", title: "二次選考会前事前打ち合わせスライド", url: "https://docs.google.com/presentation/", description: "事前打ち合わせ用スライド", category: "cat-6", icon: "slide", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // フォロー・未来自治体関連
  { id: "l-38", title: "フォロー管理シート", url: "https://docs.google.com/spreadsheets/", description: "フォロー業務の管理", category: "cat-7", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-39", title: "未来自治体業務管理表", url: "https://docs.google.com/spreadsheets/", description: "未来自治体の業務管理", category: "cat-7", icon: "spreadsheet", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-40", title: "未来指示書", url: "https://docs.google.com/document/", description: "未来自治体への指示書", category: "cat-7", icon: "document", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-41", title: "56→57 訪問管理シート", url: "https://docs.google.com/spreadsheets/", description: "次期への訪問管理引き継ぎ", category: "cat-7", icon: "spreadsheet", order: 4, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-42", title: "未来自治体テキストブック", url: "https://docs.google.com/document/", description: "未来自治体テキスト", category: "cat-7", icon: "document", order: 5, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // 事務局
  { id: "l-43", title: "経費発生報告", url: "https://docs.google.com/forms/", description: "経費報告フォーム", category: "cat-8", icon: "form", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-44", title: "渋谷区会場予約サイト", url: "https://www.city.shibuya.tokyo.jp", description: "会場予約", category: "cat-8", icon: "website", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-45", title: "予算管理表", url: "https://docs.google.com/spreadsheets/", description: "支部予算の管理", category: "cat-8", icon: "spreadsheet", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },

  // イベント関連
  { id: "l-46", title: "【フォロイベ】出欠確認シート", url: "https://docs.google.com/spreadsheets/", description: "フォローイベント出欠管理", category: "cat-9", icon: "spreadsheet", order: 1, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-47", title: "超イベ責シート＠キックオフ", url: "https://docs.google.com/spreadsheets/", description: "キックオフイベント管理", category: "cat-9", icon: "spreadsheet", order: 2, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
  { id: "l-48", title: "超イベ責シート＠ハーフ", url: "https://docs.google.com/spreadsheets/", description: "ハーフタイムイベント管理", category: "cat-9", icon: "spreadsheet", order: 3, createdAt: "2025-04-01", updatedAt: "2025-04-01" },
];

const DEFAULT_ACCOUNTS: AccountInfo[] = [
  { id: "acc-1", serviceName: "Sales Force", loginId: "kanto3@dot-jp.or.jp", password: "puzzlenokutatu100", url: "https://login.salesforce.com", order: 1 },
  { id: "acc-2", serviceName: "クラウドサイン", loginId: "kanto3@dot-jp.or.jp", password: "Kanto#51st63", url: "https://www.cloudsign.jp", order: 2 },
  { id: "acc-3", serviceName: "支部メールアカウント (Gmail)", loginId: "kanto3@dot-jp.or.jp", password: "ChBVf20*YnBhL236", url: "https://mail.google.com", order: 3 },
  { id: "acc-4", serviceName: "支部Zoom", loginId: "kanto3@dot-jp.or.jp", password: "shutoken6352", url: "https://zoom.us/signin", order: 4 },
];

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  { id: "ann-1", title: "支部ポータルサイト「Lueur」がリニューアルしました", content: "Google Siteから新しいポータルに移行しました。業務リンクやアカウント情報はこのポータルから確認できます。", date: "2026-03-19", pinned: true },
  { id: "ann-2", title: "Discord進捗提出を忘れずに", content: "日々の進捗はDiscordで提出してください。", date: "2026-03-15", pinned: false },
];

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch { return defaultValue; }
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<LinkCategory[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    setLinks(loadFromStorage("portal_links", DEFAULT_LINKS));
    setCategories(loadFromStorage("portal_categories", DEFAULT_CATEGORIES));
    setAccounts(loadFromStorage("portal_accounts", DEFAULT_ACCOUNTS));
    setAnnouncements(loadFromStorage("portal_announcements", DEFAULT_ANNOUNCEMENTS));
  }, []);

  const currentAnnouncements = announcements.length > 0 ? announcements : DEFAULT_ANNOUNCEMENTS;

  const addLink = useCallback((link: Omit<LinkItem, "id" | "createdAt" | "updatedAt">) => {
    setLinks(prev => {
      const now = new Date().toISOString();
      const newLinks = [...prev, { ...link, id: crypto.randomUUID(), createdAt: now, updatedAt: now }];
      saveToStorage("portal_links", newLinks);
      return newLinks;
    });
  }, []);

  const updateLink = useCallback((id: string, updates: Partial<LinkItem>) => {
    setLinks(prev => {
      const newLinks = prev.map(l => l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l);
      saveToStorage("portal_links", newLinks);
      return newLinks;
    });
  }, []);

  const deleteLink = useCallback((id: string) => {
    setLinks(prev => {
      const newLinks = prev.filter(l => l.id !== id);
      saveToStorage("portal_links", newLinks);
      return newLinks;
    });
  }, []);

  const addCategory = useCallback((category: Omit<LinkCategory, "id">) => {
    setCategories(prev => {
      const newCats = [...prev, { ...category, id: crypto.randomUUID() }];
      saveToStorage("portal_categories", newCats);
      return newCats;
    });
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<LinkCategory>) => {
    setCategories(prev => {
      const newCats = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      saveToStorage("portal_categories", newCats);
      return newCats;
    });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => {
      const newCats = prev.filter(c => c.id !== id);
      saveToStorage("portal_categories", newCats);
      return newCats;
    });
  }, []);

  const addAccount = useCallback((account: Omit<AccountInfo, "id">) => {
    setAccounts(prev => {
      const newAccs = [...prev, { ...account, id: crypto.randomUUID() }];
      saveToStorage("portal_accounts", newAccs);
      return newAccs;
    });
  }, []);

  const updateAccount = useCallback((id: string, updates: Partial<AccountInfo>) => {
    setAccounts(prev => {
      const newAccs = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      saveToStorage("portal_accounts", newAccs);
      return newAccs;
    });
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setAccounts(prev => {
      const newAccs = prev.filter(a => a.id !== id);
      saveToStorage("portal_accounts", newAccs);
      return newAccs;
    });
  }, []);

  const addAnnouncement = useCallback((announcement: Omit<Announcement, "id">) => {
    setAnnouncements(prev => {
      const newAnns = [...prev, { ...announcement, id: crypto.randomUUID() }];
      saveToStorage("portal_announcements", newAnns);
      return newAnns;
    });
  }, []);

  const updateAnnouncement = useCallback((id: string, updates: Partial<Announcement>) => {
    setAnnouncements(prev => {
      const newAnns = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      saveToStorage("portal_announcements", newAnns);
      return newAnns;
    });
  }, []);

  const deleteAnnouncement = useCallback((id: string) => {
    setAnnouncements(prev => {
      const newAnns = prev.filter(a => a.id !== id);
      saveToStorage("portal_announcements", newAnns);
      return newAnns;
    });
  }, []);

  return (
    <DataContext.Provider value={{
      links, categories, accounts, announcements: currentAnnouncements,
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

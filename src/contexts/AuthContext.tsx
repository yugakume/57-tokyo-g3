"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// =============================================
// 連携済みGoogleカレンダーアカウント
// ※ 将来: Cloud Functions (functions/src/index.ts) でトークンを永続化予定
//    Blaze プランへのアップグレード後に有効化する
// =============================================
export interface CalendarAccount {
  googleEmail: string;
  accessToken: string;
  expiresAt: number;  // Unix ms。約1時間で期限切れ
}

const CALENDAR_ACCOUNTS_KEY = "portal_calendar_accounts";

export interface GmailToken {
  accessToken: string;
  expiresAt: number; // Unix ms
}
const GMAIL_TOKEN_KEY = 'portal_gmail_token';

// =============================================
// 設定
// =============================================
const ALLOWED_DOMAIN = "dot-jp.or.jp";

// Google Cloud Console で取得した OAuth クライアントID をここに設定
export const GOOGLE_CLIENT_ID = "346842421426-kthmpbq2kndbahrh197i7bhldcab9uql.apps.googleusercontent.com";

// デモモードフラグ（本番デプロイ時は false にする）
const DEMO_MODE = false;

const DEFAULT_ADMIN_EMAILS = ["yuga_kume@dot-jp.or.jp"];

// =============================================
// AuthContext
// =============================================
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: () => void;
  loginWithEmail: (email: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isDemoMode: boolean;
  // 管理者用：許可メール管理
  allowedEmails: string[];
  adminEmails: string[];
  addAllowedEmail: (email: string) => void;
  removeAllowedEmail: (email: string) => void;
  addAdminEmail: (email: string) => void;
  removeAdminEmail: (email: string) => void;
  // Googleカレンダー連携（複数アカウント・永続）
  calendarAccounts: CalendarAccount[];
  calendarAccessToken: string | null;  // 後方互換: 1つ目のトークン
  requestCalendarAccess: () => void;    // アカウント追加
  removeCalendarAccount: (googleEmail: string) => void;
  // Gmail送信連携
  gmailToken: GmailToken | null;
  requestGmailAccess: () => void;
  removeGmailToken: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google JWT デコード（ライブラリ不要）
function decodeJwt(token: string): Record<string, unknown> {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
  );
  return JSON.parse(jsonPayload);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [calendarAccounts, setCalendarAccounts] = useState<CalendarAccount[]>([]);
  const [gmailToken, setGmailToken] = useState<GmailToken | null>(null);

  // 後方互換：1つ目のアカウントのトークンを返す
  const calendarAccessToken = calendarAccounts[0]?.accessToken ?? null;

  // localStorageから有効なアカウントを復元（起動時）
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CALENDAR_ACCOUNTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CalendarAccount[];
        const now = Date.now();
        const valid = parsed.filter(a => a.expiresAt > now);
        if (valid.length > 0) setCalendarAccounts(valid);
        if (valid.length !== parsed.length) {
          localStorage.setItem(CALENDAR_ACCOUNTS_KEY, JSON.stringify(valid));
        }
      }
      // Gmail token restore
      const storedGmail = localStorage.getItem(GMAIL_TOKEN_KEY);
      if (storedGmail) {
        const parsedGmail = JSON.parse(storedGmail) as GmailToken;
        if (parsedGmail.expiresAt > Date.now()) setGmailToken(parsedGmail);
        else localStorage.removeItem(GMAIL_TOKEN_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  // 初期化: Firestoreから許可メール・管理者メールをリアルタイム購読
  useEffect(() => {
    // Firestoreから許可メールリストを購読してからユーザーを復元
    let loadedAllowed: string[] = [];
    let loadedAdmin: string[] = [];
    let allowedReady = false;
    let adminReady = false;

    // localStorage キャッシュ（10分TTL）でFirestoreリードを節約
    const SETTINGS_TTL = 10 * 60 * 1000;
    function loadSettingsCache(key: string): string[] | null {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw) as { data: string[]; ts: number };
        return Date.now() - ts < SETTINGS_TTL ? data : null;
      } catch { return null; }
    }
    function saveSettingsCache(key: string, data: string[]) {
      try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
    }

    async function loadSettings() {
      // キャッシュ確認
      const cachedAllowed = loadSettingsCache("portal_settings_allowedEmails");
      const cachedAdmin   = loadSettingsCache("portal_settings_adminEmails");

      if (cachedAllowed && cachedAdmin) {
        loadedAllowed = cachedAllowed;
        loadedAdmin   = cachedAdmin;
        setAllowedEmails(cachedAllowed);
        setAdminEmails(cachedAdmin);
      } else {
        // Firestoreから一回読み込み
        const [allowedSnap, adminSnap] = await Promise.all([
          getDoc(doc(db, "settings", "allowedEmails")),
          getDoc(doc(db, "settings", "adminEmails")),
        ]);

        if (allowedSnap.exists()) {
          loadedAllowed = allowedSnap.data().emails ?? [];
        } else {
          await setDoc(doc(db, "settings", "allowedEmails"), { emails: DEFAULT_ADMIN_EMAILS });
          loadedAllowed = DEFAULT_ADMIN_EMAILS;
        }
        setAllowedEmails(loadedAllowed);
        saveSettingsCache("portal_settings_allowedEmails", loadedAllowed);

        if (adminSnap.exists()) {
          loadedAdmin = adminSnap.data().emails ?? [];
        } else {
          await setDoc(doc(db, "settings", "adminEmails"), { emails: DEFAULT_ADMIN_EMAILS });
          loadedAdmin = DEFAULT_ADMIN_EMAILS;
        }
        setAdminEmails(loadedAdmin);
        saveSettingsCache("portal_settings_adminEmails", loadedAdmin);
      }

      // localStorageからユーザー復元（許可チェック付き）
      const stored = localStorage.getItem("portal_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const email = parsed.email;
          const domain = email?.split("@")[1];
          if (domain === ALLOWED_DOMAIN && (loadedAllowed.includes(email) || loadedAdmin.includes(email))) {
            parsed.role = loadedAdmin.includes(email) ? "admin" : "member";
            setUser(parsed);
            localStorage.setItem("portal_user", JSON.stringify(parsed));
          } else {
            localStorage.removeItem("portal_user");
          }
        } catch {
          localStorage.removeItem("portal_user");
        }
      }
      setIsLoading(false);
    }

    loadSettings().catch(() => setIsLoading(false));

    return () => { /* no subscriptions to clean up */ };
  }, []);

  // Google Identity Services スクリプト読み込み
  useEffect(() => {
    if ((GOOGLE_CLIENT_ID as string) === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") return;
    if (document.getElementById("gsi-script")) return;

    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // ユーザー認証処理（共通）
  const authenticateUser = useCallback((email: string, displayName: string, photoURL?: string, uid?: string) => {
    const domain = email.split("@")[1];
    if (domain !== ALLOWED_DOMAIN) {
      alert(`@${ALLOWED_DOMAIN} ドメインのアカウントでのみログインできます。`);
      return false;
    }

    // 許可メールアドレスチェック（管理者は常に許可）
    if (!allowedEmails.includes(email) && !adminEmails.includes(email)) {
      alert("このメールアドレスはまだ許可されていません。\n管理者に連絡してください。");
      return false;
    }

    const role = adminEmails.includes(email) ? "admin" : "member";

    const newUser: User = {
      uid: uid ?? crypto.randomUUID(),
      email,
      displayName,
      photoURL,
      role,
    };
    setUser(newUser);
    localStorage.setItem("portal_user", JSON.stringify(newUser));
    return true;
  }, [allowedEmails, adminEmails]);

  // Google OAuth ログイン
  const loginWithGoogle = useCallback(() => {
    if ((GOOGLE_CLIENT_ID as string) === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
      alert(
        "Google OAuth が未設定です。\n\n" +
        "AuthContext.tsx の GOOGLE_CLIENT_ID に\n" +
        "Google Cloud Console で取得した OAuth クライアントID を設定してください。\n\n" +
        "開発中はデモモードのメールアドレス入力でログインできます。"
      );
      return;
    }

    const google = (window as unknown as { google: { accounts: { id: { initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void; prompt: () => void } } } }).google;
    if (!google?.accounts?.id) {
      alert("Google Sign-In の読み込みに失敗しました。ページを再読み込みしてください。");
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        try {
          const payload = decodeJwt(response.credential);
          const email = payload.email as string;
          const name = payload.name as string || email.split("@")[0];
          const picture = payload.picture as string | undefined;
          const sub = payload.sub as string;

          // hd (hosted domain) チェック
          const hd = payload.hd as string | undefined;
          if (hd !== ALLOWED_DOMAIN) {
            alert(`@${ALLOWED_DOMAIN} ドメインのアカウントでのみログインできます。`);
            return;
          }

          authenticateUser(email, name, picture, sub);
        } catch {
          alert("ログインに失敗しました。もう一度お試しください。");
        }
      },
      auto_select: false,
    });

    google.accounts.id.prompt();
  }, [authenticateUser]);

  // メールアドレスでのデモログイン
  const loginWithEmail = useCallback((email: string) => {
    if (!DEMO_MODE) {
      alert("デモモードが無効です。Googleアカウントでログインしてください。");
      return;
    }
    const domain = email.split("@")[1];
    if (domain !== ALLOWED_DOMAIN) {
      alert(`@${ALLOWED_DOMAIN} ドメインのアカウントでのみログインできます。`);
      return;
    }
    // デモモードでは常にmember権限（管理者パネルにアクセス不可）
    // メールアドレスは固定のデモ用アドレスを使用（入力値は使わない）
    const newUser: User = {
      uid: crypto.randomUUID(),
      email: "demo@dot-jp.or.jp",
      displayName: "デモユーザー",
      role: "member",
      isDemoUser: true,
    };
    setUser(newUser);
    localStorage.setItem("portal_user", JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("portal_user");
  }, []);

  // 管理者用：許可メール管理（Firestore保存）
  // ※ 書き込み時にキャッシュも更新してリードを節約
  const addAllowedEmail = useCallback(async (email: string) => {
    const next = [...allowedEmails, email].filter((v, i, a) => a.indexOf(v) === i);
    setAllowedEmails(next);
    await setDoc(doc(db, "settings", "allowedEmails"), { emails: next });
    try { localStorage.setItem("portal_settings_allowedEmails", JSON.stringify({ data: next, ts: Date.now() })); } catch { /* ignore */ }
  }, [allowedEmails]);

  const removeAllowedEmail = useCallback(async (email: string) => {
    const next = allowedEmails.filter(e => e !== email);
    setAllowedEmails(next);
    await setDoc(doc(db, "settings", "allowedEmails"), { emails: next });
    try { localStorage.setItem("portal_settings_allowedEmails", JSON.stringify({ data: next, ts: Date.now() })); } catch { /* ignore */ }
  }, [allowedEmails]);

  const addAdminEmail = useCallback(async (email: string) => {
    const next = [...adminEmails, email].filter((v, i, a) => a.indexOf(v) === i);
    setAdminEmails(next);
    await setDoc(doc(db, "settings", "adminEmails"), { emails: next });
    try { localStorage.setItem("portal_settings_adminEmails", JSON.stringify({ data: next, ts: Date.now() })); } catch { /* ignore */ }
  }, [adminEmails]);

  const removeAdminEmail = useCallback(async (email: string) => {
    if (adminEmails.length <= 1) {
      alert("管理者は最低1人必要です。");
      return;
    }
    const next = adminEmails.filter(e => e !== email);
    setAdminEmails(next);
    await setDoc(doc(db, "settings", "adminEmails"), { emails: next });
    try { localStorage.setItem("portal_settings_adminEmails", JSON.stringify({ data: next, ts: Date.now() })); } catch { /* ignore */ }
  }, [adminEmails]);

  // =============================================
  // Googleカレンダー連携（複数アカウント・セッション内保持）
  // ※ 将来: Blaze プラン + Cloud Functions (functions/src/index.ts) で永続化予定
  // =============================================

  // アカウント追加（implicit flow → access_token + userinfo で email 取得）
  const requestCalendarAccess = useCallback(() => {
    if (typeof window === 'undefined') return;
    const g = (window as unknown as Record<string, unknown>).google as
      | { accounts: { oauth2: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: () => void } } } }
      | undefined;
    if (!g?.accounts?.oauth2?.initTokenClient) {
      alert("Google Identity Services の読み込みに失敗しました。ページを再読み込みしてください。");
      return;
    }

    const tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: async (response: Record<string, unknown>) => {
        const accessToken = response.access_token as string | undefined;
        if (!accessToken) return;
        // アクセストークンからGoogleメールを取得
        try {
          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const userInfo = await userInfoRes.json() as { email?: string };
          const googleEmail = userInfo.email ?? "unknown";
          const expiresAt = Date.now() + 3540 * 1000; // 59分

          setCalendarAccounts(prev => {
            const next = prev.find(a => a.googleEmail === googleEmail)
              ? prev.map(a => a.googleEmail === googleEmail ? { ...a, accessToken, expiresAt } : a)
              : [...prev, { googleEmail, accessToken, expiresAt }];
            localStorage.setItem(CALENDAR_ACCOUNTS_KEY, JSON.stringify(next));
            return next;
          });
        } catch {
          // メール取得失敗時はメールなしで追加
          const expiresAt = Date.now() + 3540 * 1000;
          setCalendarAccounts(prev => {
            const next = [...prev, { googleEmail: "unknown", accessToken, expiresAt }];
            localStorage.setItem(CALENDAR_ACCOUNTS_KEY, JSON.stringify(next));
            return next;
          });
        }
      },
    });
    tokenClient.requestAccessToken();
  }, []);

  const requestGmailAccess = useCallback(() => {
    if (typeof window === 'undefined') return;
    const g = (window as unknown as Record<string, unknown>).google as
      | { accounts: { oauth2: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: () => void } } } }
      | undefined;
    if (!g?.accounts?.oauth2?.initTokenClient) {
      alert('Google Identity Services の読み込みに失敗しました。ページを再読み込みしてください。');
      return;
    }
    const tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      callback: (response: Record<string, unknown>) => {
        const accessToken = response.access_token as string | undefined;
        if (!accessToken) return;
        const token: GmailToken = { accessToken, expiresAt: Date.now() + 3540 * 1000 };
        setGmailToken(token);
        try { localStorage.setItem(GMAIL_TOKEN_KEY, JSON.stringify(token)); } catch { /* ignore */ }
      },
    });
    tokenClient.requestAccessToken();
  }, []);

  const removeGmailToken = useCallback(() => {
    setGmailToken(null);
    localStorage.removeItem(GMAIL_TOKEN_KEY);
  }, []);

  // アカウント削除
  const removeCalendarAccount = useCallback((googleEmail: string) => {
    setCalendarAccounts(prev => {
      const next = prev.filter(a => a.googleEmail !== googleEmail);
      localStorage.setItem(CALENDAR_ACCOUNTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{
      user, isLoading, loginWithGoogle, loginWithEmail, logout, isAdmin,
      isDemoMode: DEMO_MODE,
      allowedEmails, adminEmails,
      addAllowedEmail, removeAllowedEmail, addAdminEmail, removeAdminEmail,
      calendarAccounts, calendarAccessToken, requestCalendarAccess, removeCalendarAccount,
      gmailToken, requestGmailAccess, removeGmailToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

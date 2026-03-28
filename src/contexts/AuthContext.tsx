"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { User } from "@/types";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// =============================================
// 設定
// =============================================
const ALLOWED_DOMAIN = "dot-jp.or.jp";

// Google Cloud Console で取得した OAuth クライアントID をここに設定
export const GOOGLE_CLIENT_ID = "346842421426-kthmpbq2kndbahrh197i7bhldcab9uql.apps.googleusercontent.com";

// デモモードフラグ（本番デプロイ時は false にする）
const DEMO_MODE = true;

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
  // Googleカレンダー連携
  calendarAccessToken: string | null;
  requestCalendarAccess: () => void;
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
  const [calendarAccessToken, setCalendarAccessToken] = useState<string | null>(null);

  // 初期化: Firestoreから許可メール・管理者メールをリアルタイム購読
  useEffect(() => {
    // Firestoreから許可メールリストを購読してからユーザーを復元
    let loadedAllowed: string[] = [];
    let loadedAdmin: string[] = [];
    let allowedReady = false;
    let adminReady = false;

    const checkAndRestoreUser = () => {
      if (!allowedReady || !adminReady) return;
      // localStorageからユーザー復元（許可チェック付き）
      const stored = localStorage.getItem("portal_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const email = parsed.email;
          const domain = email?.split("@")[1];
          // ドメインチェック + 許可メールチェック
          if (domain === ALLOWED_DOMAIN && (loadedAllowed.includes(email) || loadedAdmin.includes(email))) {
            // 管理者権限を最新に更新
            parsed.role = loadedAdmin.includes(email) ? "admin" : "member";
            setUser(parsed);
            localStorage.setItem("portal_user", JSON.stringify(parsed));
          } else {
            // 許可されていないユーザーはログアウト
            localStorage.removeItem("portal_user");
          }
        } catch {
          localStorage.removeItem("portal_user");
        }
      }
      setIsLoading(false);
    };

    const unsubAllowed = onSnapshot(doc(db, "settings", "allowedEmails"), (snap) => {
      if (snap.exists()) {
        loadedAllowed = snap.data().emails ?? [];
        setAllowedEmails(loadedAllowed);
      } else {
        setDoc(doc(db, "settings", "allowedEmails"), { emails: DEFAULT_ADMIN_EMAILS });
        loadedAllowed = DEFAULT_ADMIN_EMAILS;
        setAllowedEmails(DEFAULT_ADMIN_EMAILS);
      }
      allowedReady = true;
      checkAndRestoreUser();
    });

    const unsubAdmin = onSnapshot(doc(db, "settings", "adminEmails"), (snap) => {
      if (snap.exists()) {
        loadedAdmin = snap.data().emails ?? [];
        setAdminEmails(loadedAdmin);
      } else {
        setDoc(doc(db, "settings", "adminEmails"), { emails: DEFAULT_ADMIN_EMAILS });
        loadedAdmin = DEFAULT_ADMIN_EMAILS;
        setAdminEmails(DEFAULT_ADMIN_EMAILS);
      }
      adminReady = true;
      checkAndRestoreUser();
    });

    return () => { unsubAllowed(); unsubAdmin(); };
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
  const addAllowedEmail = useCallback(async (email: string) => {
    const next = [...allowedEmails, email].filter((v, i, a) => a.indexOf(v) === i);
    await setDoc(doc(db, "settings", "allowedEmails"), { emails: next });
  }, [allowedEmails]);

  const removeAllowedEmail = useCallback(async (email: string) => {
    const next = allowedEmails.filter(e => e !== email);
    await setDoc(doc(db, "settings", "allowedEmails"), { emails: next });
  }, [allowedEmails]);

  const addAdminEmail = useCallback(async (email: string) => {
    const next = [...adminEmails, email].filter((v, i, a) => a.indexOf(v) === i);
    await setDoc(doc(db, "settings", "adminEmails"), { emails: next });
  }, [adminEmails]);

  const removeAdminEmail = useCallback(async (email: string) => {
    if (adminEmails.length <= 1) {
      alert("管理者は最低1人必要です。");
      return;
    }
    const next = adminEmails.filter(e => e !== email);
    await setDoc(doc(db, "settings", "adminEmails"), { emails: next });
  }, [adminEmails]);

  // Googleカレンダー APIへのアクセストークンを取得する関数
  const requestCalendarAccess = useCallback(() => {
    if (typeof window === 'undefined') return;
    const g = (window as unknown as Record<string, unknown>).google as
      | { accounts: { oauth2: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: () => void } } } }
      | undefined;
    if (!g?.accounts?.oauth2) {
      alert("Google Identity Services の読み込みに失敗しました。ページを再読み込みしてください。");
      return;
    }

    const tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (response: Record<string, unknown>) => {
        if (response.access_token) {
          setCalendarAccessToken(response.access_token as string);
        }
      },
    });
    tokenClient.requestAccessToken();
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{
      user, isLoading, loginWithGoogle, loginWithEmail, logout, isAdmin,
      isDemoMode: DEMO_MODE,
      allowedEmails, adminEmails,
      addAllowedEmail, removeAllowedEmail, addAdminEmail, removeAdminEmail,
      calendarAccessToken, requestCalendarAccess,
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

"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { User } from "@/types";

// =============================================
// 設定
// =============================================
const ALLOWED_DOMAIN = "dot-jp.or.jp";

// Google Cloud Console で取得した OAuth クライアントID をここに設定
// 手順: https://console.cloud.google.com → APIとサービス → 認証情報 → OAuth 2.0 クライアントID
// 承認済みの JavaScript 生成元にデプロイ先のドメインを追加すること
export const GOOGLE_CLIENT_ID = "346842421426-kthmpbq2kndbahrh197i7bhldcab9uql.apps.googleusercontent.com";

// デモモードフラグ（本番デプロイ時は false にする）
// true の場合: メールアドレス入力でのデモログインが有効
// false の場合: Google OAuth のみ有効
const DEMO_MODE = true;

// =============================================
// 許可メールアドレス管理
// =============================================
const STORAGE_KEY_ALLOWED_EMAILS = "portal_allowed_emails";
const STORAGE_KEY_ADMIN_EMAILS = "portal_admin_emails";

const DEFAULT_ADMIN_EMAILS = ["yuga_kume@dot-jp.or.jp"];

function getStoredEmails(key: string, defaults: string[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return defaults;
}

function setStoredEmails(key: string, emails: string[]) {
  localStorage.setItem(key, JSON.stringify(emails));
}

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

  // 初期化
  useEffect(() => {
    const stored = localStorage.getItem("portal_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("portal_user");
      }
    }
    setAllowedEmails(getStoredEmails(STORAGE_KEY_ALLOWED_EMAILS, []));
    setAdminEmails(getStoredEmails(STORAGE_KEY_ADMIN_EMAILS, DEFAULT_ADMIN_EMAILS));
    setIsLoading(false);
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

    const currentAdmins = getStoredEmails(STORAGE_KEY_ADMIN_EMAILS, DEFAULT_ADMIN_EMAILS);
    const role = currentAdmins.includes(email) ? "admin" : "member";

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
  }, []);

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
    const displayName = email.split("@")[0];
    authenticateUser(email, displayName);
  }, [authenticateUser]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("portal_user");
  }, []);

  // 管理者用：許可メール管理
  const addAllowedEmail = useCallback((email: string) => {
    setAllowedEmails(prev => {
      if (prev.includes(email)) return prev;
      const next = [...prev, email];
      setStoredEmails(STORAGE_KEY_ALLOWED_EMAILS, next);
      return next;
    });
  }, []);

  const removeAllowedEmail = useCallback((email: string) => {
    setAllowedEmails(prev => {
      const next = prev.filter(e => e !== email);
      setStoredEmails(STORAGE_KEY_ALLOWED_EMAILS, next);
      return next;
    });
  }, []);

  const addAdminEmail = useCallback((email: string) => {
    setAdminEmails(prev => {
      if (prev.includes(email)) return prev;
      const next = [...prev, email];
      setStoredEmails(STORAGE_KEY_ADMIN_EMAILS, next);
      return next;
    });
  }, []);

  const removeAdminEmail = useCallback((email: string) => {
    // 最後の管理者は削除不可
    setAdminEmails(prev => {
      if (prev.length <= 1) {
        alert("管理者は最低1人必要です。");
        return prev;
      }
      const next = prev.filter(e => e !== email);
      setStoredEmails(STORAGE_KEY_ADMIN_EMAILS, next);
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

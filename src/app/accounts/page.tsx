"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import Toast from "@/components/Toast";
import { CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, CheckIcon } from "@/components/Icons";

type Tab = "site" | "instagram";

function InstagramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export default function AccountsPage() {
  const { user, isLoading } = useAuth();
  const { accounts, instaAccounts } = useData();
  const { staffProfiles } = useSchedule();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("site");
  const [toast, setToast] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  const copyToClipboard = useCallback(async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedField(fieldId);
    setToast("コピーしました");
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getMemberName = (email: string) => {
    const p = staffProfiles.find(p => p.email === email);
    return p ? (p.fullName || p.lastName) : email;
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order);
  const sortedInsta = [...instaAccounts].sort((a, b) => a.order - b.order);

  return (
    <>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">支部アカウント情報</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">各サービスのID・パスワードを確認できます</p>
        </div>

        {/* Warning banner */}
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 mb-5">
          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
            取り扱い注意：外部流出に十分注意してください。文字列をタップ/クリックでコピーできます。
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("site")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "site"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            サイト
          </button>
          <button
            onClick={() => setActiveTab("instagram")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "instagram"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            <InstagramIcon className="w-4 h-4" />
            インスタ
          </button>
        </div>

        {/* === サイトアカウント === */}
        {activeTab === "site" && (
          <div className="space-y-3">
            {sortedAccounts.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">サイトアカウントがありません</p>
            ) : sortedAccounts.map((acc) => (
              <div key={acc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{acc.serviceName}</h3>
                  {acc.url && (
                    <a
                      href={acc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                      サイトを開く
                    </a>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {/* ID */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">ログインID</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all break-all min-w-0">
                        {acc.loginId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(acc.loginId, `${acc.id}-id`)}
                        className={`shrink-0 p-2 rounded-lg transition-colors ${copiedField === `${acc.id}-id` ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600"}`}
                      >
                        {copiedField === `${acc.id}-id` ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </div>
                  </div>
                  {/* Password */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">パスワード</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all break-all min-w-0">
                        {visiblePasswords.has(acc.id) ? acc.password : "••••••••••"}
                      </code>
                      <button onClick={() => togglePassword(acc.id)} className="shrink-0 p-2 bg-gray-50 dark:bg-gray-700 text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                        {visiblePasswords.has(acc.id) ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(acc.password, `${acc.id}-pw`)}
                        className={`shrink-0 p-2 rounded-lg transition-colors ${copiedField === `${acc.id}-pw` ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600"}`}
                      >
                        {copiedField === `${acc.id}-pw` ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </div>
                  </div>
                  {acc.note && <p className="text-xs text-gray-400">{acc.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === インスタアカウント === */}
        {activeTab === "instagram" && (
          <div className="space-y-3">
            {sortedInsta.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">インスタアカウントがありません</p>
            ) : sortedInsta.map((acc) => (
              <div key={acc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <InstagramIcon className="w-5 h-5 shrink-0 text-pink-500" />
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">@{acc.handle}</span>
                  </div>
                  <a
                    href={`https://www.instagram.com/${acc.handle}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 bg-pink-50 dark:bg-pink-900/30 dark:text-pink-400 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    開く
                  </a>
                </div>

                <div className="p-4 space-y-3">
                  {/* Handle copy */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">アカウントID</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all break-all min-w-0">
                        @{acc.handle}
                      </code>
                      <button
                        onClick={() => copyToClipboard(`@${acc.handle}`, `${acc.id}-handle`)}
                        className={`shrink-0 p-2 rounded-lg transition-colors ${copiedField === `${acc.id}-handle` ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500 hover:bg-pink-50 hover:text-pink-600"}`}
                      >
                        {copiedField === `${acc.id}-handle` ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </div>
                  </div>

                  {/* Email */}
                  {acc.email && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">メールアドレス</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all break-all min-w-0">
                          {acc.email}
                        </code>
                        <button
                          onClick={() => copyToClipboard(acc.email!, `${acc.id}-email`)}
                          className={`shrink-0 p-2 rounded-lg transition-colors ${copiedField === `${acc.id}-email` ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500 hover:bg-pink-50 hover:text-pink-600"}`}
                        >
                          {copiedField === `${acc.id}-email` ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  {acc.password && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">パスワード</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all break-all min-w-0">
                          {visiblePasswords.has(`${acc.id}-pw`) ? acc.password : "••••••••••"}
                        </code>
                        <button onClick={() => togglePassword(`${acc.id}-pw`)} className="shrink-0 p-2 bg-gray-50 dark:bg-gray-700 text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                          {visiblePasswords.has(`${acc.id}-pw`) ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(acc.password!, `${acc.id}-pw-copy`)}
                          className={`shrink-0 p-2 rounded-lg transition-colors ${copiedField === `${acc.id}-pw-copy` ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500 hover:bg-pink-50 hover:text-pink-600"}`}
                        >
                          {copiedField === `${acc.id}-pw-copy` ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Logged-in users */}
                  {acc.loggedInUsers.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">ログイン中のメンバー</p>
                      <div className="flex flex-wrap gap-1.5">
                        {acc.loggedInUsers.map(email => (
                          <span key={email} className="inline-flex items-center px-2.5 py-1 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs rounded-full font-medium">
                            {getMemberName(email)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {acc.note && <p className="text-xs text-gray-400">{acc.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security note */}
        <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            本番環境では、パスワード情報は暗号化されたデータベースで管理されます。
          </p>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import Toast from "@/components/Toast";
import { CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, CheckIcon } from "@/components/Icons";

export default function AccountsPage() {
  const { user, isLoading } = useAuth();
  const { accounts } = useData();
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  const copyToClipboard = useCallback(async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setToast("コピーしました");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedField(fieldId);
      setToast("コピーしました");
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order);

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
          <p className="text-xs text-amber-800 font-medium">
            取り扱い注意：外部流出に十分注意してください。文字列をタップ/クリックでコピーできます。
          </p>
        </div>

        {/* Account cards */}
        <div className="space-y-3">
          {sortedAccounts.map((acc) => (
            <div key={acc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Service header */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{acc.serviceName}</h3>
                {acc.url && (
                  <a
                    href={acc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    サイトを開く
                  </a>
                )}
              </div>

              <div className="p-4 space-y-3">
                {/* ID field */}
                <div>
                  <p className="text-xs text-gray-400 mb-1">ログインID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all">
                      {acc.loginId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(acc.loginId, `${acc.id}-id`)}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        copiedField === `${acc.id}-id`
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      {copiedField === `${acc.id}-id` ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <p className="text-xs text-gray-400 mb-1">パスワード</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono select-all">
                      {visiblePasswords.has(acc.id) ? acc.password : "••••••••••"}
                    </code>
                    <button
                      onClick={() => togglePassword(acc.id)}
                      className="shrink-0 p-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      {visiblePasswords.has(acc.id) ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(acc.password, `${acc.id}-pw`)}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        copiedField === `${acc.id}-pw`
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      {copiedField === `${acc.id}-pw` ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </div>
                </div>

                {/* Note */}
                {acc.note && (
                  <p className="text-xs text-gray-400">{acc.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Security note */}
        <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            本番環境では、パスワード情報は暗号化されたデータベースで管理されます。
            このプロトタイプではLocalStorageに保存されています。
          </p>
        </div>
      </div>
    </>
  );
}

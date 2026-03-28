"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMeetingMinutes } from "@/contexts/MeetingMinutesContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { ExternalLinkIcon } from "@/components/Icons";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, collection } from "firebase/firestore";

interface ExpenseRecord {
  id: string; // email_yearMonth
  email: string;
  yearMonth: string;
  amount: number;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

export default function ExpensesPage() {
  const { user, isLoading } = useAuth();
  const { minutes } = useMeetingMinutes();
  const { staffProfiles } = useSchedule();
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  // Listen to expenses collection
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "expenses"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }) as ExpenseRecord);
      setExpenses(data);
    });
    return () => unsub();
  }, [user]);

  const myProfile = useMemo(() => {
    if (!user) return undefined;
    return staffProfiles.find(p => p.email === user.email);
  }, [user, staffProfiles]);

  // Meetings with venueStation, grouped by month
  const meetingsWithStation = useMemo(() => {
    return [...minutes]
      .filter(m => m.venueStation && m.date)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [minutes]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, typeof meetingsWithStation> = {};
    meetingsWithStation.forEach(m => {
      const ym = m.date?.slice(0, 7);
      if (!ym) return;
      if (!groups[ym]) groups[ym] = [];
      groups[ym].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [meetingsWithStation]);

  const getExpenseForMonth = useCallback((ym: string) => {
    if (!user) return null;
    const docId = `${user.email}_${ym}`;
    return expenses.find(e => e.id === docId) || null;
  }, [user, expenses]);

  const saveExpense = useCallback(async (ym: string, amount: number) => {
    if (!user) return;
    const docId = `${user.email}_${ym}`;
    await setDoc(doc(db, "expenses", docId), {
      id: docId,
      email: user.email,
      yearMonth: ym,
      amount,
    });
    setEditingMonth(null);
    setEditAmount("");
    setToast("交通費を保存しました");
    setTimeout(() => setToast(""), 2500);
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nearestStation = myProfile?.nearestStation;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">交通費</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">ミーティングの交通費を確認・記録</p>
      </div>

      {/* My station */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">あなたの最寄駅</p>
            {nearestStation ? (
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{nearestStation}</p>
            ) : (
              <p className="text-sm text-orange-600 dark:text-orange-400">
                未設定です。プロフィール設定から最寄駅を登録してください。
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Grouped meetings */}
      {groupedByMonth.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">会場駅が設定されたミーティングがありません</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByMonth.map(([ym, meetings]) => {
            const expense = getExpenseForMonth(ym);
            const isEditing = editingMonth === ym;

            return (
              <div key={ym} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Month header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {formatMonthLabel(ym)}
                  </h2>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          placeholder="金額"
                          className="w-28 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter" && editAmount) saveExpense(ym, Number(editAmount));
                            if (e.key === "Escape") { setEditingMonth(null); setEditAmount(""); }
                          }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">円</span>
                        <button
                          onClick={() => editAmount && saveExpense(ym, Number(editAmount))}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => { setEditingMonth(null); setEditAmount(""); }}
                          className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingMonth(ym); setEditAmount(expense?.amount?.toString() || ""); }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {expense ? `合計: ${expense.amount.toLocaleString()}円 (編集)` : "合計交通費を入力"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Meeting list */}
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {meetings.map(m => (
                    <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(m.date)}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-300">{m.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 dark:text-gray-500">{m.startTime}〜{m.endTime}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{m.venue}{m.venueStation ? `（${m.venueStation}）` : ""}</span>
                        </div>
                      </div>
                      {nearestStation && m.venueStation && (
                        <a
                          href={`https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(nearestStation)}&to=${encodeURIComponent(m.venueStation)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors shrink-0"
                        >
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                          交通費を計算
                        </a>
                      )}
                      {!nearestStation && m.venueStation && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">最寄駅未設定</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

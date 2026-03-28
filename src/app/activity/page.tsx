"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useActivity } from "@/contexts/ActivityContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { CloseIcon, PlusIcon, EditIcon } from "@/components/Icons";
import type { ActivityReport } from "@/types";
import { CAMPAIGN_START, CAMPAIGN_END } from "@/types";

// =============================================
// 定数
// =============================================

const CAMPAIGN_DAYS: string[] = (() => {
  const days: string[] = [];
  const start = new Date(CAMPAIGN_START + "T00:00:00");
  const end = new Date(CAMPAIGN_END + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
})();

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// 報告の締め切り：翌日12:00
function isDeadlinePassed(date: string): boolean {
  const deadline = new Date(date + "T00:00:00");
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(12, 0, 0, 0);
  return new Date() > deadline;
}

function isCampaignDay(date: string): boolean {
  return date >= CAMPAIGN_START && date <= CAMPAIGN_END;
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// =============================================
// メインページ
// =============================================

type MainTab = "report" | "everyone" | "ranking" | "topics";

export default function ActivityPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { reports, topics, addOrUpdateReport, setTopic, getReportByDateAndUser, getTopicByDate } = useActivity();
  const { staffProfiles } = useSchedule();

  const [activeTab, setActiveTab] = useState<MainTab>("report");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // 未報告日の計算（締め切り過ぎているかつ未報告）
  const missingDates = useMemo(() => {
    if (!user) return [];
    const t = today();
    return CAMPAIGN_DAYS.filter((d) => {
      if (d > t) return false;
      if (!isDeadlinePassed(d)) return false;
      return !getReportByDateAndUser(d, user.email);
    });
  }, [reports, user, getReportByDateAndUser]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allTabs: { id: MainTab; label: string; adminOnly?: boolean }[] = [
    { id: "report", label: "報告する" },
    { id: "everyone", label: "みんなの報告" },
    { id: "ranking", label: "ランキング" },
    { id: "topics", label: "お題管理", adminOnly: true },
  ];
  const tabs = allTabs.filter((t) => !t.adminOnly || user.role === "admin");

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">行動量報告</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          集客期間：{CAMPAIGN_START} 〜 {CAMPAIGN_END}
        </p>
      </div>

      {/* 未報告アラート */}
      {missingDates.length > 0 && (
        <div className="mb-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">未報告の日があります（{missingDates.length}日）</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {missingDates.slice(0, 10).map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveTab("report")}
                    className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded-full border border-red-200 dark:border-red-700 hover:bg-red-200 transition-colors"
                  >
                    {formatMonthDay(d)}
                  </button>
                ))}
                {missingDates.length > 10 && (
                  <span className="text-xs text-red-500">+{missingDates.length - 10}日</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm rounded-md transition-colors font-medium ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {activeTab === "report" && (
        <ReportTab user={user} getReportByDateAndUser={getReportByDateAndUser} getTopicByDate={getTopicByDate} addOrUpdateReport={addOrUpdateReport} missingDates={missingDates} showToast={showToast} />
      )}
      {activeTab === "everyone" && (
        <EveryoneTab reports={reports} topics={topics} staffProfiles={staffProfiles} />
      )}
      {activeTab === "ranking" && (
        <RankingTab reports={reports} staffProfiles={staffProfiles} />
      )}
      {activeTab === "topics" && user.role === "admin" && (
        <TopicsTab topics={topics} setTopic={setTopic} showToast={showToast} />
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

// =============================================
// Tab 1: 報告する
// =============================================

function ReportTab({
  user,
  getReportByDateAndUser,
  getTopicByDate,
  addOrUpdateReport,
  missingDates,
  showToast,
}: {
  user: { email: string; displayName: string };
  getReportByDateAndUser: (date: string, email: string) => ActivityReport | undefined;
  getTopicByDate: (date: string) => { question: string } | undefined;
  addOrUpdateReport: (data: Omit<ActivityReport, "id" | "createdAt" | "updatedAt">) => void;
  missingDates: string[];
  showToast: (msg: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(today());
  const existing = getReportByDateAndUser(selectedDate, user.email);
  const topic = getTopicByDate(selectedDate);
  const inCampaign = isCampaignDay(selectedDate);
  const deadlinePassed = isDeadlinePassed(selectedDate);
  const isMissing = missingDates.includes(selectedDate);

  // フォーム状態
  const [igCount, setIgCount] = useState(0);
  const [igStory, setIgStory] = useState<"○" | "×">("×");
  const [igReactions, setIgReactions] = useState(0);
  const [igPending, setIgPending] = useState(0);
  const [igTomorrowGoal, setIgTomorrowGoal] = useState(100);
  const [rvCount, setRvCount] = useState(0);
  const [rvTomorrow, setRvTomorrow] = useState(0);
  const [rvReactions, setRvReactions] = useState(0);
  const [topicAnswer, setTopicAnswer] = useState("");

  // 既存データを読み込み
  useEffect(() => {
    if (existing) {
      setIgCount(existing.instagram.count);
      setIgStory(existing.instagram.story);
      setIgReactions(existing.instagram.reactions);
      setIgPending(existing.instagram.pending);
      setIgTomorrowGoal(existing.instagram.tomorrowGoal);
      setRvCount(existing.review.count);
      setRvTomorrow(existing.review.tomorrowCount);
      setRvReactions(existing.review.reactions);
      setTopicAnswer(existing.topicAnswer);
    } else {
      setIgCount(0); setIgStory("×"); setIgReactions(0); setIgPending(0); setIgTomorrowGoal(100);
      setRvCount(0); setRvTomorrow(0); setRvReactions(0); setTopicAnswer("");
    }
  }, [selectedDate, existing?.updatedAt]);

  const handleSubmit = () => {
    addOrUpdateReport({
      date: selectedDate,
      userEmail: user.email,
      userName: user.displayName,
      instagram: { count: igCount, story: igStory, reactions: igReactions, pending: igPending, tomorrowGoal: igTomorrowGoal },
      review: { count: rvCount, tomorrowCount: rvTomorrow, reactions: rvReactions },
      topicAnswer,
    });
    showToast(`${formatDateJP(selectedDate)} の報告を${existing ? "更新" : "保存"}しました`);
  };

  return (
    <div className="space-y-5">
      {/* 日付選択 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">報告日</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            {inCampaign ? (
              <span className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-700">集客期間</span>
            ) : (
              <span className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-500">期間外</span>
            )}
            {existing && (
              <span className="px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-700">報告済み</span>
            )}
            {isMissing && (
              <span className="px-2.5 py-1 text-xs rounded-full bg-red-100 text-red-700 font-medium">未報告（締切超過）</span>
            )}
          </div>
        </div>
        {deadlinePassed && !existing && inCampaign && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">※ 締切（翌日12:00）を過ぎています。後から記録できます。</p>
        )}
      </div>

      {/* インスタDMセクション */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border-b border-gray-100 dark:border-gray-700">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">インスタDM</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <NumberField label="件数" value={igCount} onChange={setIgCount} />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ストーリー</label>
            <div className="flex gap-2">
              {(["○", "×"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setIgStory(v)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    igStory === v
                      ? v === "○"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-gray-400 text-white border-gray-400"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <NumberField label="反応数" value={igReactions} onChange={setIgReactions} />
          <NumberField label="日調中" value={igPending} onChange={setIgPending} />
          <NumberField label="明日の目標" value={igTomorrowGoal} onChange={setIgTomorrowGoal} />
        </div>
      </div>

      {/* 口コミセクション */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-gray-100 dark:border-gray-700">
          <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">口コミ</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <NumberField label="件数" value={rvCount} onChange={setRvCount} />
          <NumberField label="反応" value={rvReactions} onChange={setRvReactions} />
          <NumberField label="明日の件数" value={rvTomorrow} onChange={setRvTomorrow} />
        </div>
      </div>

      {/* お題 */}
      {inCampaign && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 dark:bg-yellow-950/30 border-b border-gray-100 dark:border-gray-700">
            <div className="w-5 h-5 rounded-md bg-yellow-400 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">Q</span>
            </div>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">今日のお題</span>
          </div>
          <div className="p-4">
            {topic ? (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {topic.question}
                </p>
                <textarea
                  value={topicAnswer}
                  onChange={(e) => setTopicAnswer(e.target.value)}
                  rows={2}
                  placeholder="回答を入力..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                />
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">この日のお題はまだ設定されていません</p>
            )}
          </div>
        </div>
      )}

      {/* 送信ボタン */}
      <button
        onClick={handleSubmit}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
      >
        {existing ? "報告を更新する" : "報告を送信する"}
      </button>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
        >−</button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 text-center px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
        >+</button>
      </div>
    </div>
  );
}

// =============================================
// Tab 2: みんなの報告
// =============================================

function EveryoneTab({
  reports,
  topics,
  staffProfiles,
}: {
  reports: ActivityReport[];
  topics: { date: string; question: string }[];
  staffProfiles: { email: string; fullName?: string; lastName: string }[];
}) {
  const [selectedDate, setSelectedDate] = useState(today());

  const dayReports = useMemo(() => {
    return reports
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => b.instagram.count - a.instagram.count);
  }, [reports, selectedDate]);

  const topic = topics.find((t) => t.date === selectedDate);

  const getName = (email: string, fallback: string) => {
    const p = staffProfiles.find((p) => p.email === email);
    return p ? (p.fullName || p.lastName) : fallback;
  };

  return (
    <div className="space-y-4">
      {/* 日付選択 */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 dark:text-gray-400">日付：</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">{formatDateJP(selectedDate)}</span>
        <span className="ml-auto text-xs text-gray-400">{dayReports.length}件の報告</span>
      </div>

      {/* お題表示 */}
      {topic && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">この日のお題：</span>
          <span className="text-sm text-gray-700 dark:text-gray-300 ml-2">{topic.question}</span>
        </div>
      )}

      {/* 報告一覧 */}
      {dayReports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">この日の報告はまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayReports.map((r, idx) => (
            <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3 mb-3">
                {idx < 3 && (
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    idx === 0 ? "bg-yellow-400 text-white" :
                    idx === 1 ? "bg-gray-300 text-gray-700" :
                    "bg-amber-600 text-white"
                  }`}>{idx + 1}</span>
                )}
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {getName(r.userEmail, r.userName).charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{getName(r.userEmail, r.userName)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                    <span className="text-gray-500">インスタ</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{r.instagram.count}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    <span className="text-gray-500">口コミ</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{r.review.count}</span>
                  </span>
                </div>
              </div>

              {/* 詳細 */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-pink-50 dark:bg-pink-950/20 rounded-lg p-3 space-y-1">
                  <p className="font-semibold text-pink-700 dark:text-pink-400 mb-1.5">インスタDM</p>
                  <div className="flex justify-between"><span className="text-gray-500">件数</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.instagram.count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ストーリー</span><span className={`font-medium ${r.instagram.story === "○" ? "text-green-600" : "text-gray-400"}`}>{r.instagram.story}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">反応数</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.instagram.reactions}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">日調中</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.instagram.pending}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">明日の目標</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.instagram.tomorrowGoal}</span></div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 space-y-1">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1.5">口コミ</p>
                  <div className="flex justify-between"><span className="text-gray-500">件数</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.review.count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">反応</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.review.reactions}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">明日の件数</span><span className="font-medium text-gray-800 dark:text-gray-200">{r.review.tomorrowCount}</span></div>
                </div>
              </div>

              {/* お題回答 */}
              {r.topicAnswer && (
                <div className="mt-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">お題への回答：</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 ml-1">{r.topicAnswer}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// Tab 3: ランキング
// =============================================

type RankingMode = "cumulative" | "daily";
type RankingMetric = "instagram" | "review";

function RankingTab({
  reports,
  staffProfiles,
}: {
  reports: ActivityReport[];
  staffProfiles: { email: string; fullName?: string; lastName: string }[];
}) {
  const [mode, setMode] = useState<RankingMode>("cumulative");
  const [metric, setMetric] = useState<RankingMetric>("instagram");
  const [selectedDate, setSelectedDate] = useState(today());

  const getName = (email: string, fallback: string) => {
    const p = staffProfiles.find((p) => p.email === email);
    return p ? (p.fullName || p.lastName) : fallback;
  };

  // 累計ランキング
  const cumulativeRanking = useMemo(() => {
    const totals: Record<string, { email: string; name: string; igTotal: number; rvTotal: number; reportDays: number; storyDays: number }> = {};
    const campaignReports = reports.filter((r) => r.date >= CAMPAIGN_START && r.date <= CAMPAIGN_END);
    campaignReports.forEach((r) => {
      if (!totals[r.userEmail]) {
        totals[r.userEmail] = { email: r.userEmail, name: r.userName, igTotal: 0, rvTotal: 0, reportDays: 0, storyDays: 0 };
      }
      totals[r.userEmail].igTotal += r.instagram.count;
      totals[r.userEmail].rvTotal += r.review.count;
      totals[r.userEmail].reportDays += 1;
      if (r.instagram.story === "○") totals[r.userEmail].storyDays += 1;
    });
    return Object.values(totals).sort((a, b) =>
      metric === "instagram" ? b.igTotal - a.igTotal : b.rvTotal - a.rvTotal
    );
  }, [reports, metric]);

  // 日別ランキング
  const dailyRanking = useMemo(() => {
    return reports
      .filter((r) => r.date === selectedDate)
      .map((r) => ({ ...r, score: metric === "instagram" ? r.instagram.count : r.review.count }))
      .sort((a, b) => b.score - a.score);
  }, [reports, selectedDate, metric]);

  const medalColor = (idx: number) =>
    idx === 0 ? "bg-yellow-400 text-white" :
    idx === 1 ? "bg-gray-300 text-gray-700" :
    idx === 2 ? "bg-amber-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";

  return (
    <div className="space-y-5">
      {/* モード切替 */}
      <div className="flex gap-3">
        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
          {([["cumulative", "累計"], ["daily", "日別"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                mode === id ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >{label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
          {([["instagram", "インスタ"], ["review", "口コミ"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMetric(id)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                metric === id
                  ? id === "instagram" ? "bg-pink-500 text-white" : "bg-blue-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* 日別: 日付選択 */}
      {mode === "daily" && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">対象日：</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">{formatDateJP(selectedDate)}</span>
        </div>
      )}

      {/* 累計: 期間表示 */}
      {mode === "cumulative" && (
        <p className="text-xs text-gray-400">集計期間：{CAMPAIGN_START} 〜 {CAMPAIGN_END}（または現在まで）</p>
      )}

      {/* ランキングリスト */}
      {mode === "cumulative" ? (
        cumulativeRanking.length === 0 ? (
          <div className="text-center py-12 text-gray-400">データがありません</div>
        ) : (
          <div className="space-y-2">
            {cumulativeRanking.map((r, idx) => {
              const score = metric === "instagram" ? r.igTotal : r.rvTotal;
              const maxScore = (metric === "instagram" ? cumulativeRanking[0]?.igTotal : cumulativeRanking[0]?.rvTotal) || 1;
              const pct = Math.round((score / maxScore) * 100);
              const name = getName(r.email, r.name);
              return (
                <div key={r.email} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${medalColor(idx)}`}>{idx + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{name}</span>
                    <span className={`text-lg font-bold ${metric === "instagram" ? "text-pink-600" : "text-blue-600"}`}>{score}<span className="text-xs font-normal text-gray-400 ml-0.5">件</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${metric === "instagram" ? "bg-gradient-to-r from-pink-500 to-purple-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span>報告日数: <span className="text-gray-600 dark:text-gray-300 font-medium">{r.reportDays}日</span></span>
                    <span>ストーリー: <span className="text-gray-600 dark:text-gray-300 font-medium">{r.storyDays}回</span></span>
                    {metric === "instagram" && <span>口コミ: <span className="text-gray-600 dark:text-gray-300 font-medium">{r.rvTotal}件</span></span>}
                    {metric === "review" && <span>インスタ: <span className="text-gray-600 dark:text-gray-300 font-medium">{r.igTotal}件</span></span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        dailyRanking.length === 0 ? (
          <div className="text-center py-12 text-gray-400">データがありません</div>
        ) : (
          <div className="space-y-2">
            {dailyRanking.map((r, idx) => {
              const maxScore = dailyRanking[0]?.score || 1;
              const pct = Math.round((r.score / maxScore) * 100);
              const name = getName(r.userEmail, r.userName);
              return (
                <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${medalColor(idx)}`}>{idx + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{name}</span>
                    <span className={`text-lg font-bold ${metric === "instagram" ? "text-pink-600" : "text-blue-600"}`}>{r.score}<span className="text-xs font-normal text-gray-400 ml-0.5">件</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${metric === "instagram" ? "bg-gradient-to-r from-pink-500 to-purple-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// =============================================
// Tab 4: お題管理（管理者のみ）
// =============================================

function TopicsTab({
  topics,
  setTopic,
  showToast,
}: {
  topics: { date: string; question: string }[];
  setTopic: (date: string, question: string) => void;
  showToast: (msg: string) => void;
}) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState("");
  const [filterMonth, setFilterMonth] = useState(CAMPAIGN_START.slice(0, 7));

  const months = useMemo(() => {
    const ms = new Set<string>();
    CAMPAIGN_DAYS.forEach((d) => ms.add(d.slice(0, 7)));
    return Array.from(ms).sort();
  }, []);

  const filteredDays = CAMPAIGN_DAYS.filter((d) => d.startsWith(filterMonth));
  const topicMap = useMemo(() => {
    const m: Record<string, string> = {};
    topics.forEach((t) => { m[t.date] = t.question; });
    return m;
  }, [topics]);

  const handleSave = () => {
    if (!editingDate || !editingQuestion.trim()) return;
    setTopic(editingDate, editingQuestion.trim());
    showToast(`${formatDateJP(editingDate)} のお題を設定しました`);
    setEditingDate(null);
    setEditingQuestion("");
  };

  const setCount = topics.filter((t) => t.date >= CAMPAIGN_START && t.date <= CAMPAIGN_END).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          設定済み：<span className="font-semibold text-blue-600">{setCount}</span> / {CAMPAIGN_DAYS.length}日
        </p>
        <div className="flex gap-1 ml-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setFilterMonth(m)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                filterMonth === m ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {parseInt(m.split("-")[1])}月
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
        {filteredDays.map((date) => {
          const q = topicMap[date];
          const isEditing = editingDate === date;
          return (
            <div key={date} className="px-4 py-3">
              {isEditing ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">{formatDateJP(date)}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingQuestion}
                      onChange={(e) => setEditingQuestion(e.target.value)}
                      placeholder="例: 好きな食べ物は？"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditingDate(null); }}
                      className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleSave} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">保存</button>
                    <button onClick={() => setEditingDate(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{formatDateJP(date)}</span>
                  {q ? (
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{q}</span>
                  ) : (
                    <span className="flex-1 text-sm text-gray-300 dark:text-gray-600 italic">未設定</span>
                  )}
                  <button
                    onClick={() => { setEditingDate(date); setEditingQuestion(q ?? ""); }}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    {q ? <EditIcon className="w-3.5 h-3.5" /> : <PlusIcon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

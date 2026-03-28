"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useTask } from "@/contexts/TaskContext";
import { sendGmail, buildOrientationReminderHtml, buildTaskReminderHtml } from "@/lib/gmail";
import { EVENT_TYPE_LABELS } from "@/types";
import type { Booking, TimeSlot, StaffProfile, Task } from "@/types";
import { MailIcon } from "@/components/Icons";
import Toast from "@/components/Toast";

// =============================================
// Types
// =============================================

interface EmailSettings {
  orientationEnabled: boolean;
  orientationDaysBefore: number;
  orientationHour: number;
  orientationMinute: number;
  taskEnabled: boolean;
  taskDaysBefore: number;
  taskHour: number;
  taskMinute: number;
}

const DEFAULT_SETTINGS: EmailSettings = {
  orientationEnabled: true,
  orientationDaysBefore: 1,
  orientationHour: 9,
  orientationMinute: 0,
  taskEnabled: true,
  taskDaysBefore: 1,
  taskHour: 9,
  taskMinute: 0,
};

interface SentLogEntry {
  id: string;
  sentAt: string;
  type: "orientation" | "task";
  subject: string;
  to: string;
  details: string;
}

const SETTINGS_KEY = "portal_email_settings";
const SENT_LOG_KEY = "portal_email_sent_log";

// =============================================
// Helpers
// =============================================

function loadSettings(): EmailSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: EmailSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function loadSentLog(): SentLogEntry[] {
  try {
    const raw = localStorage.getItem(SENT_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SentLogEntry[];
  } catch {
    return [];
  }
}

function saveSentLog(log: SentLogEntry[]) {
  try { localStorage.setItem(SENT_LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }
}

// =============================================
// checkDueReminders
// =============================================

interface DueItem {
  type: "orientation" | "task";
  logId: string;
  subject: string;
  to: string;
  details: string;
  htmlBody: string;
}

function checkDueReminders(
  settings: EmailSettings,
  bookings: Booking[],
  timeSlots: TimeSlot[],
  staffProfiles: StaffProfile[],
  tasks: Task[],
  userEmail: string,
  sentLog: SentLogEntry[]
): DueItem[] {
  const now = Date.now();
  const sentIds = new Set(sentLog.map(e => e.id));
  const result: DueItem[] = [];

  // Orientation reminders
  if (settings.orientationEnabled) {
    for (const booking of bookings) {
      if (booking.status !== "confirmed" || !booking.confirmedSlotId) continue;
      const slot = timeSlots.find(s => s.id === booking.confirmedSlotId);
      if (!slot) continue;
      const staff = booking.assignedStaffId
        ? staffProfiles.find(p => p.id === booking.assignedStaffId)
        : undefined;
      if (!staff?.email) continue;

      const slotDatetime = new Date(slot.date + "T" + slot.startTime + ":00").getTime();
      if (slotDatetime <= now) continue; // already past

      const remindAt = new Date(slot.date + "T" + slot.startTime + ":00");
      remindAt.setDate(remindAt.getDate() - settings.orientationDaysBefore);
      remindAt.setHours(settings.orientationHour, settings.orientationMinute, 0, 0);

      if (now < remindAt.getTime()) continue; // not yet time

      const logId = `orientation_${booking.id}`;
      if (sentIds.has(logId)) continue; // already sent

      const subject = `【説明会リマインド】${slot.date} ${slot.startTime}〜 ${booking.studentName}さん`;
      const html = buildOrientationReminderHtml({
        staffName: staff.lastName,
        studentName: booking.studentName,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        eventTypeLabel: EVENT_TYPE_LABELS[booking.eventType],
        meetLink: booking.meetLink,
      });

      result.push({
        type: "orientation",
        logId,
        subject,
        to: staff.email,
        details: `${booking.studentName}さん / ${slot.date} ${slot.startTime}`,
        htmlBody: html,
      });
    }
  }

  // Task reminders
  if (settings.taskEnabled) {
    for (const task of tasks) {
      if (task.status === "done") continue;
      if (!task.dueDate) continue;

      // Check if user is assigned
      const isAssigned =
        task.assigneeEmails.includes("all") || task.assigneeEmails.includes(userEmail);
      if (!isAssigned) continue;

      const dueDatetime = new Date(task.dueDate + "T23:59:59").getTime();
      if (dueDatetime <= now) continue; // already past due

      const remindAt = new Date(task.dueDate + "T00:00:00");
      remindAt.setDate(remindAt.getDate() - settings.taskDaysBefore);
      remindAt.setHours(settings.taskHour, settings.taskMinute, 0, 0);

      if (now < remindAt.getTime()) continue; // not yet time

      const logId = `task_${task.id}`;
      if (sentIds.has(logId)) continue; // already sent

      const subject = `【タスクリマインド】${task.title}`;
      const html = buildTaskReminderHtml({
        taskTitle: task.title,
        description: task.description || undefined,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        assigneeNames: [userEmail],
        portalUrl: typeof window !== "undefined" ? window.location.origin + "/tasks" : undefined,
      });

      result.push({
        type: "task",
        logId,
        subject,
        to: userEmail,
        details: `${task.title} / 期限: ${task.dueDate}`,
        htmlBody: html,
      });
    }
  }

  return result;
}

// =============================================
// Page
// =============================================

type PageTab = "gmail" | "settings" | "history";

export default function EmailPage() {
  const { user, isLoading, gmailToken, requestGmailAccess, removeGmailToken } = useAuth();
  const { bookings, timeSlots, staffProfiles } = useSchedule();
  const { tasks } = useTask();

  const [activeTab, setActiveTab] = useState<PageTab>("gmail");
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS);
  const [sentLog, setSentLog] = useState<SentLogEntry[]>([]);
  const [toast, setToast] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    setSettings(loadSettings());
    setSentLog(loadSentLog());
  }, []);

  // Auto-send on mount when Gmail is connected
  const runAutoSend = useCallback(async () => {
    if (!gmailToken || !user) return;
    const currentLog = loadSentLog();
    const currentSettings = loadSettings();
    const due = checkDueReminders(
      currentSettings,
      bookings,
      timeSlots,
      staffProfiles,
      tasks,
      user.email,
      currentLog
    );
    if (due.length === 0) return;

    const newEntries: SentLogEntry[] = [];
    for (const item of due) {
      try {
        await sendGmail({
          accessToken: gmailToken.accessToken,
          to: item.to,
          subject: item.subject,
          htmlBody: item.htmlBody,
        });
        newEntries.push({
          id: item.logId,
          sentAt: new Date().toISOString(),
          type: item.type,
          subject: item.subject,
          to: item.to,
          details: item.details,
        });
        setToast(`リマインド送信: ${item.subject}`);
      } catch {
        // Silently ignore auto-send errors
      }
    }
    if (newEntries.length > 0) {
      const updatedLog = [...newEntries, ...currentLog];
      saveSentLog(updatedLog);
      setSentLog(updatedLog);
    }
  }, [gmailToken, user, bookings, timeSlots, staffProfiles, tasks]);

  useEffect(() => {
    if (!isLoading && user && gmailToken) {
      runAutoSend();
    }
  }, [isLoading, user?.email, gmailToken?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Upcoming reminders preview
  const upcomingReminders = useMemo(() => {
    if (!user) return [];
    return checkDueReminders(settings, bookings, timeSlots, staffProfiles, tasks, user.email, sentLog);
  }, [settings, bookings, timeSlots, staffProfiles, tasks, user, sentLog]);

  const handleSaveSettings = (newSettings: EmailSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setToast("設定を保存しました");
  };

  const handleClearLog = () => {
    if (!confirm("送信履歴をすべて削除しますか？")) return;
    saveSentLog([]);
    setSentLog([]);
    setToast("送信履歴を削除しました");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">ログインしてください</p>
      </div>
    );
  }

  const tabs: { key: PageTab; label: string }[] = [
    { key: "gmail", label: "Gmail連携" },
    { key: "settings", label: "リマインド設定" },
    { key: "history", label: "送信履歴" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
          <MailIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">メール設定</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gmail連携とリマインドメールの設定</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
            {tab.key === "history" && sentLog.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-1.5 py-0.5">
                {sentLog.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Gmail連携 */}
      {activeTab === "gmail" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
              </svg>
              Gmail連携
            </h2>

            {gmailToken ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">✓ Gmail連携済み</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      有効期限: {new Date(gmailToken.expiresAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}まで
                    </p>
                  </div>
                  <button
                    onClick={removeGmailToken}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    解除
                  </button>
                </div>
                {upcomingReminders.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                      送信待ちのリマインドが {upcomingReminders.length} 件あります
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      アプリを開くと自動送信されます
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={requestGmailAccess}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4">
                    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                    <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                    <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                    <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
                  </svg>
                  Gmailを連携する（送信のみ）
                </button>
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">自動リマインドについて</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc ml-4">
              <li>Gmail連携済みの状態でアプリを開くと、設定した日時に自動でリマインドメールが送信されます</li>
              <li>メールはあなたのGmailアカウントから送信されます（送信のみ・メール読み取り不可）</li>
              <li>一度送信したリマインドは重複して送信されません</li>
              <li>トークンは約1時間で期限切れになります。期限切れ後は再連携してください</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: リマインド設定 */}
      {activeTab === "settings" && (
        <ReminderSettingsTab
          settings={settings}
          onSave={handleSaveSettings}
          bookings={bookings}
          timeSlots={timeSlots}
          staffProfiles={staffProfiles}
          tasks={tasks}
          userEmail={user.email}
          sentLog={sentLog}
        />
      )}

      {/* Tab: 送信履歴 */}
      {activeTab === "history" && (
        <HistoryTab
          sentLog={sentLog}
          onClearLog={handleClearLog}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}

// =============================================
// ReminderSettingsTab
// =============================================

function ReminderSettingsTab({
  settings,
  onSave,
  bookings,
  timeSlots,
  staffProfiles,
  tasks,
  userEmail,
  sentLog,
}: {
  settings: EmailSettings;
  onSave: (s: EmailSettings) => void;
  bookings: Booking[];
  timeSlots: TimeSlot[];
  staffProfiles: StaffProfile[];
  tasks: Task[];
  userEmail: string;
  sentLog: SentLogEntry[];
}) {
  const [draft, setDraft] = useState<EmailSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const upcomingItems = useMemo(() => {
    return checkDueReminders(draft, bookings, timeSlots, staffProfiles, tasks, userEmail, sentLog);
  }, [draft, bookings, timeSlots, staffProfiles, tasks, userEmail, sentLog]);

  const daysOptions = [
    { value: 0, label: "当日" },
    { value: 1, label: "前日" },
    { value: 2, label: "2日前" },
    { value: 3, label: "3日前" },
    { value: 7, label: "7日前" },
  ];

  const inputClass = "px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-5">
      {/* 説明会リマインド */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">説明会リマインド</h3>
          <button
            onClick={() => setDraft(prev => ({ ...prev, orientationEnabled: !prev.orientationEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              draft.orientationEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                draft.orientationEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {draft.orientationEnabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">何日前</label>
                <select
                  value={draft.orientationDaysBefore}
                  onChange={e => setDraft(prev => ({ ...prev, orientationDaysBefore: Number(e.target.value) }))}
                  className={inputClass + " w-full"}
                >
                  {daysOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">送信時刻</label>
                <div className="flex gap-2">
                  <select
                    value={draft.orientationHour}
                    onChange={e => setDraft(prev => ({ ...prev, orientationHour: Number(e.target.value) }))}
                    className={inputClass + " flex-1"}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i}時</option>
                    ))}
                  </select>
                  <select
                    value={draft.orientationMinute}
                    onChange={e => setDraft(prev => ({ ...prev, orientationMinute: Number(e.target.value) }))}
                    className={inputClass + " flex-1"}
                  >
                    <option value={0}>00分</option>
                    <option value={30}>30分</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* タスクリマインド */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">タスクリマインド</h3>
          <button
            onClick={() => setDraft(prev => ({ ...prev, taskEnabled: !prev.taskEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              draft.taskEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                draft.taskEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {draft.taskEnabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">何日前</label>
                <select
                  value={draft.taskDaysBefore}
                  onChange={e => setDraft(prev => ({ ...prev, taskDaysBefore: Number(e.target.value) }))}
                  className={inputClass + " w-full"}
                >
                  {daysOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">送信時刻</label>
                <div className="flex gap-2">
                  <select
                    value={draft.taskHour}
                    onChange={e => setDraft(prev => ({ ...prev, taskHour: Number(e.target.value) }))}
                    className={inputClass + " flex-1"}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i}時</option>
                    ))}
                  </select>
                  <select
                    value={draft.taskMinute}
                    onChange={e => setDraft(prev => ({ ...prev, taskMinute: Number(e.target.value) }))}
                    className={inputClass + " flex-1"}
                  >
                    <option value={0}>00分</option>
                    <option value={30}>30分</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={() => onSave(draft)}
        className="w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        設定を保存
      </button>

      {/* 次回送信予定 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">次回送信予定</h3>
        {upcomingItems.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            現在送信予定のリマインドはありません
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingItems.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  item.type === "orientation"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                    : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                }`}
              >
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  item.type === "orientation"
                    ? "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
                    : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                }`}>
                  {item.type === "orientation" ? "説明会" : "タスク"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.subject}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.details}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// HistoryTab
// =============================================

function HistoryTab({
  sentLog,
  onClearLog,
}: {
  sentLog: SentLogEntry[];
  onClearLog: () => void;
}) {
  // Sort newest first
  const sorted = [...sentLog].sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {sorted.length} 件の送信履歴
        </p>
        {sorted.length > 0 && (
          <button
            onClick={onClearLog}
            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            履歴を削除
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <MailIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">送信履歴はありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(entry => (
            <div
              key={entry.id + entry.sentAt}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                  entry.type === "orientation"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                }`}>
                  {entry.type === "orientation" ? "説明会" : "タスク"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{entry.subject}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">宛先: {entry.to}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{entry.details}</p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {new Date(entry.sentAt).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

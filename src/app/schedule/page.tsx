"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { EVENT_TYPE_LABELS } from "@/types";
import type { EventType, TimeSlot, Booking, StaffProfile, StaffRole } from "@/types";
import { TrashIcon, EditIcon, CheckIcon, CalendarIcon, CloseIcon, CopyIcon, ExternalLinkIcon, ChevronIcon } from "@/components/Icons";
import Toast from "@/components/Toast";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/googleCalendar";

type Tab = "slots" | "bookings" | "profile";

// =============================================
// ユーティリティ
// =============================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function getWeekDates(baseDate: Date): string[] {
  const dates: string[] = [];
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const GENDER_LABELS: Record<string, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "未確定",
  confirmed: "確定済み",
  cancelled: "キャンセル",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

// =============================================
// メインページ
// =============================================

export default function SchedulePage() {
  const { user, isLoading, calendarAccessToken, requestCalendarAccess, isDemoMode } = useAuth();
  const {
    staffProfiles, timeSlots, bookings, staffRoles,
    addStaffProfile, updateStaffProfile,
    addTimeSlot, addTimeSlots, deleteTimeSlot,
    confirmBooking, cancelBooking,
  } = useSchedule();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("slots");
  const [toast, setToast] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Find this user's staff profile
  const myProfile = staffProfiles.find(p => p.email === user.email);

  const tabs: { id: Tab; label: string }[] = [
    { id: "slots", label: "空き日程" },
    { id: "bookings", label: "予約管理" },
    { id: "profile", label: "スタッフ設定" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">スケジュール管理</h1>

      {/* Booking link for students */}
      <BookingLinkBanner setToast={setToast} />

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "slots" && (
        <SlotsTab
          myProfile={myProfile}
          timeSlots={timeSlots}
          bookings={bookings}
          addTimeSlot={addTimeSlot}
          addTimeSlots={addTimeSlots}
          deleteTimeSlot={deleteTimeSlot}
          setToast={setToast}
          calendarAccessToken={calendarAccessToken}
          requestCalendarAccess={requestCalendarAccess}
          isDemoMode={isDemoMode}
        />
      )}

      {activeTab === "bookings" && (
        <BookingsTab
          bookings={bookings}
          timeSlots={timeSlots}
          staffProfiles={staffProfiles}
          myProfile={myProfile}
          confirmBooking={confirmBooking}
          cancelBooking={cancelBooking}
          setToast={setToast}
        />
      )}

      {activeTab === "profile" && (
        <ProfileTab
          myProfile={myProfile}
          userEmail={user.email}
          staffRoles={staffRoles}
          addStaffProfile={addStaffProfile}
          updateStaffProfile={updateStaffProfile}
          setToast={setToast}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}

// =============================================
// Tab 1: 空き日程（週間カレンダービュー）
// =============================================

// 30分刻みの時間スロット（9:00〜21:00 = 24行）
const CALENDAR_TIMES: string[] = [];
for (let h = 9; h <= 20; h++) {
  CALENDAR_TIMES.push(`${String(h).padStart(2, "0")}:00`);
  CALENDAR_TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

function timeToIndex(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 9) * 2 + (m >= 30 ? 1 : 0);
}

function indexToTime(index: number): string {
  const h = 9 + Math.floor(index / 2);
  const m = index % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

function SlotsTab({
  myProfile,
  timeSlots,
  bookings,
  addTimeSlot,
  addTimeSlots,
  deleteTimeSlot,
  setToast,
  calendarAccessToken,
  requestCalendarAccess,
  isDemoMode,
}: {
  myProfile: StaffProfile | undefined;
  timeSlots: TimeSlot[];
  bookings: Booking[];
  addTimeSlot: (slot: Omit<TimeSlot, "id">) => void;
  addTimeSlots: (slots: Omit<TimeSlot, "id">[]) => void;
  deleteTimeSlot: (id: string) => void;
  setToast: (msg: string) => void;
  calendarAccessToken: string | null;
  requestCalendarAccess: () => void;
  isDemoMode: boolean;
}) {
  type ViewMode = "day" | "week" | "2week" | "month";
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [eventType, setEventType] = useState<EventType>("orientation");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: string; timeIdx: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ day: string; timeIdx: number } | null>(null);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Slot detail popover
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Mobile: date picker mode
  const [mobileSelectedDate, setMobileSelectedDate] = useState<string | null>(null);

  const viewDates = useMemo(() => {
    const base = new Date();
    if (viewMode === "day") {
      base.setDate(base.getDate() + weekOffset);
      return [base.toISOString().split("T")[0]];
    } else if (viewMode === "2week") {
      base.setDate(base.getDate() + weekOffset * 14);
      const w1 = getWeekDates(base);
      const w2base = new Date(base);
      w2base.setDate(w2base.getDate() + 7);
      return [...w1, ...getWeekDates(w2base)];
    } else if (viewMode === "month") {
      const m = new Date(base.getFullYear(), base.getMonth() + weekOffset, 1);
      const start = new Date(m);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
      const dates: string[] = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
      }
      return dates;
    }
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekDates(base);
  }, [weekOffset, viewMode]);

  // For backward compat with existing code that references weekDates
  const weekDates = viewMode === "week" || viewMode === "day" || viewMode === "2week" ? viewDates : viewDates.slice(0, 7);

  // Googleカレンダーのイベントを取得
  useEffect(() => {
    if (!calendarAccessToken || weekDates.length === 0) {
      setCalendarEvents([]);
      return;
    }
    let cancelled = false;
    setCalendarLoading(true);
    const timeMin = new Date(weekDates[0] + "T00:00:00").toISOString();
    const timeMax = new Date(weekDates[6] + "T23:59:59").toISOString();
    fetchCalendarEvents(calendarAccessToken, timeMin, timeMax)
      .then(events => {
        if (!cancelled) setCalendarEvents(events);
      })
      .catch(() => {
        if (!cancelled) {
          setCalendarEvents([]);
          setToast("Googleカレンダーの取得に失敗しました。再度連携してください。");
        }
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });
    return () => { cancelled = true; };
  }, [calendarAccessToken, weekDates, setToast]);

  // カレンダーイベントを日付+時間インデックスでマッピング
  const gcalBlocksByDate = useMemo(() => {
    const map = new Map<string, { ev: CalendarEvent; startIdx: number; spanCount: number }[]>();
    calendarEvents.forEach(ev => {
      const dateStr = ev.start.length > 10 ? ev.start.substring(0, 10) : ev.start;
      if (!weekDates.includes(dateStr)) return;
      const existing = map.get(dateStr) || [];
      if (ev.allDay) {
        existing.push({ ev, startIdx: 0, spanCount: CALENDAR_TIMES.length });
      } else {
        const startH = parseInt(ev.start.substring(11, 13));
        const startM = parseInt(ev.start.substring(14, 16));
        const endH = parseInt(ev.end.substring(11, 13));
        const endM = parseInt(ev.end.substring(14, 16));
        const sIdx = Math.max(0, (startH - 9) * 2 + (startM >= 30 ? 1 : 0));
        const eIdx = Math.min(CALENDAR_TIMES.length, (endH - 9) * 2 + (endM > 0 ? (endM >= 30 ? 2 : 1) : 0));
        if (eIdx > sIdx) {
          existing.push({ ev, startIdx: sIdx, spanCount: eIdx - sIdx });
        }
      }
      map.set(dateStr, existing);
    });
    return map;
  }, [calendarEvents, weekDates]);

  const mySlots = useMemo(() => {
    if (!myProfile) return [];
    return timeSlots.filter(s => s.staffId === myProfile.id);
  }, [timeSlots, myProfile]);

  // Map of date -> timeIndex -> slot for quick lookup
  const slotMap = useMemo(() => {
    const map = new Map<string, Map<number, TimeSlot>>();
    mySlots.forEach(slot => {
      if (!map.has(slot.date)) map.set(slot.date, new Map());
      const dateMap = map.get(slot.date)!;
      const startIdx = timeToIndex(slot.startTime);
      const endIdx = timeToIndex(slot.endTime);
      for (let i = startIdx; i < endIdx; i++) {
        dateMap.set(i, slot);
      }
    });
    return map;
  }, [mySlots]);

  // Slot blocks for rendering
  const slotBlocks = useMemo(() => {
    const blocks: { slot: TimeSlot; startIdx: number; spanCount: number }[] = [];
    const seen = new Set<string>();
    mySlots.forEach(slot => {
      if (seen.has(slot.id)) return;
      seen.add(slot.id);
      if (!weekDates.includes(slot.date)) return;
      const startIdx = timeToIndex(slot.startTime);
      const endIdx = timeToIndex(slot.endTime);
      blocks.push({ slot, startIdx, spanCount: endIdx - startIdx });
    });
    return blocks;
  }, [mySlots, weekDates]);

  const getBookingForSlot = useCallback((slot: TimeSlot): Booking | undefined => {
    if (!slot.bookingId) return undefined;
    return bookings.find(b => b.id === slot.bookingId);
  }, [bookings]);

  // Drag preview calculation
  const dragPreview = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    if (dragStart.day !== dragEnd.day) return null;
    const minIdx = Math.min(dragStart.timeIdx, dragEnd.timeIdx);
    const maxIdx = Math.max(dragStart.timeIdx, dragEnd.timeIdx);
    return {
      day: dragStart.day,
      startIdx: minIdx,
      endIdx: maxIdx + 1,
    };
  }, [isDragging, dragStart, dragEnd]);

  const handleMouseDown = useCallback((day: string, timeIdx: number) => {
    const dateMap = slotMap.get(day);
    if (dateMap?.has(timeIdx)) return;
    setIsDragging(true);
    setDragStart({ day, timeIdx });
    setDragEnd({ day, timeIdx });
  }, [slotMap]);

  const handleMouseEnter = useCallback((day: string, timeIdx: number) => {
    if (!isDragging || !dragStart) return;
    if (day !== dragStart.day) return;
    setDragEnd({ day, timeIdx });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    if (dragStart.day !== dragEnd.day) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const minIdx = Math.min(dragStart.timeIdx, dragEnd.timeIdx);
    const maxIdx = Math.max(dragStart.timeIdx, dragEnd.timeIdx) + 1;
    const effectiveEndIdx = (maxIdx - minIdx < 2) ? Math.min(minIdx + 2, CALENDAR_TIMES.length) : maxIdx;

    const startTimeStr = indexToTime(minIdx);
    const endTimeStr = indexToTime(effectiveEndIdx);

    setConfirmDialog({ date: dragStart.day, startTime: startTimeStr, endTime: endTimeStr });
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd]);

  // Global mouseup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = "none";
    } else {
      document.body.style.userSelect = "";
    }
    return () => { document.body.style.userSelect = ""; };
  }, [isDragging]);

  const handleConfirmAdd = () => {
    if (!confirmDialog || !myProfile) return;
    addTimeSlot({
      staffId: myProfile.id,
      date: confirmDialog.date,
      startTime: confirmDialog.startTime,
      endTime: confirmDialog.endTime,
      eventType,
      isBooked: false,
    });
    setToast("空き枠を追加しました");
    setConfirmDialog(null);
  };

  const handleDeleteSlot = (slotId: string) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (slot?.isBooked) return;
    deleteTimeSlot(slotId);
    setSelectedSlot(null);
    setToast("枠を削除しました");
  };

  // Swipe navigation
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 60) {
      setWeekOffset(w => diff > 0 ? w - 1 : w + 1);
    }
    setTouchStartX(null);
  };

  const handleMobileTimeClick = (date: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const endMin = h * 60 + m + 60;
    if (endMin > 21 * 60) return;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const endTimeStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    setConfirmDialog({ date, startTime: time, endTime: endTimeStr });
  };

  if (!myProfile) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-2">スタッフプロフィールが未登録です</p>
        <p className="text-sm text-gray-400">「スタッフ設定」タブからプロフィールを登録してください。</p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div>
      {/* View mode toggle */}
      <div className="flex items-center gap-1 mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {([["day", "日"], ["week", "週"], ["2week", "2週"], ["month", "月"]] as [ViewMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => { setViewMode(mode); setWeekOffset(0); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === mode
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Navigation + controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronIcon direction="left" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 font-medium"
          >
            {viewMode === "day" ? "今日" : viewMode === "month" ? "今月" : "今週"}
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronIcon direction="right" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">
            {viewMode === "day" ? formatDate(viewDates[0])
              : viewMode === "month" ? `${new Date(viewDates[10]).getFullYear()}年${new Date(viewDates[10]).getMonth() + 1}月`
              : `${formatDate(viewDates[0])} 〜 ${formatDate(viewDates[viewDates.length - 1])}`}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400">種別:</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value as EventType)}
              className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          {/* Google Calendar connect */}
          {!isDemoMode && !calendarAccessToken && (
            <button
              onClick={requestCalendarAccess}
              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Googleカレンダー連携
            </button>
          )}
          {calendarAccessToken && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CalendarIcon className="w-3.5 h-3.5" />
              連携中
              {calendarLoading && <span className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin inline-block" />}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-200 border border-blue-300" />
          <span>空き枠</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
          <span>予約済み</span>
        </div>
        {calendarAccessToken && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-pink-200 border border-pink-300" />
            <span>Googleカレンダー</span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-1.5 ml-auto text-gray-400 dark:text-gray-500">
          <span>ドラッグまたはクリックで枠を追加</span>
        </div>
      </div>

      {/* ===== Month view ===== */}
      {viewMode === "month" && (
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {["月","火","水","木","金","土","日"].map(d => (
              <div key={d} className={`p-2 text-xs font-medium text-center bg-gray-50 dark:bg-gray-900/50 ${d === "日" ? "text-red-500" : d === "土" ? "text-blue-500" : "text-gray-500 dark:text-gray-400"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {viewDates.map(date => {
              const d = new Date(date + "T00:00:00");
              const isToday = date === todayStr;
              const baseMonth = new Date(viewDates[10] + "T00:00:00").getMonth();
              const isCurrentMonth = d.getMonth() === baseMonth;
              const daySlots = mySlots.filter(s => s.date === date);
              return (
                <div
                  key={date}
                  onClick={() => { setViewMode("day"); setWeekOffset(Math.round((new Date(date + "T00:00:00").getTime() - new Date().setHours(0,0,0,0)) / 86400000)); }}
                  className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors ${!isCurrentMonth ? "bg-gray-50 dark:bg-gray-900/30 opacity-50" : ""}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-gray-700 dark:text-gray-300"}`}>
                    {d.getDate()}
                  </div>
                  {daySlots.length > 0 && (
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{daySlots.length}件</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Desktop: Time Grid (day/week/2week) ===== */}
      {viewMode !== "month" && (
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Header row */}
        <div className={`grid border-b border-gray-200 dark:border-gray-700`} style={{ gridTemplateColumns: `60px repeat(${viewDates.length}, 1fr)` }}>
          <div className="p-2 text-xs text-gray-400 dark:text-gray-500 text-center bg-gray-50 dark:bg-gray-900/50">時間</div>
          {viewDates.map(date => {
            const isToday = date === todayStr;
            const d = new Date(date + "T00:00:00");
            const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
            const dayOfWeek = dayNames[d.getDay()];
            const isSun = d.getDay() === 0;
            const isSat = d.getDay() === 6;
            return (
              <div key={date} className={`p-2 text-center border-l border-gray-200 dark:border-gray-700 ${isToday ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-900/50"}`}>
                <div className={`text-xs ${isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-500 dark:text-gray-400"}`}>
                  {dayOfWeek}
                </div>
                <div className={`text-sm font-semibold ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative grid overflow-y-auto" style={{ gridTemplateColumns: `60px repeat(${viewDates.length}, 1fr)`, height: `${CALENDAR_TIMES.length * 28}px` }}>
          {/* Time labels */}
          {CALENDAR_TIMES.map((time, idx) => (
            <div
              key={time}
              className="absolute left-0 w-[60px] text-right pr-2 text-[10px] text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700"
              style={{ top: `${idx * 28}px`, height: "28px", lineHeight: "28px" }}
            >
              {time.endsWith(":00") ? time : ""}
            </div>
          ))}

          {/* Grid cells per day */}
          {viewDates.map((date, dayIdx) => (
            <div key={date} className="absolute" style={{ left: `calc(60px + ${dayIdx} * ((100% - 60px) / ${viewDates.length}))`, width: `calc((100% - 60px) / ${viewDates.length})`, top: 0, height: "100%" }}>
              {CALENDAR_TIMES.map((time, timeIdx) => {
                const isHourLine = time.endsWith(":00");
                const isInPreview = dragPreview &&
                  dragPreview.day === date &&
                  timeIdx >= dragPreview.startIdx &&
                  timeIdx < dragPreview.endIdx;
                const hasSlot = slotMap.get(date)?.has(timeIdx);

                return (
                  <div
                    key={`${date}-${time}`}
                    className={`absolute border-l ${isHourLine ? "border-t border-gray-200 dark:border-gray-700" : "border-t border-gray-100 dark:border-gray-800"} border-gray-200 dark:border-gray-700 ${
                      !hasSlot && !isInPreview ? "hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer" : ""
                    } ${isInPreview ? "bg-blue-100/70 dark:bg-blue-800/40" : ""}`}
                    style={{ top: `${timeIdx * 28}px`, height: "28px", left: 0, right: 0 }}
                    onMouseDown={(e) => { e.preventDefault(); handleMouseDown(date, timeIdx); }}
                    onMouseEnter={() => handleMouseEnter(date, timeIdx)}
                    onMouseUp={() => handleMouseUp()}
                  />
                );
              })}

              {/* Slot blocks overlay */}
              {slotBlocks
                .filter(b => b.slot.date === date)
                .map(({ slot, startIdx, spanCount }) => {
                  const booking = getBookingForSlot(slot);
                  const isConfirmed = booking?.status === "confirmed";
                  const isBooked = slot.isBooked;
                  return (
                    <div
                      key={slot.id}
                      className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-[10px] cursor-pointer overflow-hidden transition-shadow hover:shadow-md z-10 ${
                        isConfirmed
                          ? "bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                          : isBooked
                          ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                          : "bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300"
                      }`}
                      style={{
                        top: `${startIdx * 28 + 1}px`,
                        height: `${spanCount * 28 - 2}px`,
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedSlot(slot); }}
                    >
                      <div className="font-medium leading-tight">{slot.startTime}-{slot.endTime}</div>
                      {spanCount >= 2 && (
                        <div className="opacity-70 truncate">{EVENT_TYPE_LABELS[slot.eventType]}</div>
                      )}
                      {isBooked && spanCount >= 3 && (
                        <div className="opacity-60">{isConfirmed ? "確定済" : "予約済"}</div>
                      )}
                    </div>
                  );
                })}

              {/* Google Calendar event blocks */}
              {(gcalBlocksByDate.get(date) || []).map(({ ev, startIdx, spanCount }) => (
                <div
                  key={`gcal-${ev.id}`}
                  className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-[10px] overflow-hidden z-[5] bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400 opacity-75 pointer-events-none"
                  style={{
                    top: `${startIdx * 28 + 1}px`,
                    height: `${spanCount * 28 - 2}px`,
                  }}
                >
                  <div className="font-medium leading-tight truncate">
                    {ev.allDay ? "終日" : `${ev.start.substring(11, 16)}-${ev.end.substring(11, 16)}`}
                  </div>
                  {spanCount >= 2 && (
                    <div className="truncate opacity-80">{ev.title}</div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Drag preview overlay text */}
          {dragPreview && (
            <div
              className="absolute z-20 pointer-events-none flex items-center justify-center"
              style={{
                left: `calc(60px + ${weekDates.indexOf(dragPreview.day)} * ((100% - 60px) / 7))`,
                width: `calc((100% - 60px) / 7)`,
                top: `${dragPreview.startIdx * 28}px`,
                height: `${(dragPreview.endIdx - dragPreview.startIdx) * 28}px`,
              }}
            >
              <div className="bg-blue-500/80 text-white text-xs font-medium px-2 py-0.5 rounded-full shadow">
                {indexToTime(dragPreview.startIdx)} - {indexToTime(dragPreview.endIdx)}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ===== Mobile: Compact day view with time picker ===== */}
      <div className="md:hidden space-y-2" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {weekDates.map(date => {
          const isToday = date === todayStr;
          const d = new Date(date + "T00:00:00");
          const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
          const dayOfWeek = dayNames[d.getDay()];
          const dateSlots = mySlots.filter(s => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const gcalForDate = calendarEvents.filter(ev => {
            const dateStr = ev.start.length > 10 ? ev.start.substring(0, 10) : ev.start;
            return dateStr === date;
          });
          const isExpanded = mobileSelectedDate === date;

          return (
            <div key={date} className={`bg-white dark:bg-gray-800 rounded-xl border ${isToday ? "border-blue-300 dark:border-blue-600" : "border-gray-200 dark:border-gray-700"} overflow-hidden`}>
              <button
                onClick={() => setMobileSelectedDate(isExpanded ? null : date)}
                className="w-full flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-medium ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                    {d.getMonth() + 1}/{d.getDate()} ({dayOfWeek})
                  </div>
                  {dateSlots.length > 0 && (
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                      {dateSlots.length}枠
                    </span>
                  )}
                </div>
                <ChevronIcon direction={isExpanded ? "down" : "right"} className="w-4 h-4 text-gray-400" />
              </button>

              {/* Existing slots compact */}
              {(dateSlots.length > 0 || gcalForDate.length > 0) && !isExpanded && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {dateSlots.map(slot => {
                    const booking = getBookingForSlot(slot);
                    const isConfirmed = booking?.status === "confirmed";
                    return (
                      <span
                        key={slot.id}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isConfirmed || slot.isBooked
                            ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                            : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {slot.startTime}-{slot.endTime}
                      </span>
                    );
                  })}
                  {gcalForDate.map(ev => (
                    <span key={`gcal-${ev.id}`} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                      {ev.allDay ? "終日" : `${ev.start.substring(11, 16)}`} {ev.title.substring(0, 8)}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded: time picker */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-3">
                  {/* Existing slots in detail */}
                  {dateSlots.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {dateSlots.map(slot => {
                        const booking = getBookingForSlot(slot);
                        const isConfirmed = booking?.status === "confirmed";
                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                              isConfirmed || slot.isBooked
                                ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                                : "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            <div>
                              <span className="font-medium">{slot.startTime}-{slot.endTime}</span>
                              <span className="ml-2 opacity-70">{EVENT_TYPE_LABELS[slot.eventType]}</span>
                              {slot.isBooked && <span className="ml-1 opacity-60">({isConfirmed ? "確定済" : "予約済"})</span>}
                            </div>
                            {!slot.isBooked && (
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Google Calendar events */}
                  {gcalForDate.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {gcalForDate.map(ev => (
                        <div key={`gcal-${ev.id}`} className="rounded-lg px-3 py-2 text-xs bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400 opacity-75">
                          <span className="font-medium">{ev.allDay ? "終日" : `${ev.start.substring(11, 16)}-${ev.end.substring(11, 16)}`}</span>
                          <span className="ml-2">{ev.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time buttons for adding */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">タップで1時間枠を追加:</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CALENDAR_TIMES.filter(t => {
                      const [h, m] = t.split(":").map(Number);
                      return h * 60 + m + 60 <= 21 * 60;
                    }).map(time => {
                      const dateMap = slotMap.get(date);
                      const idx = timeToIndex(time);
                      const hasSlot = dateMap?.has(idx);
                      return (
                        <button
                          key={time}
                          disabled={!!hasSlot}
                          onClick={() => handleMobileTimeClick(date, time)}
                          className={`py-1.5 text-xs rounded-md transition-colors ${
                            hasSlot
                              ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                              : "border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700"
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Confirm Dialog ===== */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">空き枠を追加</h3>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 mb-4">
                <div className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {formatDate(confirmDialog.date)}
                </div>
                <div className="text-lg font-bold text-blue-900 dark:text-blue-200 mt-1">
                  {confirmDialog.startTime} 〜 {confirmDialog.endTime}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">イベント種別</label>
                <select
                  value={eventType}
                  onChange={e => setEventType(e.target.value as EventType)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmAdd}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  追加する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Slot Detail Popover ===== */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSlot(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">枠の詳細</h3>
                <button onClick={() => setSelectedSlot(null)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">日付</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selectedSlot.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">時間</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedSlot.startTime} - {selectedSlot.endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">種別</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{EVENT_TYPE_LABELS[selectedSlot.eventType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">状態</span>
                  <span className={`font-medium ${
                    selectedSlot.isBooked ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"
                  }`}>
                    {selectedSlot.isBooked
                      ? (getBookingForSlot(selectedSlot)?.status === "confirmed" ? "確定済み" : "予約済み")
                      : "空き"
                    }
                  </span>
                </div>
              </div>
              {!selectedSlot.isBooked && (
                <button
                  onClick={() => handleDeleteSlot(selectedSlot.id)}
                  className="w-full mt-4 flex items-center justify-center gap-1.5 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" /> 削除する
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// Tab 2: 予約管理
// =============================================

function BookingsTab({
  bookings,
  timeSlots,
  staffProfiles,
  myProfile,
  confirmBooking,
  cancelBooking,
  setToast,
}: {
  bookings: Booking[];
  timeSlots: TimeSlot[];
  staffProfiles: StaffProfile[];
  myProfile: StaffProfile | undefined;
  confirmBooking: (bookingId: string, slotId: string, staffId: string) => void;
  cancelBooking: (bookingId: string) => void;
  setToast: (msg: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");
  const [confirmingBookingId, setConfirmingBookingId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const filteredBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (statusFilter === "all") return sorted;
    return sorted.filter(b => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const getSlot = (id: string) => timeSlots.find(s => s.id === id);
  const getStaff = (id: string) => staffProfiles.find(p => p.id === id);

  const handleConfirm = (booking: Booking) => {
    if (!selectedSlotId || !myProfile) return;
    confirmBooking(booking.id, selectedSlotId, myProfile.id);
    setConfirmingBookingId(null);
    setSelectedSlotId(null);
    setToast("予約を確定しました");
  };

  const handleCancel = (bookingId: string) => {
    if (confirm("この予約をキャンセルしますか？")) {
      cancelBooking(bookingId);
      setToast("予約をキャンセルしました");
    }
  };

  return (
    <div>
      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "pending", "confirmed", "cancelled"] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === status
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {status === "all" ? "すべて" : STATUS_LABELS[status]}
            {status !== "all" && (
              <span className="ml-1">({bookings.filter(b => b.status === status).length})</span>
            )}
          </button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-400 text-sm">予約がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map(booking => (
            <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{booking.studentName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[booking.status]}`}>
                      {STATUS_LABELS[booking.status]}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                      {EVENT_TYPE_LABELS[booking.eventType]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 break-all">
                    {booking.studentEmail} / {booking.bookingNumber}
                  </div>
                </div>
              </div>

              {/* Selected slots */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1.5">
                  {booking.status === "confirmed" ? "確定枠:" : "希望枠:"}
                </p>
                {booking.status === "confirmed" && booking.confirmedSlotId ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const slot = getSlot(booking.confirmedSlotId);
                      const staff = booking.assignedStaffId ? getStaff(booking.assignedStaffId) : undefined;
                      return slot ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs text-green-700">
                          <span className="font-medium">{formatDate(slot.date)} {slot.startTime}-{slot.endTime}</span>
                          {staff && <span className="ml-2 opacity-70">担当: {staff.lastName}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">枠情報なし</span>
                      );
                    })()}
                    {booking.meetLink && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 break-all">
                        Meet: {booking.meetLink}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {booking.selectedSlotIds.map(slotId => {
                      const slot = getSlot(slotId);
                      const isSelected = confirmingBookingId === booking.id && selectedSlotId === slotId;
                      return slot ? (
                        <button
                          key={slotId}
                          disabled={booking.status !== "pending" || confirmingBookingId !== booking.id}
                          onClick={() => {
                            if (confirmingBookingId === booking.id) {
                              setSelectedSlotId(slotId);
                            }
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white border border-blue-600"
                              : confirmingBookingId === booking.id
                              ? "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer"
                              : "bg-gray-50 border border-gray-200 text-gray-600"
                          }`}
                        >
                          {formatDate(slot.date)} {slot.startTime}-{slot.endTime}
                        </button>
                      ) : (
                        <span key={slotId} className="text-xs text-gray-300 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                          不明な枠
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              {booking.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
                  {confirmingBookingId === booking.id ? (
                    <>
                      <p className="text-xs text-blue-600 flex-1 self-center min-w-[150px]">枠を選択して「確定」を押してください</p>
                      <button
                        onClick={() => { setConfirmingBookingId(null); setSelectedSlotId(null); }}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        戻る
                      </button>
                      <button
                        onClick={() => handleConfirm(booking)}
                        disabled={!selectedSlotId}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          selectedSlotId
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <CheckIcon className="w-3.5 h-3.5" /> 確定
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmingBookingId(booking.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <CheckIcon className="w-3.5 h-3.5" /> 確定する
                      </button>
                      <button
                        onClick={() => handleCancel(booking.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        <CloseIcon className="w-3.5 h-3.5" /> キャンセル
                      </button>
                    </>
                  )}
                </div>
              )}

              {booking.status === "confirmed" && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <CloseIcon className="w-3.5 h-3.5" /> キャンセル
                  </button>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-[10px] text-gray-300 mt-2">
                作成: {new Date(booking.createdAt).toLocaleString("ja-JP")}
                {booking.updatedAt !== booking.createdAt && (
                  <span className="ml-2">更新: {new Date(booking.updatedAt).toLocaleString("ja-JP")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// 予約リンク共有バナー
// =============================================

function BookingLinkBanner({ setToast }: { setToast: (msg: string) => void }) {
  const [copied, setCopied] = useState(false);
  const basePath = process.env.NODE_ENV === "production" ? "/57-tokyo-g3" : "";
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}${basePath}/book`
    : "/book";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setToast("予約URLをコピーしました");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast("コピーに失敗しました");
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <ExternalLinkIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">学生向け予約ページ</p>
          <p className="text-xs text-gray-500 mb-2">以下のリンクを学生に共有してください。ログイン不要で予約できます。</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
              {bookingUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <CopyIcon className="w-3.5 h-3.5" />
              {copied ? "コピー済み" : "URLをコピー"}
            </button>
            <a
              href="/book"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5" />
              開く
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Tab 3: スタッフ設定
// =============================================

function ProfileTab({
  myProfile,
  userEmail,
  staffRoles,
  addStaffProfile,
  updateStaffProfile,
  setToast,
}: {
  myProfile: StaffProfile | undefined;
  userEmail: string;
  staffRoles: StaffRole[];
  addStaffProfile: (profile: Omit<StaffProfile, "id">) => void;
  updateStaffProfile: (id: string, profile: Partial<StaffProfile>) => void;
  setToast: (msg: string) => void;
}) {
  const [lastName, setLastName] = useState(myProfile?.lastName ?? "");
  const [fullName, setFullName] = useState(myProfile?.fullName ?? "");
  const [furigana, setFurigana] = useState(myProfile?.furigana ?? "");
  const [grade, setGrade] = useState(myProfile?.grade ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other">(myProfile?.gender ?? "male");
  const [nearestStation, setNearestStation] = useState(myProfile?.nearestStation ?? "");
  const [isEditing, setIsEditing] = useState(!myProfile);

  // Sync form when profile changes
  useEffect(() => {
    if (myProfile) {
      setLastName(myProfile.lastName);
      setFullName(myProfile.fullName ?? "");
      setFurigana(myProfile.furigana ?? "");
      setGrade(myProfile.grade);
      setGender(myProfile.gender);
      setNearestStation(myProfile.nearestStation ?? "");
    }
  }, [myProfile]);

  const handleSave = () => {
    if (!lastName.trim() || !grade.trim()) return;
    if (myProfile) {
      updateStaffProfile(myProfile.id, { lastName: lastName.trim(), fullName: fullName.trim() || undefined, furigana: furigana.trim() || undefined, grade: grade.trim(), gender, roleIds: myProfile.roleIds ?? [], nearestStation: nearestStation.trim() || undefined });
      setToast("プロフィールを更新しました");
    } else {
      addStaffProfile({ email: userEmail, lastName: lastName.trim(), fullName: fullName.trim() || undefined, furigana: furigana.trim() || undefined, grade: grade.trim(), gender, roleIds: [], nearestStation: nearestStation.trim() || undefined });
      setToast("プロフィールを登録しました");
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">スタッフプロフィール</h2>
        {myProfile && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <EditIcon className="w-3.5 h-3.5" /> 編集
          </button>
        )}
      </div>

      {!isEditing && myProfile ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 font-bold text-lg">{myProfile.lastName.charAt(0)}</span>
            </div>
            <div>
              <div className="font-medium text-gray-900">{myProfile.fullName || myProfile.lastName}</div>
              {myProfile.furigana && <div className="text-xs text-gray-400">{myProfile.furigana}</div>}
              <div className="text-sm text-gray-500">{myProfile.grade} / {GENDER_LABELS[myProfile.gender]}</div>
            </div>
          </div>
          {myProfile.roleIds && myProfile.roleIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {myProfile.roleIds.map(roleId => {
                const role = staffRoles.find(r => r.id === roleId);
                return role ? (
                  <span key={roleId} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5">
                    {role.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
          {myProfile.nearestStation && (
            <div className="text-sm text-gray-600">
              <span className="text-xs text-gray-400">最寄駅:</span> {myProfile.nearestStation}
            </div>
          )}
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            メールアドレス: {myProfile.email}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">苗字 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="例: 田中"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">本名（フルネーム）</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="例: 田中太郎"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ふりがな</label>
              <input
                type="text"
                value={furigana}
                onChange={e => setFurigana(e.target.value)}
                placeholder="例: たなかたろう"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">学年 <span className="text-red-500">*</span></label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              <option value="1年">1年</option>
              <option value="2年">2年</option>
              <option value="3年">3年</option>
              <option value="4年">4年</option>
              <option value="M1">M1</option>
              <option value="M2">M2</option>
              <option value="D1">D1</option>
              <option value="その他">その他</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">性別</label>
            <div className="flex gap-3">
              {(["male", "female", "other"] as const).map(g => (
                <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={gender === g}
                    onChange={() => setGender(g)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{GENDER_LABELS[g]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">役職・部署</label>
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
              {(myProfile?.roleIds ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(myProfile?.roleIds ?? []).map(roleId => {
                    const role = staffRoles.find(r => r.id === roleId);
                    return role ? (
                      <span key={roleId} className="text-xs bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-600 rounded-full px-2.5 py-0.5">
                        {role.name}
                      </span>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">未設定</p>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">ロールの変更は管理者パネルから行えます</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">最寄駅</label>
            <input
              type="text"
              value={nearestStation}
              onChange={e => setNearestStation(e.target.value)}
              placeholder="参宮橋駅 / 代々木八幡バス停"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">バス停も入力可能です</p>
          </div>

          <div className="text-xs text-gray-400">
            メールアドレス: {userEmail}
          </div>

          <div className="flex gap-2 pt-2">
            {myProfile && (
              <button
                onClick={() => { setIsEditing(false); setLastName(myProfile.lastName); setFullName(myProfile.fullName ?? ""); setFurigana(myProfile.furigana ?? ""); setGrade(myProfile.grade); setGender(myProfile.gender); setNearestStation(myProfile.nearestStation ?? ""); }}
                className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!lastName.trim() || !grade.trim()}
              className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                lastName.trim() && grade.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {myProfile ? "更新" : "登録"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

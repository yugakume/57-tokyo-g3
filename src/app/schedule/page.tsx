"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { EVENT_TYPE_LABELS } from "@/types";
import type { EventType, TimeSlot, Booking, StaffProfile, StaffRole } from "@/types";
import { PlusIcon, TrashIcon, EditIcon, CheckIcon, CalendarIcon, CloseIcon, CopyIcon, ExternalLinkIcon } from "@/components/Icons";
import Toast from "@/components/Toast";

type Tab = "slots" | "bookings" | "profile";

// =============================================
// ユーティリティ
// =============================================

const TIME_OPTIONS: string[] = [];
for (let h = 9; h <= 20; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 20) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

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

function getNext14Days(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
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
  const { user, isLoading } = useAuth();
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
// Tab 1: 空き日程
// =============================================

function SlotsTab({
  myProfile,
  timeSlots,
  bookings,
  addTimeSlot,
  addTimeSlots,
  deleteTimeSlot,
  setToast,
}: {
  myProfile: StaffProfile | undefined;
  timeSlots: TimeSlot[];
  bookings: Booking[];
  addTimeSlot: (slot: Omit<TimeSlot, "id">) => void;
  addTimeSlots: (slots: Omit<TimeSlot, "id">[]) => void;
  deleteTimeSlot: (id: string) => void;
  setToast: (msg: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekDates(base);
  }, [weekOffset]);

  // Filter slots for this staff member
  const mySlots = useMemo(() => {
    if (!myProfile) return [];
    return timeSlots.filter(s => s.staffId === myProfile.id);
  }, [timeSlots, myProfile]);

  if (!myProfile) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-2">スタッフプロフィールが未登録です</p>
        <p className="text-sm text-gray-400">「スタッフ設定」タブからプロフィールを登録してください。</p>
      </div>
    );
  }

  // Group slots by date
  const slotsByDate = new Map<string, TimeSlot[]>();
  mySlots.forEach(slot => {
    const existing = slotsByDate.get(slot.date) || [];
    existing.push(slot);
    slotsByDate.set(slot.date, existing);
  });

  // Sort slots within each date
  slotsByDate.forEach((slots) => {
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  const handleDelete = (slotId: string) => {
    const slot = timeSlots.find(s => s.id === slotId);
    if (slot?.isBooked) return;
    deleteTimeSlot(slotId);
    setToast("枠を削除しました");
  };

  // Find the booking for a booked slot
  const getBookingForSlot = (slot: TimeSlot): Booking | undefined => {
    if (!slot.bookingId) return undefined;
    return bookings.find(b => b.id === slot.bookingId);
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          &larr; 前週
        </button>
        <div className="text-sm font-medium text-gray-700">
          {formatDate(weekDates[0])} 〜 {formatDate(weekDates[6])}
        </div>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          次週 &rarr;
        </button>
      </div>

      {/* Add slot button */}
      <div className="mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> 空き枠を追加
        </button>
      </div>

      {/* Weekly calendar view */}
      {/* Desktop: columns, Mobile: rows */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {weekDates.map(date => {
          const slots = slotsByDate.get(date) || [];
          const isToday = date === new Date().toISOString().split("T")[0];
          return (
            <div key={date} className={`bg-white dark:bg-gray-800 rounded-xl border ${isToday ? "border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-800" : "border-gray-200 dark:border-gray-700"} p-3 min-h-[160px]`}>
              <div className={`text-xs font-medium mb-2 ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                {formatDate(date)}
              </div>
              {slots.length === 0 && (
                <p className="text-xs text-gray-300 mt-4 text-center">枠なし</p>
              )}
              <div className="space-y-1.5">
                {slots.map(slot => {
                  const booking = getBookingForSlot(slot);
                  const isConfirmed = booking?.status === "confirmed";
                  return (
                    <div
                      key={slot.id}
                      className={`rounded-lg px-2 py-1.5 text-xs relative group ${
                        isConfirmed
                          ? "bg-green-50 border border-green-200 text-green-700"
                          : slot.isBooked
                          ? "bg-gray-100 border border-gray-200 text-gray-400"
                          : "bg-blue-50 border border-blue-200 text-blue-700"
                      }`}
                    >
                      <div className="font-medium">{slot.startTime}-{slot.endTime}</div>
                      <div className="text-[10px] opacity-70">{EVENT_TYPE_LABELS[slot.eventType]}</div>
                      {slot.isBooked && (
                        <div className="text-[10px] mt-0.5">
                          {isConfirmed ? "確定済" : "予約済"}
                        </div>
                      )}
                      {!slot.isBooked && (
                        <button
                          onClick={() => handleDelete(slot.id)}
                          className="absolute top-1 right-1 p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: stacked rows */}
      <div className="md:hidden space-y-2">
        {weekDates.map(date => {
          const slots = slotsByDate.get(date) || [];
          const isToday = date === new Date().toISOString().split("T")[0];
          return (
            <div key={date} className={`bg-white dark:bg-gray-800 rounded-xl border ${isToday ? "border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-800" : "border-gray-200 dark:border-gray-700"} p-3`}>
              <div className={`text-sm font-medium mb-2 ${isToday ? "text-blue-600" : "text-gray-700"}`}>
                {formatDate(date)}
              </div>
              {slots.length === 0 ? (
                <p className="text-xs text-gray-300">枠なし</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots.map(slot => {
                    const booking = getBookingForSlot(slot);
                    const isConfirmed = booking?.status === "confirmed";
                    return (
                      <div
                        key={slot.id}
                        className={`rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5 ${
                          isConfirmed
                            ? "bg-green-50 border border-green-200 text-green-700"
                            : slot.isBooked
                            ? "bg-gray-100 border border-gray-200 text-gray-400"
                            : "bg-blue-50 border border-blue-200 text-blue-700"
                        }`}
                      >
                        <span className="font-medium">{slot.startTime}-{slot.endTime}</span>
                        <span className="opacity-70">{EVENT_TYPE_LABELS[slot.eventType]}</span>
                        {slot.isBooked && (
                          <span className="text-[10px]">{isConfirmed ? "確定済" : "予約済"}</span>
                        )}
                        {!slot.isBooked && (
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Slot Modal */}
      {showModal && (
        <AddSlotModal
          staffId={myProfile.id}
          onAdd={(slots) => {
            if (slots.length === 1) {
              addTimeSlot(slots[0]);
              setToast("空き枠を追加しました");
            } else {
              addTimeSlots(slots);
              setToast(`${slots.length}件の空き枠を追加しました`);
            }
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// =============================================
// 空き枠追加モーダル
// =============================================

function AddSlotModal({
  staffId,
  onAdd,
  onClose,
}: {
  staffId: string;
  onAdd: (slots: Omit<TimeSlot, "id">[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [eventType, setEventType] = useState<EventType>("orientation");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const next14Days = useMemo(() => getNext14Days(), []);

  // 終了時間は開始時間 + 1時間で自動計算
  const endTime = useMemo(() => {
    const [h, m] = startTime.split(":").map(Number);
    const totalMin = h * 60 + m + 60;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }, [startTime]);

  const toggleDate = (d: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const handleSubmit = () => {
    if (bulkMode) {
      if (selectedDates.size === 0) return;
      const slots = Array.from(selectedDates).map(d => ({
        staffId,
        date: d,
        startTime,
        endTime,
        eventType,
        isBooked: false,
      }));
      onAdd(slots);
    } else {
      onAdd([{ staffId, date, startTime, endTime, eventType, isBooked: false }]);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">空き枠を追加</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Bulk toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkMode}
              onChange={e => setBulkMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">複数日に追加</span>
          </label>

          {/* Date selection */}
          {bulkMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">日程を選択</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {next14Days.map(d => (
                  <label
                    key={d}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                      selectedDates.has(d) ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDates.has(d)}
                      onChange={() => toggleDate(d)}
                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    {formatDate(d)}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">日付</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">開始時間</label>
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_OPTIONS.filter(t => {
                  const [h, m] = t.split(":").map(Number);
                  return h * 60 + m + 60 <= 21 * 60; // 終了が21:00以内
                }).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">終了時間</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700">
                {endTime}
              </div>
              <p className="text-xs text-gray-400 mt-1">※ 説明会1時間</p>
            </div>
          </div>

          {/* Event type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">イベント種別</label>
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

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {bulkMode ? `${selectedDates.size}件追加` : "追加"}
            </button>
          </div>
        </div>
      </div>
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
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(myProfile?.roleIds ?? []);
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
      setSelectedRoleIds(myProfile.roleIds ?? []);
      setNearestStation(myProfile.nearestStation ?? "");
    }
  }, [myProfile]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const getRoleNames = (roleIds: string[]) => {
    return roleIds
      .map(id => staffRoles.find(r => r.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  const handleSave = () => {
    if (!lastName.trim() || !grade.trim()) return;
    if (myProfile) {
      updateStaffProfile(myProfile.id, { lastName: lastName.trim(), fullName: fullName.trim() || undefined, furigana: furigana.trim() || undefined, grade: grade.trim(), gender, roleIds: selectedRoleIds, nearestStation: nearestStation.trim() || undefined });
      setToast("プロフィールを更新しました");
    } else {
      addStaffProfile({ email: userEmail, lastName: lastName.trim(), fullName: fullName.trim() || undefined, furigana: furigana.trim() || undefined, grade: grade.trim(), gender, roleIds: selectedRoleIds, nearestStation: nearestStation.trim() || undefined });
      setToast("プロフィールを登録しました");
    }
    setIsEditing(false);
  };

  const sortedRoles = [...staffRoles].sort((a, b) => a.order - b.order);

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
            <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              {sortedRoles.length === 0 ? (
                <p className="text-xs text-gray-400">ロールが登録されていません。管理パネルから追加してください。</p>
              ) : (
                sortedRoles.map(role => (
                  <label key={role.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                    selectedRoleIds.includes(role.id) ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50"
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    {role.name}
                  </label>
                ))
              )}
            </div>
            {selectedRoleIds.length > 0 && (
              <p className="text-xs text-indigo-600 mt-1">{getRoleNames(selectedRoleIds)}</p>
            )}
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
                onClick={() => { setIsEditing(false); setLastName(myProfile.lastName); setFullName(myProfile.fullName ?? ""); setFurigana(myProfile.furigana ?? ""); setGrade(myProfile.grade); setGender(myProfile.gender); setSelectedRoleIds(myProfile.roleIds ?? []); setNearestStation(myProfile.nearestStation ?? ""); }}
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

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSchedule } from "@/contexts/ScheduleContext";
import { EVENT_TYPE_LABELS } from "@/types";
import type { Booking, StaffProfile, TimeSlot, BookingStatus } from "@/types";

// ─── Helpers ───────────────────────────────────────────────
const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "仮予約中",
  confirmed: "確定済み",
  cancelled: "キャンセル済み",
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const GENDER_ICON: Record<string, string> = {
  male: "\u2642",
  female: "\u2640",
  other: "",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

function buildGoogleCalendarUrl(params: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  details: string;
  meetLink?: string;
}): string {
  const { title, date, startTime, endTime, details, meetLink } = params;
  // Format: 20260325T100000/20260325T110000
  const datePart = date.replace(/-/g, "");
  const start = `${datePart}T${startTime.replace(":", "")}00`;
  const end = `${datePart}T${endTime.replace(":", "")}00`;

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${start}/${end}`);
  url.searchParams.set("details", details);
  if (meetLink) {
    url.searchParams.set("location", meetLink);
  }
  return url.toString();
}

// ─── Page ──────────────────────────────────────────────────
export default function BookingPage() {
  const { staffProfiles, timeSlots, getBookingByNumber, updateBookingSlots } = useSchedule();

  // Lookup state
  const [bookingNumber, setBookingNumber] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [newSlotIds, setNewSlotIds] = useState<string[]>([]);
  const [updateError, setUpdateError] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Staff map
  const staffMap = useMemo(() => {
    const m: Record<string, StaffProfile> = {};
    staffProfiles.forEach((s) => (m[s.id] = s));
    return m;
  }, [staffProfiles]);

  // Slot map
  const slotMap = useMemo(() => {
    const m: Record<string, TimeSlot> = {};
    timeSlots.forEach((ts) => (m[ts.id] = ts));
    return m;
  }, [timeSlots]);

  // Available slots for re-selection (orientation, not booked or already in this booking)
  const availableSlots = useMemo(() => {
    if (!booking) return [];
    return timeSlots.filter(
      (ts) =>
        ts.eventType === "orientation" &&
        (!ts.isBooked || booking.selectedSlotIds.includes(ts.id))
    );
  }, [timeSlots, booking]);

  // Group available slots by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, TimeSlot[]> = {};
    availableSlots.forEach((ts) => {
      if (!groups[ts.date]) groups[ts.date] = [];
      groups[ts.date].push(ts);
    });
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    sorted.forEach(([, slots]) => slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return sorted;
  }, [availableSlots]);

  // ─── Lookup booking ──────────────────────────────────
  const handleLookup = async () => {
    if (!bookingNumber.trim()) {
      setLookupError("予約番号を入力してください");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setLookupError("メールアドレスを入力してください");
      return;
    }
    setLookupError("");
    setLookupLoading(true);
    try {
      const result = await getBookingByNumber(bookingNumber.trim(), email.trim());
      if (result) {
        setBooking(result);
      } else {
        setLookupError("予約が見つかりません。予約番号とメールアドレスをご確認ください。");
      }
    } catch {
      setLookupError("検索に失敗しました。もう一度お試しください。");
    } finally {
      setLookupLoading(false);
    }
  };

  // ─── Update slots ────────────────────────────────────
  const handleUpdate = async () => {
    if (!booking) return;
    if (newSlotIds.length === 0) {
      setUpdateError("少なくとも1つの日時を選択してください");
      return;
    }
    setUpdateError("");
    setUpdateLoading(true);
    try {
      updateBookingSlots(booking.id, newSlotIds);
      setBooking({ ...booking, selectedSlotIds: newSlotIds, updatedAt: new Date().toISOString() });
      setEditing(false);
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 5000);
    } catch {
      setUpdateError("日程変更に失敗しました。もう一度お試しください。");
    } finally {
      setUpdateLoading(false);
    }
  };

  const toggleSlot = (id: string) => {
    setNewSlotIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const startEditing = () => {
    if (booking) {
      setNewSlotIds([...booking.selectedSlotIds]);
      setEditing(true);
      setUpdateSuccess(false);
    }
  };

  // ─── Confirmed slot info for calendar ────────────────
  const confirmedSlot = booking?.confirmedSlotId ? slotMap[booking.confirmedSlotId] : null;
  const confirmedStaff = confirmedSlot ? staffMap[confirmedSlot.staffId] : null;

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-xl">Lueur</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">予約確認・変更</h1>
          <p className="text-sm text-gray-500">予約番号とメールアドレスで確認できます</p>
        </div>

        {/* Lookup form (show when no booking loaded) */}
        {!booking && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="bookingNum" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  予約番号
                </label>
                <input
                  id="bookingNum"
                  type="text"
                  value={bookingNumber}
                  onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                  placeholder="BK-A3X9K2"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="lookupEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  メールアドレス
                </label>
                <input
                  id="lookupEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@university.ac.jp"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {lookupError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{lookupError}</p>
                </div>
              )}

              <button
                onClick={handleLookup}
                disabled={lookupLoading}
                className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
              >
                {lookupLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    検索中...
                  </span>
                ) : (
                  "予約を検索"
                )}
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
              <p className="text-xs text-gray-400">
                まだ予約していない方は
                <Link href="/book" className="text-blue-600 hover:underline ml-0.5">
                  こちら
                </Link>
                から予約できます
              </p>
            </div>
          </div>
        )}

        {/* Booking details */}
        {booking && !editing && (
          <div className="space-y-4">
            {/* Success banner */}
            {updateSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-green-700 font-medium">日程を変更しました</p>
              </div>
            )}

            {/* Status card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">予約番号</p>
                  <p className="font-mono font-bold text-lg text-gray-900 dark:text-gray-100">{booking.bookingNumber}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[booking.status]}`}
                >
                  {STATUS_LABELS[booking.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400">お名前</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{booking.studentName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">種別</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{EVENT_TYPE_LABELS[booking.eventType]}</p>
                </div>
              </div>

              {/* Selected time slots */}
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">
                  {booking.status === "confirmed" ? "確定日時" : "希望日時"}
                </p>
                <div className="space-y-2">
                  {booking.status === "confirmed" && confirmedSlot ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {formatDate(confirmedSlot.date)} {confirmedSlot.startTime}〜{confirmedSlot.endTime}
                        </p>
                        {confirmedStaff && (
                          <p className="text-xs text-gray-500">
                            担当: {confirmedStaff.lastName}（{confirmedStaff.grade}）
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    booking.selectedSlotIds.map((slotId) => {
                      const slot = slotMap[slotId];
                      if (!slot) return null;
                      const staff = staffMap[slot.staffId];
                      return (
                        <div
                          key={slotId}
                          className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                        >
                          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(slot.date)} {slot.startTime}〜{slot.endTime}
                            </p>
                            {staff && (
                              <p className="text-xs text-gray-500">
                                {staff.lastName}（{staff.grade}）{GENDER_ICON[staff.gender]}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Meet link (confirmed only) */}
              {booking.status === "confirmed" && booking.meetLink && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-600 font-medium mb-1">Google Meet リンク</p>
                  <a
                    href={booking.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-700 font-medium hover:underline break-all"
                  >
                    {booking.meetLink}
                  </a>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {/* Google Calendar button (confirmed only) */}
                {booking.status === "confirmed" && confirmedSlot && (
                  <a
                    href={buildGoogleCalendarUrl({
                      title: `ドットジェイピー ${EVENT_TYPE_LABELS[booking.eventType]}`,
                      date: confirmedSlot.date,
                      startTime: confirmedSlot.startTime,
                      endTime: confirmedSlot.endTime,
                      details: `予約番号: ${booking.bookingNumber}\n担当: ${confirmedStaff?.lastName ?? ""}\n\n${booking.meetLink ? `Meet: ${booking.meetLink}` : ""}`,
                      meetLink: booking.meetLink,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-blue-200 text-blue-700 font-medium rounded-xl hover:bg-blue-50 transition-colors text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Google カレンダーに追加
                  </a>
                )}

                {/* Change slots button (pending only) */}
                {booking.status === "pending" && (
                  <button
                    onClick={startEditing}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm shadow-sm"
                  >
                    日程を変更する
                  </button>
                )}

                {/* Back button */}
                <button
                  onClick={() => {
                    setBooking(null);
                    setBookingNumber("");
                    setEmail("");
                    setUpdateSuccess(false);
                  }}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  別の予約を検索
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit mode: re-select slots */}
        {booking && editing && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">日程を変更</h2>
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  キャンセル
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                変更したい日時を選び直してください（複数選択可）
              </p>

              {groupedByDate.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-500">現在予約可能な枠がありません</p>
                </div>
              ) : (
                <div className="space-y-4 mb-4">
                  {groupedByDate.map(([date, slots]) => (
                    <div key={date}>
                      <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(date)}
                      </h3>
                      <div className="grid grid-cols-1 gap-2">
                        {slots.map((slot) => {
                          const staff = staffMap[slot.staffId];
                          const isSelected = newSlotIds.includes(slot.id);
                          return (
                            <button
                              key={slot.id}
                              onClick={() => toggleSlot(slot.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 shadow-sm"
                                  : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-600 hover:bg-blue-50/30 dark:hover:bg-blue-900/20"
                              }`}
                              style={{ minHeight: 56 }}
                            >
                              <div
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-blue-600 border-blue-600"
                                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                }`}
                              >
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                {slot.startTime}〜{slot.endTime}
                              </div>
                              {staff && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">
                                  <span className="font-medium">{staff.lastName}</span>
                                  <span className="text-xs text-gray-400">{staff.grade}</span>
                                  <span className="text-xs">{GENDER_ICON[staff.gender]}</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {newSlotIds.length > 0 && (
                <div className="mb-4 p-2 bg-blue-50 rounded-lg text-center">
                  <span className="text-sm text-blue-700 font-medium">
                    {newSlotIds.length}件選択中
                  </span>
                </div>
              )}

              {updateError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-600">{updateError}</p>
                </div>
              )}

              <button
                onClick={handleUpdate}
                disabled={updateLoading || newSlotIds.length === 0}
                className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
              >
                {updateLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    変更中...
                  </span>
                ) : (
                  "日程を変更する"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 mb-4">
          <p className="text-xs text-gray-400">
            新規予約は
            <Link href="/book" className="text-blue-600 hover:underline ml-0.5">
              こちら
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

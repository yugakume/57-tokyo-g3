"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSchedule } from "@/contexts/ScheduleContext";
import { EVENT_TYPE_LABELS } from "@/types";
import type { StaffProfile, TimeSlot } from "@/types";

// ─── Helpers ───────────────────────────────────────────────
const GRADE_FILTERS = ["すべて", "1年", "2年", "3年", "4年"] as const;
const GENDER_FILTERS = [
  { label: "すべて", value: "all" },
  { label: "男性", value: "male" },
  { label: "女性", value: "female" },
] as const;

const GENDER_ICON: Record<string, string> = {
  male: "\u2642",
  female: "\u2640",
  other: "",
};

const GENDER_LABEL: Record<string, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

// ─── Step indicator ────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = [
    { num: 1, label: "絞り込み" },
    { num: 2, label: "日時選択" },
    { num: 3, label: "情報入力" },
    { num: 4, label: "完了" },
  ];
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                current >= s.num
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {current > s.num ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.num
              )}
            </div>
            <span
              className={`text-[10px] mt-1 whitespace-nowrap ${
                current >= s.num ? "text-blue-600 font-medium" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-6 sm:w-10 h-0.5 mx-1 -mt-4 ${
                current > s.num ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────
export default function BookPage() {
  const { staffProfiles, timeSlots, staffRoles, createBooking } = useSchedule();

  // Filters
  const [gradeFilter, setGradeFilter] = useState("すべて");
  const [genderFilter, setGenderFilter] = useState("all");

  // Selections
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);

  // Form
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  // State
  const [submitting, setSubmitting] = useState(false);
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Build staff map
  const staffMap = useMemo(() => {
    const m: Record<string, StaffProfile> = {};
    staffProfiles.forEach((s) => (m[s.id] = s));
    return m;
  }, [staffProfiles]);

  // Available slots (not booked, orientation only)
  const availableSlots = useMemo(() => {
    return timeSlots.filter((ts) => !ts.isBooked && ts.eventType === "orientation");
  }, [timeSlots]);

  // Filtered slots
  const filteredSlots = useMemo(() => {
    return availableSlots.filter((ts) => {
      const staff = staffMap[ts.staffId];
      if (!staff) return false;
      if (gradeFilter !== "すべて" && staff.grade !== gradeFilter) return false;
      if (genderFilter !== "all" && staff.gender !== genderFilter) return false;
      return true;
    });
  }, [availableSlots, staffMap, gradeFilter, genderFilter]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, TimeSlot[]> = {};
    filteredSlots.forEach((ts) => {
      if (!groups[ts.date]) groups[ts.date] = [];
      groups[ts.date].push(ts);
    });
    // Sort dates
    const sorted = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    // Sort slots within each date
    sorted.forEach(([, slots]) => slots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return sorted;
  }, [filteredSlots]);

  // Toggle slot selection
  const toggleSlot = (id: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Compute current step
  const currentStep = bookingNumber
    ? 4
    : selectedSlotIds.length > 0 && studentName && studentEmail
    ? 3
    : selectedSlotIds.length > 0
    ? 3
    : gradeFilter !== "すべて" || genderFilter !== "all"
    ? 2
    : 1;

  // Submit
  const handleSubmit = async () => {
    if (!studentName.trim()) {
      setError("お名前を入力してください");
      return;
    }
    if (!studentEmail.trim() || !studentEmail.includes("@")) {
      setError("有効なメールアドレスを入力してください");
      return;
    }
    if (selectedSlotIds.length === 0) {
      setError("少なくとも1つの日時を選択してください");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await createBooking({
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        selectedSlotIds,
        eventType: "orientation",
      });
      setBookingNumber(result.bookingNumber);
    } catch {
      setError("予約の送信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Completion screen ─────────────────────────────────
  if (bookingNumber) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Header />
          <StepIndicator current={4} />

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">予約を受け付けました</h2>
            <p className="text-sm text-gray-500 mb-6">
              仮予約を受け付けました。スタッフが確定次第、メールでお知らせします。
            </p>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-4">
              <p className="text-xs text-blue-600 font-medium mb-1">予約番号</p>
              <p className="text-3xl font-mono font-bold text-blue-700 tracking-wider">
                {bookingNumber}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-800 leading-relaxed">
                <span className="font-bold">重要：</span>この番号は日程変更時に必要です。スクリーンショットを撮るか、メモしてください。
              </p>
            </div>

            <Link
              href="/booking"
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              予約を確認・変更する
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Booking flow ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Header />
        <StepIndicator current={selectedSlotIds.length > 0 ? 3 : groupedByDate.length > 0 ? 2 : 1} />

        {/* Step 1: Filters */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
            スタッフを絞り込む
            <span className="text-xs text-gray-400 font-normal">（任意）</span>
          </h2>

          <div className="space-y-3">
            {/* Grade filter */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">学年</p>
              <div className="flex flex-wrap gap-2">
                {GRADE_FILTERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGradeFilter(g)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      gradeFilter === g
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender filter */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">性別</p>
              <div className="flex flex-wrap gap-2">
                {GENDER_FILTERS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGenderFilter(g.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      genderFilter === g.value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Step 2: Time slots */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
            希望の日時を選択
            <span className="text-xs text-gray-400 font-normal">（複数選択可）</span>
          </h2>

          {groupedByDate.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">現在予約可能な枠がありません</p>
              <p className="text-xs text-gray-400 mt-1">条件を変更するか、後日お試しください</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([date, slots]) => (
                <div key={date}>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(date)}
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {slots.map((slot) => {
                      const staff = staffMap[slot.staffId];
                      const isSelected = selectedSlotIds.includes(slot.id);
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
                          {/* Checkbox */}
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          {/* Time */}
                          <div className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {slot.startTime}〜{slot.endTime}
                          </div>

                          {/* Staff info */}
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

          {selectedSlotIds.length > 0 && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg text-center">
              <span className="text-sm text-blue-700 font-medium">
                {selectedSlotIds.length}件選択中
              </span>
            </div>
          )}
        </section>

        {/* Step 3: Contact form (show when slots selected) */}
        {selectedSlotIds.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
              お客様情報を入力
            </h2>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="山田 太郎"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="example@university.ac.jp"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    送信中...
                  </span>
                ) : (
                  "予約を送信する"
                )}
              </button>
            </div>
          </section>
        )}

        {/* Footer info */}
        <div className="text-center mt-8 mb-4">
          <p className="text-xs text-gray-400">
            既に予約済みの方は
            <Link href="/booking" className="text-blue-600 hover:underline ml-0.5">
              こちら
            </Link>
            から確認・変更できます
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Header component ──────────────────────────────────────
function Header() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-2 mb-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <span className="font-bold text-gray-900 dark:text-gray-100 text-xl">Lueur</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">インターン説明会 予約</h1>
      <p className="text-sm text-gray-500">ご希望の日時を選んでお申し込みください</p>
    </div>
  );
}

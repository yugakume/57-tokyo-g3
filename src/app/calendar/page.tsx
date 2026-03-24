"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMeetingMinutes } from "@/contexts/MeetingMinutesContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useTask } from "@/contexts/TaskContext";
import { ChevronIcon, CloseIcon } from "@/components/Icons";
import type { MeetingMinutes as MeetingMinutesType } from "@/types";

// =============================================
// 型定義
// =============================================

interface CalendarEvent {
  id: string;
  title: string;
  type: "mtg" | "orientation" | "task";
  date: string;
  time?: string;
}

// =============================================
// ヘルパー
// =============================================

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// =============================================
// カレンダーページ
// =============================================

export default function CalendarPage() {
  const { user, isLoading } = useAuth();
  const { minutes, updateAttendance } = useMeetingMinutes();
  const { timeSlots, staffProfiles } = useSchedule();
  const { tasks } = useTask();
  const router = useRouter();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  // staffId -> name
  const staffIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    staffProfiles.forEach(p => { map[p.id] = p.fullName || p.lastName; });
    return map;
  }, [staffProfiles]);

  // Birthday map: MM-DD -> staff names
  const birthdayByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    staffProfiles.forEach(p => {
      if (!p.birthday) return;
      // birthday can be YYYY-MM-DD or MM-DD
      const parts = p.birthday.split("-");
      let mmdd: string;
      if (parts.length === 3 && parts[0].length === 4) {
        mmdd = `${parts[1]}-${parts[2]}`;
      } else if (parts.length === 2) {
        mmdd = p.birthday;
      } else {
        return;
      }
      if (!map[mmdd]) map[mmdd] = [];
      map[mmdd].push(p.fullName || p.lastName || p.email);
    });
    return map;
  }, [staffProfiles]);

  // MTG by date for attendance buttons
  const mtgByDate = useMemo(() => {
    const map: Record<string, MeetingMinutesType[]> = {};
    minutes.forEach(m => {
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    });
    return map;
  }, [minutes]);

  // イベントを集約
  const events = useMemo(() => {
    const result: CalendarEvent[] = [];

    // MTG（議事録）
    minutes.forEach(m => {
      result.push({
        id: `mtg-${m.id}`,
        title: m.title,
        type: "mtg",
        date: m.date,
        time: `${m.startTime}〜${m.endTime}`,
      });
    });

    // 説明会（予約済みスロット）
    timeSlots
      .filter(s => s.eventType === "orientation" && s.isBooked)
      .forEach(s => {
        const staffName = staffIdToName[s.staffId] || "";
        result.push({
          id: `orientation-${s.id}`,
          title: `説明会${staffName ? ` (${staffName})` : ""}`,
          type: "orientation",
          date: s.date,
          time: `${s.startTime}〜${s.endTime}`,
        });
      });

    // タスク期限
    tasks
      .filter(t => t.dueDate && t.status !== "done")
      .forEach(t => {
        result.push({
          id: `task-${t.id}`,
          title: t.title,
          type: "task",
          date: t.dueDate!,
        });
      });

    return result;
  }, [minutes, timeSlots, tasks, staffIdToName]);

  // 日付 -> イベント のマップ
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  // 月切り替え
  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // カレンダーグリッド生成
  const calendarGrid = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = [];

    // 先頭の空白
    for (let i = 0; i < firstDay; i++) {
      row.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      row.push(day);
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }

    // 末尾の空白
    if (row.length > 0) {
      while (row.length < 7) {
        row.push(null);
      }
      rows.push(row);
    }

    return rows;
  }, [currentYear, currentMonth]);

  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // 選択中の日のイベント
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const typeColor: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    mtg: {
      bg: "bg-purple-50 dark:bg-purple-900/30",
      text: "text-purple-700 dark:text-purple-300",
      dot: "bg-purple-500",
      label: "MTG",
    },
    orientation: {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
      label: "説明会",
    },
    task: {
      bg: "bg-orange-50 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-300",
      dot: "bg-orange-500",
      label: "タスク期限",
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">カレンダー</h1>
        <div className="flex items-center gap-1">
          {/* 凡例 */}
          <div className="hidden sm:flex items-center gap-3 mr-4">
            {Object.entries(typeColor).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 月切り替え */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="前月"
          >
            <ChevronIcon direction="left" className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-[140px] text-center">
            {currentYear}年{currentMonth + 1}月
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="次月"
          >
            <ChevronIcon direction="right" className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          今月
        </button>
      </div>

      {/* モバイル凡例 */}
      <div className="flex sm:hidden items-center gap-3 mb-3">
        {Object.entries(typeColor).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${val.dot}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{val.label}</span>
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center text-xs font-medium ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付セル */}
        {calendarGrid.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            {row.map((day, colIdx) => {
              if (day === null) {
                return <div key={colIdx} className="min-h-[80px] sm:min-h-[100px] bg-gray-50/50 dark:bg-gray-900/30" />;
              }

              const dateStr = formatDateStr(currentYear, currentMonth, day);
              const dayEvents = eventsByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
              const mmdd = `${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const birthdayNames = birthdayByDate[mmdd] || [];

              return (
                <button
                  key={colIdx}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 text-left border-r border-gray-100 dark:border-gray-700 last:border-r-0 transition-colors ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-0.5">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm rounded-full ${
                        isToday
                          ? "bg-blue-600 text-white font-bold"
                          : dayOfWeek === 0
                          ? "text-red-500"
                          : dayOfWeek === 6
                          ? "text-blue-500"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {day}
                    </span>
                    {birthdayNames.length > 0 && (
                      <span className="text-xs" title={birthdayNames.join(", ")}>🎂</span>
                    )}
                  </div>
                  {/* イベントドット（モバイル） */}
                  <div className="flex gap-0.5 mt-0.5 sm:hidden">
                    {dayEvents.length > 0 && (
                      <>
                        {Array.from(new Set(dayEvents.map(e => e.type))).map(type => (
                          <span key={type} className={`w-1.5 h-1.5 rounded-full ${typeColor[type].dot}`} />
                        ))}
                      </>
                    )}
                  </div>
                  {/* イベントラベル（デスクトップ） */}
                  <div className="hidden sm:block mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${typeColor[event.type].bg} ${typeColor[event.type].text}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">
                        +{dayEvents.length - 3}件
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 選択日の詳細パネル */}
      {selectedDate && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">この日の予定はありません</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map(event => {
                  // Find the matching MTG for attendance
                  const mtgMatch = event.type === "mtg" && selectedDate
                    ? (mtgByDate[selectedDate] || []).find(m => event.id === `mtg-${m.id}`)
                    : null;
                  const myStatus = mtgMatch?.attendance?.[user.email];

                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg p-3 ${typeColor[event.type].bg} border ${
                        event.type === "mtg"
                          ? "border-purple-200 dark:border-purple-700"
                          : event.type === "orientation"
                          ? "border-blue-200 dark:border-blue-700"
                          : "border-orange-200 dark:border-orange-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${typeColor[event.type].dot}`} />
                        <span className={`text-xs font-medium ${typeColor[event.type].text}`}>
                          {typeColor[event.type].label}
                        </span>
                        {event.time && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{event.time}</span>
                        )}
                      </div>
                      <p className={`text-sm font-medium ${typeColor[event.type].text}`}>{event.title}</p>
                      {/* Attendance buttons for MTG events */}
                      {mtgMatch && (
                        <div className="flex items-center gap-2 mt-2">
                          {(["出席", "欠席", "遅刻"] as const).map(status => {
                            const isActive = myStatus === status;
                            const colors: Record<string, string> = {
                              "出席": isActive ? "bg-green-600 text-white border-green-600" : "bg-white dark:bg-gray-700 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/30",
                              "欠席": isActive ? "bg-red-600 text-white border-red-600" : "bg-white dark:bg-gray-700 text-red-700 dark:text-red-300 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30",
                              "遅刻": isActive ? "bg-yellow-500 text-white border-yellow-500" : "bg-white dark:bg-gray-700 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30",
                            };
                            return (
                              <button
                                key={status}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateAttendance(mtgMatch.id, user.email, isActive ? "未回答" : status);
                                }}
                                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${colors[status]}`}
                              >
                                {status}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

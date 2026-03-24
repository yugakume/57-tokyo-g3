"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMeetingMinutes } from "@/contexts/MeetingMinutesContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { PlusIcon, CloseIcon, TrashIcon, EditIcon, ChevronIcon, ExternalLinkIcon, SearchIcon } from "@/components/Icons";
import type { MeetingMinutes, MeetingLocation } from "@/types";

// =============================================
// 時間オプション（30分刻み）
// =============================================
const TIME_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const LOCATION_OPTIONS: MeetingLocation[] = ["対面", "オンライン", "ハイブリッド"];

const LOCATION_COLORS: Record<MeetingLocation, string> = {
  "対面": "bg-green-100 text-green-700",
  "オンライン": "bg-blue-100 text-blue-700",
  "ハイブリッド": "bg-purple-100 text-purple-700",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

function getNextSaturday(): string {
  const now = new Date();
  const d = new Date(now);
  const daysUntilSat = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (daysUntilSat === 0 ? 7 : daysUntilSat));
  return d.toISOString().split("T")[0];
}

// =============================================
// メインページ
// =============================================

export default function MeetingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { minutes, addMinutes, updateMinutes, deleteMinutes, updateAttendance } = useMeetingMinutes();
  const { staffProfiles } = useSchedule();

  // 現在のユーザーのスタッフプロフィール（最寄駅取得用）
  const myProfile = useMemo(() => {
    if (!user) return undefined;
    return staffProfiles.find(p => p.email === user.email);
  }, [user, staffProfiles]);

  const [filterMonth, setFilterMonth] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMinutes, setEditingMinutes] = useState<MeetingMinutes | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  // 月の選択肢
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    minutes.forEach(m => {
      if (!m.date) return;
      const ym = m.date.slice(0, 7);
      months.add(ym);
    });
    return Array.from(months).sort().reverse();
  }, [minutes]);

  // フィルタ済みMTG
  const filteredMinutes = useMemo(() => {
    let list = [...minutes];
    if (filterMonth !== "all") {
      list = list.filter(m => m.date?.startsWith(filterMonth));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.attendees.some(a => a.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [minutes, filterMonth, searchQuery]);

  // 月ごとグループ化
  const groupedMinutes = useMemo(() => {
    const groups: Record<string, MeetingMinutes[]> = {};
    filteredMinutes.forEach(m => {
      if (!m.date) return;
      const ym = m.date.slice(0, 7);
      if (!groups[ym]) groups[ym] = [];
      groups[ym].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredMinutes]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleAdd = (data: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => {
    addMinutes(data);
    setShowAddModal(false);
    showToast("ミーティングを追加しました");
  };

  const handleUpdate = (data: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => {
    if (!editingMinutes) return;
    updateMinutes(editingMinutes.id, data);
    setEditingMinutes(null);
    showToast("ミーティングを更新しました");
  };

  const handleDelete = (id: string) => {
    if (!confirm("このミーティングを削除しますか？")) return;
    deleteMinutes(id);
    if (expandedId === id) setExpandedId(null);
    showToast("削除しました");
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">ミーティング</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ミーティングの日程管理・出欠・議事録</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          ミーティングを追加
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-sm text-gray-600 dark:text-gray-400">月で絞り込み:</label>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">すべて</option>
          {monthOptions.map(ym => (
            <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
          ))}
        </select>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="タイトル・内容・出席者で検索"
            className="pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {searchQuery.trim() ? `検索結果: ${filteredMinutes.length}件` : `${filteredMinutes.length}件`}
        </span>
      </div>

      {/* List */}
      {groupedMinutes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">ミーティングがありません</p>
          <p className="text-sm">「ミーティングを追加」から新しいミーティングを作成してください</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedMinutes.map(([ym, items]) => (
            <div key={ym}>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                {formatMonthLabel(ym)}
              </h2>
              <div className="space-y-3">
                {items.map(m => (
                  <MeetingCard
                    key={m.id}
                    minutes={m}
                    myNearestStation={myProfile?.nearestStation}
                    userEmail={user.email}
                    staffProfiles={staffProfiles}
                    onUpdateAttendance={updateAttendance}
                    isExpanded={expandedId === m.id}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onEdit={() => setEditingMinutes(m)}
                    onDelete={() => handleDelete(m.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <MeetingModal
          userEmail={user.email}
          staffProfiles={staffProfiles}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingMinutes && (
        <MeetingModal
          userEmail={user.email}
          staffProfiles={staffProfiles}
          initial={editingMinutes}
          onSave={handleUpdate}
          onClose={() => setEditingMinutes(null)}
        />
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
// MTGカード
// =============================================

function buildGoogleCalendarUrl(m: MeetingMinutes): string {
  const startDate = m.date.replace(/-/g, "");
  const startTime = m.startTime.replace(":", "") + "00";
  const endTime = m.endTime.replace(":", "") + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: m.title,
    dates: `${startDate}T${startTime}/${startDate}T${endTime}`,
    details: m.content ? m.content.slice(0, 500) : "",
    location: m.venue || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function MeetingCard({
  minutes: m,
  myNearestStation,
  userEmail,
  staffProfiles,
  onUpdateAttendance,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  minutes: MeetingMinutes;
  myNearestStation?: string;
  userEmail: string;
  staffProfiles: { id: string; email: string; lastName: string; fullName?: string }[];
  onUpdateAttendance: (id: string, email: string, status: "出席" | "欠席" | "遅刻" | "未回答") => void;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPast = m.date < new Date().toISOString().split("T")[0];
  const myStatus = m.attendance?.[userEmail];
  const [showMinutes, setShowMinutes] = useState(false);
  const attendanceCounts = useMemo(() => {
    const att = m.attendance || {};
    const values = Object.values(att);
    return {
      attend: values.filter(v => v === "出席").length,
      absent: values.filter(v => v === "欠席").length,
      late: values.filter(v => v === "遅刻").length,
    };
  }, [m.attendance]);

  // Map emails to names for attendance display
  const emailToName = useMemo(() => {
    const map: Record<string, string> = {};
    staffProfiles.forEach(p => { map[p.email] = p.fullName || p.lastName; });
    return map;
  }, [staffProfiles]);

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      isPast ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" : "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30"
    }`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <ChevronIcon
          direction={isExpanded ? "down" : "right"}
          className="w-4 h-4 text-gray-400 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(m.date)}</span>
            <span className="text-sm text-gray-600 dark:text-gray-300">{m.title}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${LOCATION_COLORS[m.location]}`}>
              {m.location}
            </span>
            {!isPast && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">予定</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400">{m.startTime}〜{m.endTime}</span>
            {m.venue && (
              <span className="text-xs text-gray-500">{m.venue}</span>
            )}
            {m.attendees.length > 0 && (
              <span className="text-xs text-gray-400">出席: {m.attendees.length}名</span>
            )}
            {m.content && (
              <span className="text-xs text-green-600">議事録あり</span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          <div className="mt-3 space-y-3">
            {/* 1. 日時・場所・Googleカレンダーリンク */}
            {m.venue && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">会場</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{m.venue}{m.venueStation ? `（${m.venueStation}）` : ""}</span>
                  {m.venueStation && myNearestStation && (
                    <a
                      href={`https://www.google.com/maps/dir/${encodeURIComponent(myNearestStation)}/${encodeURIComponent(m.venueStation)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                      経路を確認（Google Maps）
                    </a>
                  )}
                  {m.venueStation && !myNearestStation && (
                    <span className="text-[10px] text-gray-400">※ スタッフ設定で最寄駅を登録すると経路が表示されます</span>
                  )}
                </div>
              </div>
            )}

            {/* Google Calendar */}
            <div>
              <a
                href={buildGoogleCalendarUrl(m)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                Googleカレンダーに追加
              </a>
            </div>

            {/* 2. 出欠回答 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">出欠回答</p>
              <div className="flex items-center gap-2 mb-2">
                {(["出席", "欠席", "遅刻"] as const).map(status => {
                  const isActive = myStatus === status;
                  const colors: Record<string, string> = {
                    "出席": isActive ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-300 hover:bg-green-50",
                    "欠席": isActive ? "bg-red-600 text-white border-red-600" : "bg-white text-red-700 border-red-300 hover:bg-red-50",
                    "遅刻": isActive ? "bg-yellow-500 text-white border-yellow-500" : "bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50",
                  };
                  return (
                    <button
                      key={status}
                      onClick={() => onUpdateAttendance(m.id, userEmail, isActive ? "未回答" : status)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${colors[status]}`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>出席 <span className="font-semibold text-green-600">{attendanceCounts.attend}名</span></span>
                <span>欠席 <span className="font-semibold text-red-600">{attendanceCounts.absent}名</span></span>
                <span>遅刻 <span className="font-semibold text-yellow-600">{attendanceCounts.late}名</span></span>
              </div>
              {/* Show individual attendance responses */}
              {m.attendance && Object.keys(m.attendance).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(m.attendance).map(([email, status]) => {
                    const name = emailToName[email] || email;
                    const statusColors: Record<string, string> = {
                      "出席": "bg-green-100 text-green-700",
                      "欠席": "bg-red-100 text-red-700",
                      "遅刻": "bg-yellow-100 text-yellow-700",
                    };
                    return (
                      <span key={email} className={`px-2 py-0.5 text-xs rounded-full ${statusColors[status] || "bg-gray-100 text-gray-600"}`}>
                        {name}: {status}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attendees */}
            {m.attendees.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">出席者</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.attendees.map((a, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 3. 区切り線 + 議事録（折りたたみ） */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <button
                onClick={() => setShowMinutes(!showMinutes)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <ChevronIcon
                  direction={showMinutes ? "down" : "right"}
                  className="w-3.5 h-3.5"
                />
                <span>{showMinutes ? "議事録を閉じる" : "議事録を表示"}</span>
                {m.content && !showMinutes && (
                  <span className="text-xs text-green-600 ml-1">（記録あり）</span>
                )}
              </button>
              {showMinutes && (
                <div className="mt-2">
                  {m.content ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {m.content}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">まだ記録がありません</p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <EditIcon className="w-3.5 h-3.5" />
                編集
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// 追加/編集モーダル
// =============================================

function MeetingModal({
  userEmail,
  staffProfiles,
  initial,
  onSave,
  onClose,
}: {
  userEmail: string;
  staffProfiles: { id: string; email: string; lastName: string; fullName?: string }[];
  initial?: MeetingMinutes;
  onSave: (data: Omit<MeetingMinutes, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [date, setDate] = useState(initial?.date ?? getNextSaturday());
  const [title, setTitle] = useState(initial?.title ?? "定例ミーティング");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "12:00");
  const [location, setLocation] = useState<MeetingLocation>(initial?.location ?? "対面");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [venueStation, setVenueStation] = useState(initial?.venueStation ?? "");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(initial?.attendees ?? []);
  const [content, setContent] = useState(initial?.content ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setContent(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleAttendee = (name: string) => {
    setSelectedAttendees(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const handleSubmit = () => {
    if (!date || !title.trim()) return;
    onSave({
      date,
      title: title.trim(),
      startTime,
      endTime,
      location,
      venue: venue.trim() || undefined,
      venueStation: venueStation.trim() || undefined,
      attendees: selectedAttendees,
      content,
      createdBy: initial?.createdBy ?? userEmail,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {initial ? "ミーティングを編集" : "新規ミーティング"}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date & Title */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">日付</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="定例ミーティング"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">開始時間</label>
              <select
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">終了時間</label>
              <select
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_OPTIONS.filter(t => t > startTime).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">場所</label>
            <div className="flex gap-2">
              {LOCATION_OPTIONS.map(loc => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    location === loc
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Venue */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">会場名</label>
              <input
                type="text"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                placeholder="例: 〇〇会議室"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">会場最寄駅</label>
              <input
                type="text"
                value={venueStation}
                onChange={e => setVenueStation(e.target.value)}
                placeholder="例: 永田町駅"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">出席者</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAttendees(staffProfiles.map(p => p.fullName || p.lastName))}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAttendees([])}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  全解除
                </button>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-2 max-h-40 overflow-y-auto">
              {staffProfiles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {staffProfiles.map(p => {
                    const name = p.fullName || p.lastName;
                    const isSelected = selectedAttendees.includes(name);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleAttendee(name)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {isSelected && "✓ "}{name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-2 text-center">スタッフが登録されていません</p>
              )}
            </div>
            {selectedAttendees.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{selectedAttendees.length}名選択中</p>
            )}
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">議事録</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                テキストファイルを読み込む
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.text"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder="ミーティングの内容を記録..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
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
              disabled={!date || !title.trim()}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initial ? "更新" : "追加"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

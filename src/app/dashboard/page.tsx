"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useMeetingMinutes } from "@/contexts/MeetingMinutesContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useTask } from "@/contexts/TaskContext";
import { useCountdown } from "@/contexts/CountdownContext";
import { LinkListIcon, KeyIcon, SettingsIcon, ChevronIcon, BellIcon, CalendarIcon, ExternalLinkIcon } from "@/components/Icons";

// =============================================
// 天気
// =============================================

interface WeatherData {
  current: { temp: number; code: number; humidity: number; windSpeed: number };
  daily: { date: string; code: number; maxTemp: number; minTemp: number; precipProb: number }[];
}

function weatherIcon(code: number): string {
  if (code === 0) return "\u2600\uFE0F";           // 快晴
  if (code <= 3) return "\u26C5";                   // 曇り
  if (code === 45 || code === 48) return "\uD83C\uDF2B\uFE0F"; // 霧
  if (code <= 57) return "\uD83C\uDF26\uFE0F";     // 霧雨
  if (code <= 67) return "\uD83C\uDF27\uFE0F";     // 雨
  if (code <= 77) return "\uD83C\uDF28\uFE0F";     // 雪
  if (code <= 82) return "\uD83C\uDF27\uFE0F";     // にわか雨
  if (code <= 86) return "\uD83C\uDF28\uFE0F";     // にわか雪
  return "\u26C8\uFE0F";                            // 雷雨
}

function weatherLabel(code: number): string {
  if (code === 0) return "\u5FEB\u6674";
  if (code <= 3) return "\u66C7\u308A";
  if (code === 45 || code === 48) return "\u9727";
  if (code <= 57) return "\u9727\u96E8";
  if (code <= 67) return "\u96E8";
  if (code <= 77) return "\u96EA";
  if (code <= 82) return "\u306B\u308F\u304B\u96E8";
  if (code <= 86) return "\u306B\u308F\u304B\u96EA";
  return "\u96F7\u96E8";
}

// =============================================
// 今日は何の日データ
// =============================================

const NOTABLE_DAYS: Record<string, string> = {
  "01-01": "\u5143\u65E5",
  "01-07": "\u4E03\u8349\u306E\u65E5",
  "01-11": "\u93E1\u958B\u304D",
  "01-15": "\u5C0F\u6B63\u6708",
  "02-03": "\u7BC0\u5206",
  "02-14": "\u30D0\u30EC\u30F3\u30BF\u30A4\u30F3\u30C7\u30FC",
  "02-22": "\u732B\u306E\u65E5",
  "02-23": "\u5929\u7687\u8A95\u751F\u65E5",
  "03-03": "\u3072\u306A\u307E\u3064\u308A",
  "03-09": "\u3042\u308A\u304C\u3068\u3046\u306E\u65E5",
  "03-14": "\u30DB\u30EF\u30A4\u30C8\u30C7\u30FC",
  "03-21": "\u6625\u5206\u306E\u65E5 / \u30E9\u30F3\u30C9\u30BB\u30EB\u306E\u65E5",
  "04-01": "\u30A8\u30A4\u30D7\u30EA\u30EB\u30D5\u30FC\u30EB",
  "04-22": "\u30A2\u30FC\u30B9\u30C7\u30A4",
  "04-29": "\u662D\u548C\u306E\u65E5",
  "05-03": "\u61B2\u6CD5\u8A18\u5FF5\u65E5",
  "05-04": "\u30B9\u30BF\u30FC\u30A6\u30A9\u30FC\u30BA\u306E\u65E5",
  "05-05": "\u3053\u3069\u3082\u306E\u65E5",
  "06-16": "\u548C\u83D3\u5B50\u306E\u65E5",
  "06-21": "\u590F\u81F3",
  "07-07": "\u4E03\u5915",
  "07-20": "\u6D77\u306E\u65E5",
  "08-01": "\u6C34\u306E\u65E5",
  "08-10": "\u713C\u304D\u9CE5\u306E\u65E5",
  "08-11": "\u5C71\u306E\u65E5",
  "08-15": "\u7D42\u6226\u8A18\u5FF5\u65E5",
  "09-01": "\u9632\u707D\u306E\u65E5",
  "09-23": "\u79CB\u5206\u306E\u65E5",
  "10-01": "\u30B3\u30FC\u30D2\u30FC\u306E\u65E5",
  "10-31": "\u30CF\u30ED\u30A6\u30A3\u30F3",
  "11-03": "\u6587\u5316\u306E\u65E5",
  "11-11": "\u30DD\u30C3\u30AD\u30FC\u306E\u65E5",
  "11-15": "\u4E03\u4E94\u4E09",
  "11-22": "\u3044\u3044\u592B\u5A66\u306E\u65E5",
  "11-23": "\u52E4\u52B4\u611F\u8B1D\u306E\u65E5",
  "12-22": "\u51AC\u81F3",
  "12-24": "\u30AF\u30EA\u30B9\u30DE\u30B9\u30A4\u30D6",
  "12-25": "\u30AF\u30EA\u30B9\u30DE\u30B9",
  "12-31": "\u5927\u6666\u65E5",
};

const MOTIVATIONAL_MESSAGES = [
  "\u4ECA\u65E5\u3082\u4E00\u65E5\u304C\u3093\u3070\u308A\u307E\u3057\u3087\u3046\uFF01",
  "\u5C0F\u3055\u306A\u4E00\u6B69\u304C\u5927\u304D\u306A\u6210\u679C\u306B\u3064\u306A\u304C\u308A\u307E\u3059",
  "\u30C1\u30FC\u30E0\u306E\u529B\u3067\u4E57\u308A\u8D8A\u3048\u3088\u3046\uFF01",
  "\u7B11\u9854\u3067\u904E\u3054\u3059\u4E00\u65E5\u306B\u3057\u307E\u3057\u3087\u3046",
  "\u81EA\u5206\u3092\u4FE1\u3058\u3066\u524D\u306B\u9032\u3082\u3046\uFF01",
];

export default function DashboardPage() {
  const { user, isLoading, isAdmin } = useAuth();
  const { categories, links, announcements } = useData();
  const { minutes } = useMeetingMinutes();
  const { staffProfiles, timeSlots } = useSchedule();
  const { tasks } = useTask();
  const { countdowns } = useCountdown();
  const router = useRouter();

  // =============================================
  // ダッシュボードカスタマイズ
  // =============================================
  const WIDGET_KEYS = [
    { key: "todayTopic", label: "今日のトピック" },
    { key: "quickLinks", label: "クイックリンク" },
    { key: "weather", label: "天気予報" },
    { key: "nextMtg", label: "次回MTG" },
    { key: "countdown", label: "カウントダウン" },
    { key: "taskAlert", label: "タスクアラート" },
    { key: "activityStats", label: "活動統計" },
    { key: "orientationSchedule", label: "今後の説明会スケジュール" },
    { key: "announcements", label: "お知らせ" },
  ] as const;
  type WidgetKey = typeof WIDGET_KEYS[number]["key"];

  const [widgetVisibility, setWidgetVisibility] = useState<Record<WidgetKey, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    WIDGET_KEYS.forEach(w => { defaults[w.key] = true; });
    return defaults as Record<WidgetKey, boolean>;
  });
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  // ESCキーでカスタマイズモーダルを閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCustomizeModal) setShowCustomizeModal(false);
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showCustomizeModal]);

  // localStorageから読み込み
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("portal_dashboard_widgets");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setWidgetVisibility(prev => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    }
  }, []);

  const toggleWidget = useCallback((key: WidgetKey) => {
    setWidgetVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("portal_dashboard_widgets", JSON.stringify(next));
      return next;
    });
  }, []);

  // 現在のユーザーのスタッフプロフィール
  const myProfile = useMemo(() => {
    if (!user) return undefined;
    return staffProfiles.find(p => p.email === user.email);
  }, [user, staffProfiles]);

  // 次回MTG（今日以降で最も近い日程）
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();
  const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const nextMeeting = useMemo(() => {
    return [...minutes]
      .filter(m => m.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0] || null;
  }, [minutes, todayStr]);

  // 説明会日程（今後7日間のスロット）
  const upcomingOrientationSlots = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().split("T")[0];
    return timeSlots
      .filter(s => s.date >= todayStr && s.date <= endStr && s.eventType === "orientation" && s.isBooked)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [timeSlots, todayStr]);

  // 説明会スロットを日ごとにグループ化
  const orientationByDate = useMemo(() => {
    const groups: Record<string, typeof upcomingOrientationSlots> = {};
    upcomingOrientationSlots.forEach(slot => {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingOrientationSlots]);

  // staffId -> name map (fullName優先)
  const staffIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    staffProfiles.forEach(p => { map[p.id] = p.fullName || p.lastName; });
    return map;
  }, [staffProfiles]);

  // email -> name map
  const emailToName = useMemo(() => {
    const map: Record<string, string> = {};
    staffProfiles.forEach(p => { map[p.email] = p.fullName || p.lastName; });
    return map;
  }, [staffProfiles]);

  // 表示名（本名優先）
  const displayName = useMemo(() => {
    return myProfile?.fullName || myProfile?.lastName || user?.displayName || "";
  }, [myProfile, user]);

  // =============================================
  // Feature 3: 誕生日 & 今日は何の日
  // =============================================
  const birthdayStaff = useMemo(() => {
    return staffProfiles.filter(p => p.birthday === todayMMDD);
  }, [staffProfiles, todayMMDD]);

  const notableDay = NOTABLE_DAYS[todayMMDD] || null;

  const motivationalMessage = useMemo(() => {
    // 日付ベースで決定的に選ぶ
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    return MOTIVATIONAL_MESSAGES[dayOfYear % MOTIVATIONAL_MESSAGES.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  // =============================================
  // Feature 2: タスクアラート
  // =============================================
  const alertTasks = useMemo(() => {
    const todayDate = new Date(todayStr + "T00:00:00");
    const threeDaysLater = new Date(todayDate);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split("T")[0];

    return tasks
      .filter(t => {
        if (t.status === "done") return false;
        if (!t.dueDate) return false;
        // dueDate が今日以前（期限切れ含む）または3日以内
        return t.dueDate <= threeDaysStr;
      })
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [tasks, todayStr]);

  // =============================================
  // 活動統計
  // =============================================
  const activityStats = useMemo(() => {
    const nowDate = new Date();
    const currentMonth = nowDate.getMonth();
    const currentYear = nowDate.getFullYear();

    // 今月の説明会実施数
    const thisMonthSlots = timeSlots.filter(s => {
      if (s.eventType !== "orientation") return false;
      const d = new Date(s.date + "T00:00:00");
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const thisMonthDone = thisMonthSlots.filter(s => {
      return s.isBooked && s.date <= todayStr;
    }).length;
    const thisMonthTotal = thisMonthSlots.filter(s => s.isBooked).length;

    // タスク完了率
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === "done").length;
    const taskPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // MTG出席率
    const userEmail = user?.email || "";
    const mtgWithAttendance = minutes.filter(m => m.attendance && m.attendance[userEmail]);
    const attended = mtgWithAttendance.filter(m => m.attendance![userEmail] === "出席").length;
    const mtgTotal = mtgWithAttendance.length;
    const mtgPercent = mtgTotal > 0 ? Math.round((attended / mtgTotal) * 100) : 0;

    return {
      orientationDone: thisMonthDone,
      orientationTotal: thisMonthTotal,
      doneTasks,
      totalTasks,
      taskPercent,
      attended,
      mtgTotal,
      mtgPercent,
    };
  }, [timeSlots, tasks, minutes, user, todayStr]);

  // =============================================
  // Feature 1: カウントダウン計算
  // =============================================
  function getCountdownText(targetDate: string): { text: string; isToday: boolean; isPast: boolean } {
    const target = new Date(targetDate + "T00:00:00");
    const today = new Date(todayStr + "T00:00:00");
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 0) return { text: "\u672C\u65E5\uFF01", isToday: true, isPast: false };
    if (diffDays > 0) {
      const nowMs = Date.now();
      const targetMs = target.getTime();
      const remainMs = targetMs - nowMs;
      const remainHours = Math.floor((remainMs % 86400000) / 3600000);
      if (diffDays <= 3 && remainHours > 0) {
        return { text: `\u3042\u3068${diffDays}\u65E5${remainHours}\u6642\u9593`, isToday: false, isPast: false };
      }
      return { text: `\u3042\u3068${diffDays}\u65E5`, isToday: false, isPast: false };
    }
    return { text: `${Math.abs(diffDays)}\u65E5\u524D\u306B\u7D42\u4E86`, isToday: false, isPast: true };
  }

  // 天気予報
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [weatherError, setWeatherError] = useState(false);

  const fetchWeather = useCallback(async () => {
    try {
      setWeatherError(false);
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Tokyo&forecast_days=5"
      );
      if (!res.ok) { setWeatherError(true); return; }
      const data = await res.json();
      setWeather({
        current: {
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
        },
        daily: data.daily.time.map((date: string, i: number) => ({
          date,
          code: data.daily.weather_code[i],
          maxTemp: Math.round(data.daily.temperature_2m_max[i]),
          minTemp: Math.round(data.daily.temperature_2m_min[i]),
          precipProb: data.daily.precipitation_probability_max?.[i] ?? 0,
        })),
      });
    } catch { setWeatherError(true); }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

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

  const quickLinks = [
    { href: "/links", label: "\u696D\u52D9\u30EA\u30F3\u30AF\u96C6", description: `${categories.length}\u30AB\u30C6\u30B4\u30EA\u30FB${links.length}\u4EF6\u306E\u30EA\u30F3\u30AF`, icon: LinkListIcon, color: "blue" },
    { href: "/accounts", label: "\u30A2\u30AB\u30A6\u30F3\u30C8\u60C5\u5831", description: "ID\u30FB\u30D1\u30B9\u30EF\u30FC\u30C9\u306E\u78BA\u8A8D\u30FB\u30B3\u30D4\u30FC", icon: KeyIcon, color: "emerald" },
    ...(isAdmin ? [{ href: "/admin", label: "\u30EA\u30F3\u30AF\u7BA1\u7406", description: "\u30EA\u30F3\u30AF\u306E\u8FFD\u52A0\u30FB\u7DE8\u96C6\u30FB\u524A\u9664", icon: SettingsIcon, color: "purple" }] : []),
  ];

  const colorMap: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800",
    emerald: "text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
    purple: "text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800",
  };

  const iconBgMap: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/50",
    emerald: "bg-emerald-100 dark:bg-emerald-900/50",
    purple: "bg-purple-100 dark:bg-purple-900/50",
  };


  return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Customize Modal */}
        {showCustomizeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCustomizeModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{"\u2699\uFE0F"} ダッシュボードカスタマイズ</h2>
                <button onClick={() => setShowCustomizeModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">表示するウィジェットを選択してください</p>
              <div className="space-y-3">
                {WIDGET_KEYS.map(w => (
                  <label key={w.key} className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">{w.label}</span>
                    <button
                      onClick={() => toggleWidget(w.key)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${widgetVisibility[w.key] ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${widgetVisibility[w.key] ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </label>
                ))}
              </div>
              <button onClick={() => setShowCustomizeModal(false)} className="mt-6 w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* Welcome + Weather */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">
                {displayName}さん、こんにちは
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                支部業務に必要な情報にすぐアクセスできます
              </p>
            </div>
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="shrink-0 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="ダッシュボードカスタマイズ"
            >
              {"\u2699\uFE0F"} カスタマイズ
            </button>
          </div>
          {widgetVisibility.weather && weather && (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/30 dark:to-blue-900/30 border border-sky-200 dark:border-sky-700 rounded-xl px-4 py-3 shrink-0 w-full sm:w-auto overflow-x-auto">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-2xl">{weatherIcon(weather.current.code)}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{weather.current.temp}°</span>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  <p>東京 {weatherLabel(weather.current.code)}</p>
                  <p>湿度{weather.current.humidity}% 風速{weather.current.windSpeed}m/s</p>
                </div>
              </div>
              <div className="flex gap-2">
                {weather.daily.slice(1, 5).map(d => (
                  <div key={d.date} className="text-center">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {new Date(d.date + "T00:00:00").toLocaleDateString("ja-JP", { weekday: "short" })}
                    </p>
                    <p className="text-sm">{weatherIcon(d.code)}</p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-300">
                      <span className="text-red-500">{d.maxTemp}</span>/<span className="text-blue-500">{d.minTemp}</span>
                    </p>
                    <p className="text-[10px] text-blue-500">{d.precipProb}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {widgetVisibility.weather && weatherError && !weather && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shrink-0 w-full sm:w-auto">
              <p className="text-xs text-gray-400 dark:text-gray-500">天気情報を取得できませんでした</p>
            </div>
          )}
        </div>

        {/* =============================================
            Feature 3: 今日のトピック
            ============================================= */}
        {widgetVisibility.todayTopic && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-700 p-4 mb-6">
          <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">
            {"\uD83D\uDCC5"} 今日のトピック
          </h2>
          <div className="space-y-1.5">
            {birthdayStaff.map(staff => (
              <p key={staff.id} className="text-sm text-amber-800 dark:text-amber-200">
                {"\uD83C\uDF82"} {staff.fullName || staff.lastName}さん、お誕生日おめでとう！
              </p>
            ))}
            {notableDay ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {"\u2728"} 今日は「{notableDay}」です
              </p>
            ) : birthdayStaff.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {"\uD83D\uDCAA"} {motivationalMessage}
              </p>
            ) : null}
          </div>
        </div>
        )}

        {/* Quick access cards */}
        {widgetVisibility.quickLinks && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`bg-white dark:bg-gray-800 rounded-xl border ${colorMap[item.color]} p-4 hover:shadow-md transition-all group`}
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${iconBgMap[item.color]} rounded-lg flex items-center justify-center mb-3`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <ChevronIcon direction="right" className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-0.5">{item.label}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
            </Link>
          ))}
        </div>
        )}

        {/* =============================================
            Feature 2: タスクアラート
            ============================================= */}
        {widgetVisibility.taskAlert && alertTasks.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 mb-6">
            <div className="px-4 py-3 border-b border-red-100 dark:border-red-800 flex items-center gap-2">
              <span className="text-base">{"\u26A0\uFE0F"}</span>
              <h2 className="font-semibold text-red-800 dark:text-red-300 text-sm">タスクアラート</h2>
              <Link href="/tasks" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto">
                タスク一覧へ
              </Link>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {alertTasks.map(task => {
                const isOverdue = task.dueDate! <= todayStr && task.dueDate !== todayStr;
                const isToday = task.dueDate === todayStr;
                const dueDateObj = new Date(task.dueDate + "T00:00:00");
                const todayObj = new Date(todayStr + "T00:00:00");
                const diffDays = Math.round((dueDateObj.getTime() - todayObj.getTime()) / 86400000);

                let statusLabel: string;
                let statusColor: string;
                if (isOverdue) {
                  statusLabel = "期限切れ";
                  statusColor = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
                } else if (isToday) {
                  statusLabel = "本日期限";
                  statusColor = "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
                } else {
                  statusLabel = `あと${diffDays}日`;
                  statusColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
                }

                return (
                  <Link key={task.id} href="/tasks" className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        担当: {(task.assigneeEmails || [task.assigneeEmail]).map(e => e === "all" ? "全体" : (emailToName[e!] || e)).join(", ")}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        期限: {new Date(task.dueDate! + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Next MTG Card */}
        {widgetVisibility.nextMtg && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-xl border border-indigo-200 dark:border-indigo-700 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-indigo-900 dark:text-indigo-200">次回MTG</h2>
          </div>
          {nextMeeting ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {new Date(nextMeeting.date + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{nextMeeting.startTime}〜{nextMeeting.endTime}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  nextMeeting.location === "対面" ? "bg-green-100 text-green-700" :
                  nextMeeting.location === "オンライン" ? "bg-blue-100 text-blue-700" :
                  "bg-purple-100 text-purple-700"
                }`}>{nextMeeting.location}</span>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{nextMeeting.title}</p>
              {nextMeeting.venue && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{"\uD83D\uDCCD"} {nextMeeting.venue}{nextMeeting.venueStation ? `（${nextMeeting.venueStation}）` : ""}</p>
              )}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {nextMeeting.venueStation && myProfile?.nearestStation && (
                  <>
                    <a
                      href={`https://www.google.com/maps/dir/${encodeURIComponent(myProfile.nearestStation!)}/${encodeURIComponent(nextMeeting.venueStation)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                      経路を確認
                    </a>
                    <a
                      href={`https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(myProfile.nearestStation!.replace(/駅$/, ""))}&to=${encodeURIComponent(nextMeeting.venueStation.replace(/駅$/, ""))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                    >
                      {"\uD83D\uDE83"} 交通費を調べる（Yahoo!乗換案内）
                    </a>
                  </>
                )}
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(nextMeeting.title)}&dates=${nextMeeting.date.replace(/-/g, "")}T${nextMeeting.startTime.replace(":", "")}00/${nextMeeting.date.replace(/-/g, "")}T${nextMeeting.endTime.replace(":", "")}00&location=${encodeURIComponent(nextMeeting.venue || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                >
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                  カレンダーに追加
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">次回のMTGはまだ登録されていません</p>
          )}
        </div>
        )}

        {/* =============================================
            活動統計セクション
            ============================================= */}
        {widgetVisibility.activityStats && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">{"\uD83D\uDCCA"} 活動統計</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 今月の説明会実施数 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">今月の説明会</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {activityStats.orientationDone}件実施 / {activityStats.orientationTotal}件予定
              </p>
            </div>
            {/* タスク完了率 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">タスク完了率</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                {activityStats.doneTasks}/{activityStats.totalTasks}完了 ({activityStats.taskPercent}%)
              </p>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${activityStats.taskPercent}%` }} />
              </div>
            </div>
            {/* MTG出席率 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">MTG出席率</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                出席: {activityStats.attended}/{activityStats.mtgTotal}回 ({activityStats.mtgPercent}%)
              </p>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${activityStats.mtgPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* =============================================
            Feature 1: カウントダウンタイマー
            ============================================= */}
        {widgetVisibility.countdown && countdowns.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{"\u23F3"}</span>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">カウントダウン</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...countdowns].sort((a, b) => a.targetDate.localeCompare(b.targetDate)).map(cd => {
                const { text, isToday, isPast } = getCountdownText(cd.targetDate);
                return (
                  <div
                    key={cd.id}
                    className={`rounded-xl border p-4 relative ${
                      isToday
                        ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-300 dark:border-green-700"
                        : isPast
                        ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 opacity-70"
                        : "bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 border-violet-200 dark:border-violet-700"
                    }`}
                  >
                    {false && (
                      <button
                        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs"
                        title="削除"
                      >
                        ✕
                      </button>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{cd.title}</p>
                    <p className={`text-lg font-bold ${
                      isToday ? "text-green-700 dark:text-green-300" : isPast ? "text-gray-500 dark:text-gray-400" : "text-violet-700 dark:text-violet-300"
                    }`}>
                      {text}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(cd.targetDate + "T00:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Upcoming Orientations */}
        {widgetVisibility.orientationSchedule && orientationByDate.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">確定済みの説明会日程</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">予約確定分のみ</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {orientationByDate.map(([date, slots]) => (
                <div key={date} className="px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(slot => (
                      <span
                        key={slot.id}
                        className={`text-xs px-2.5 py-1 rounded-lg ${
                          slot.isBooked ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {slot.startTime}〜{slot.endTime} {staffIdToName[slot.staffId] || ""}
                        {slot.isBooked && " ✓"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        {widgetVisibility.announcements && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-8">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <BellIcon className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">お知らせ</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {announcements.map((ann) => (
              <div key={ann.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  {ann.pinned && (
                    <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">重要</span>
                  )}
                  <span className="text-xs text-gray-400">{ann.date}</span>
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{ann.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Category quick access */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">カテゴリから探す</h2>
            <Link href="/links" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700">
              すべて見る
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-gray-700">
            {categories.sort((a, b) => a.order - b.order).map((cat) => {
              const count = links.filter(l => l.category === cat.id).length;
              return (
                <Link
                  key={cat.id}
                  href={`/links?category=${cat.id}`}
                  className="bg-white dark:bg-gray-800 px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
                    {cat.name}
                  </p>
                  <p className="text-xs text-gray-400">{count}件</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Future features hint */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800 p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">今後の拡張予定</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["Discord連携", "リマインドメール", "AI議事録", "LINE通知"].map((feature) => (
              <div key={feature} className="bg-white/60 dark:bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300 text-center">
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}

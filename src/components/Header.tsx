"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { MenuIcon, CloseIcon, HomeIcon, LinkListIcon, KeyIcon, CalendarIcon, DocumentIcon, ClipboardIcon, UsersIcon, SettingsIcon, LogOutIcon, EditIcon } from "./Icons";
import type { StaffProfile } from "@/types";

export default function Header() {
  return null;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ThemeToggle({ dropUp = false }: { dropUp?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const options: { value: "light" | "dark" | "system"; label: string; icon: React.FC<{ className?: string }> }[] = [
    { value: "light", label: "ライト", icon: SunIcon },
    { value: "dark", label: "ダーク", icon: MoonIcon },
    { value: "system", label: "システム設定", icon: MonitorIcon },
  ];

  const current = options.find(o => o.value === theme) || options[2];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors w-full"
      >
        <current.icon className="w-4 h-4" />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 overflow-hidden ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}>
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); setOpen(false); }}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm w-full transition-colors ${
                  theme === opt.value
                    ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const { staffProfiles, addStaffProfile, updateStaffProfile, staffRoles } = useSchedule();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();

  const myProfile = useMemo(() => {
    if (!user) return undefined;
    return staffProfiles.find(p => p.email === user.email);
  }, [user, staffProfiles]);

  const displayName = useMemo(() => {
    if (!user) return "";
    return myProfile?.fullName || myProfile?.lastName || user.displayName;
  }, [user, myProfile]);

  if (!user) return <>{children}</>;

  const navItems = [
    { href: "/dashboard", label: "ホーム", icon: HomeIcon },
    { href: "/links", label: "業務リンク集", icon: LinkListIcon },
    { href: "/accounts", label: "アカウント情報", icon: KeyIcon },
    { href: "/schedule", label: "スケジュール", icon: CalendarIcon },
    { href: "/minutes", label: "MTG議事録", icon: DocumentIcon },
    { href: "/tasks", label: "タスク", icon: ClipboardIcon },
    { href: "/members", label: "メンバー", icon: UsersIcon },
    { href: "/calendar", label: "カレンダー", icon: CalendarIcon },
    ...(isAdmin ? [{ href: "/admin", label: "管理", icon: SettingsIcon }] : []),
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 md:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">Lueur</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 text-gray-600 dark:text-gray-300">
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-14 right-0 w-64 bg-white dark:bg-gray-900 shadow-xl rounded-bl-xl border-l border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setProfileOpen(true); setMenuOpen(false); }}
              className="p-3 border-b border-gray-100 dark:border-gray-700 w-full hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
            </button>
            <nav className="p-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors w-full"
              >
                <LogOutIcon className="w-5 h-5" />
                ログアウト
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 md:fixed md:inset-y-0 md:left-0 z-30">
        {/* Logo */}
        <div className="px-4 h-14 flex items-center border-b border-gray-100 dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">Lueur</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors nav-link-underline ${
                isActive(item.href)
                  ? "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User section at bottom */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700">
          {/* Theme toggle */}
          <div className="px-3 py-2 mb-2">
            <ThemeToggle dropUp />
          </div>

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors group"
          >
            {myProfile?.photoURL ? (
              <img src={myProfile.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center shrink-0">
                <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
              {isAdmin && (
                <span className="text-xs text-blue-600 dark:text-blue-400">管理者</span>
              )}
            </div>
            <EditIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0" />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors w-full mt-1"
          >
            <LogOutIcon className="w-4 h-4" />
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56 flex flex-col min-h-screen">
        <div className="flex-1">
          {children}
        </div>
        <footer className="border-t border-gray-200 dark:border-gray-800 py-4 px-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © 2026{" "}
            <a
              href="https://yugaku.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors underline underline-offset-2"
            >
              Yuga Kume
            </a>
            . All rights reserved.
          </p>
        </footer>
      </main>

      {/* Profile modal */}
      {profileOpen && user && (
        <ProfileModal
          user={user}
          profile={myProfile}
          staffRoles={staffRoles}
          onSave={(data) => {
            if (myProfile) {
              updateStaffProfile(myProfile.id, data);
            } else {
              addStaffProfile({
                email: user.email,
                lastName: data.lastName || "",
                firstName: data.firstName,
                fullName: data.fullName,
                furigana: data.furigana,
                grade: data.grade || "未設定",
                gender: data.gender || "other",
                roleIds: data.roleIds || [],
                nearestStation: data.nearestStation,
                university: data.university,
                faculty: data.faculty,
                photoURL: data.photoURL,
                birthday: data.birthday,
              });
            }
            setProfileOpen(false);
          }}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

// =============================================
// マイページモーダル
// =============================================

function ProfileModal({
  user,
  profile,
  staffRoles,
  onSave,
  onClose,
}: {
  user: { email: string; displayName: string };
  profile?: StaffProfile;
  staffRoles: { id: string; name: string }[];
  onSave: (data: Partial<StaffProfile>) => void;
  onClose: () => void;
}) {
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  // ふりがなを姓・名に分割（結合されている場合は姓側に入れる）
  const existingFurigana = profile?.furigana ?? "";
  const [furiganaLast, setFuriganaLast] = useState(() => {
    // 既存のfuriganaが姓名結合なら、lastNameの文字数分で分割を試みる
    if (!existingFurigana) return "";
    const lastLen = (profile?.lastName ?? "").length;
    if (lastLen > 0 && existingFurigana.length > lastLen) {
      return existingFurigana.slice(0, lastLen);
    }
    return existingFurigana;
  });
  const [furiganaFirst, setFuriganaFirst] = useState(() => {
    if (!existingFurigana) return "";
    const lastLen = (profile?.lastName ?? "").length;
    if (lastLen > 0 && existingFurigana.length > lastLen) {
      return existingFurigana.slice(lastLen);
    }
    return "";
  });
  const [grade, setGrade] = useState(profile?.grade ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other">(profile?.gender ?? "other");
  const [nearestStation, setNearestStation] = useState(profile?.nearestStation ?? "");
  const [university, setUniversity] = useState(profile?.university ?? "");
  const [faculty, setFaculty] = useState(profile?.faculty ?? "");
  const [photoURL, setPhotoURL] = useState(profile?.photoURL ?? "");
  const [birthdayYear, setBirthdayYear] = useState(() => {
    if (!profile?.birthday) return "";
    const parts = profile.birthday.split("-");
    // YYYY-MM-DD形式の場合
    if (parts.length === 3 && parts[0].length === 4) return parts[0];
    return "";
  });
  const [birthdayMonth, setBirthdayMonth] = useState(() => {
    if (!profile?.birthday) return "";
    const parts = profile.birthday.split("-");
    // YYYY-MM-DD形式の場合
    if (parts.length === 3 && parts[0].length === 4) return parts[1] || "";
    // 旧MM-DD形式の場合
    return parts[0] || "";
  });
  const [birthdayDay, setBirthdayDay] = useState(() => {
    if (!profile?.birthday) return "";
    const parts = profile.birthday.split("-");
    // YYYY-MM-DD形式の場合
    if (parts.length === 3 && parts[0].length === 4) return parts[2] || "";
    // 旧MM-DD形式の場合
    return parts[1] || "";
  });

  const roleNames = useMemo(() => {
    return (profile?.roleIds ?? []).map(rid => {
      const role = staffRoles.find(r => r.id === rid);
      return role?.name ?? rid;
    });
  }, [profile?.roleIds, staffRoles]);

  const handleSubmit = () => {
    if (!lastName.trim()) return;
    const fullName = (lastName.trim() + firstName.trim()) || undefined;
    const furigana = (furiganaLast.trim() + furiganaFirst.trim()) || undefined;
    const birthday = birthdayYear && birthdayMonth && birthdayDay
      ? `${birthdayYear}-${birthdayMonth.padStart(2, "0")}-${birthdayDay.padStart(2, "0")}`
      : undefined;
    onSave({
      lastName: lastName.trim(),
      firstName: firstName.trim() || undefined,
      fullName,
      furigana,
      grade: grade.trim() || "未設定",
      gender,
      roleIds: profile?.roleIds ?? [],
      nearestStation: nearestStation.trim() || undefined,
      birthday,
      university: university.trim() || undefined,
      faculty: faculty.trim() || undefined,
      photoURL: photoURL || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">マイページ</h3>
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Avatar with photo upload */}
          <div className="flex flex-col items-center gap-2">
            <label className="relative cursor-pointer group">
              {photoURL ? (
                <img src={photoURL} alt="プロフィール写真" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600" />
              ) : (
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 dark:text-blue-300 text-3xl font-semibold">
                    {(profile?.fullName || profile?.lastName || user.displayName).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 500 * 1024) { alert("画像は500KB以下にしてください"); return; }
                  const reader = new FileReader();
                  reader.onload = (ev) => { setPhotoURL(ev.target?.result as string); };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500">クリックして写真を変更</p>
            {photoURL && (
              <button onClick={() => setPhotoURL("")} className="text-xs text-red-500 hover:text-red-600 transition-colors">写真を削除</button>
            )}
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="ドット"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="太郎"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Furigana */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ふりがな（姓）</label>
              <input
                type="text"
                value={furiganaLast}
                onChange={e => setFuriganaLast(e.target.value)}
                placeholder="どっと"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ふりがな（名）</label>
              <input
                type="text"
                value={furiganaFirst}
                onChange={e => setFuriganaFirst(e.target.value)}
                placeholder="たろう"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Nearest Station */}
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

          {/* Birthday */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">生年月日</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthdayYear}
                onChange={e => setBirthdayYear(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">年</option>
                {Array.from({ length: 2010 - 1990 + 1 }, (_, i) => 1990 + i).map(y => (
                  <option key={y} value={String(y)}>{y}年</option>
                ))}
              </select>
              <select
                value={birthdayMonth}
                onChange={e => setBirthdayMonth(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">月</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={String(m).padStart(2, "0")}>{m}月</option>
                ))}
              </select>
              <select
                value={birthdayDay}
                onChange={e => setBirthdayDay(e.target.value)}
                className="w-full px-2 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">日</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={String(d).padStart(2, "0")}>{d}日</option>
                ))}
              </select>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
            <p className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300">{user.email}</p>
          </div>

          {/* Roles (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">役職</label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {roleNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {roleNames.map((name, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-600">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">未設定</p>
              )}
            </div>
          </div>

          {/* University */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">大学</label>
            <input
              type="text"
              value={university}
              onChange={e => setUniversity(e.target.value)}
              placeholder="例: 早稲田大学"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Faculty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">学部・学科</label>
            <input
              type="text"
              value={faculty}
              onChange={e => setFaculty(e.target.value)}
              placeholder="例: 政治経済学部 経済学科"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">学年</label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {["1年", "2年", "3年", "4年", "M1", "M2"].map(g => (
                <option key={g} value={g}>{g}</option>
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
              disabled={!lastName.trim()}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

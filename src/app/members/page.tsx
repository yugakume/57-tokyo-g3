"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { SearchIcon, CloseIcon } from "@/components/Icons";
import type { StaffProfile } from "@/types";
import Toast from "@/components/Toast";

// MetaMask window.ethereum の型定義
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
      isMetaMask?: boolean;
    };
  }
}

// =============================================
// バッジカラー（ロールごとに色を割り当て）
// =============================================

const BADGE_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-red-100 text-red-700",
  "bg-yellow-100 text-yellow-700",
  "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
];

// =============================================
// アバターカラー
// =============================================

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// =============================================
// メインページ
// =============================================

export default function MembersPage() {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();
  const { staffProfiles, staffRoles, updateStaffProfile } = useSchedule();
  const [search, setSearch] = useState("");
  const [editingProfile, setEditingProfile] = useState<StaffProfile | null>(null);
  const [walletModalProfile, setWalletModalProfile] = useState<StaffProfile | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  // ロールID -> ロール名のマップ
  const roleMap = useMemo(() => {
    const map = new Map<string, { name: string; colorIndex: number }>();
    staffRoles.forEach((role, index) => {
      map.set(role.id, { name: role.name, colorIndex: index });
    });
    return map;
  }, [staffRoles]);

  // 検索フィルター
  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return staffProfiles;
    const q = search.trim().toLowerCase();
    return staffProfiles.filter((p) => {
      const name = (p.fullName || p.lastName || "").toLowerCase();
      const furigana = (p.furigana || "").toLowerCase();
      return name.includes(q) || furigana.includes(q);
    });
  }, [staffProfiles, search]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 md:top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">メンバー一覧</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {filteredProfiles.length} 名{search && ` (${staffProfiles.length} 名中)`}
              </p>
            </div>

            {/* 検索 */}
            <div className="relative w-full sm:w-72">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="名前・ふりがなで検索..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-700 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* カードグリッド */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {search ? "該当するメンバーが見つかりません" : "メンバーが登録されていません"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfiles.map((profile, index) => {
              const displayName = profile.fullName || profile.lastName;
              const roles = profile.roleIds
                .map((rid) => roleMap.get(rid))
                .filter(Boolean) as { name: string; colorIndex: number }[];

              return (
                <div
                  key={profile.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all card-hover relative"
                >
                  {/* 管理者用編集ボタン */}
                  {isAdmin && (
                    <button
                      onClick={() => setEditingProfile(profile)}
                      className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="編集"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  {/* 自分のカードにウォレット登録ボタン（非管理者でも） */}
                  {!isAdmin && user?.email === profile.email && (
                    <button
                      onClick={() => setWalletModalProfile(profile)}
                      className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                      title="ウォレットアドレスを登録"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2"/>
                        <path d="M16 3H8L2 7h20l-6-4z"/>
                        <circle cx="12" cy="14" r="2"/>
                      </svg>
                    </button>
                  )}
                  {/* アバター + 名前 */}
                  <div className="flex items-center gap-3 mb-4">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className={`w-11 h-11 ${getAvatarColor(index)} rounded-full flex items-center justify-center shrink-0`}
                      >
                        <span className="text-white font-semibold text-lg">
                          {displayName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {displayName}
                        </h3>
                        {profile.grade && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                            {profile.grade}
                          </span>
                        )}
                      </div>
                      {profile.furigana && (
                        <p className="text-xs text-gray-400 truncate">
                          {profile.furigana}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ロールバッジ */}
                  {roles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {roles.map((role) => (
                        <span
                          key={role.name}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${BADGE_COLORS[role.colorIndex % BADGE_COLORS.length]}`}
                        >
                          {role.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 詳細情報 */}
                  <div className="space-y-1.5 text-sm">
                    {/* 大学・学部学科 */}
                    {(profile.university || profile.faculty) && (
                      <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 20h20M12 2l10 8H2l10-8zM4 10v10M20 10v10M8 10v10M16 10v10M12 10v10" />
                        </svg>
                        <div className="min-w-0">
                          {profile.university && <span className="block truncate">{profile.university}</span>}
                          {profile.faculty && <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{profile.faculty}</span>}
                        </div>
                      </div>
                    )}

                    {/* 最寄駅 */}
                    {profile.nearestStation && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="truncate">{profile.nearestStation}</span>
                      </div>
                    )}

                    {/* 生年月日 */}
                    {profile.birthday && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>{(() => {
                          const parts = profile.birthday.split("-");
                          if (parts.length === 3 && parts[0].length === 4) {
                            return `${parseInt(parts[0])}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
                          }
                          return `${parseInt(parts[0])}月${parseInt(parts[1])}日`;
                        })()}</span>
                      </div>
                    )}

                    {/* メール → Gmailリンク */}
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <a
                        href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(profile.email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {profile.email}
                      </a>
                    </div>

                    {/* ウォレットアドレス（管理者のみ表示 or 自分のカード） */}
                    {(isAdmin || user?.email === profile.email) && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="7" width="20" height="14" rx="2"/>
                          <path d="M16 3H8L2 7h20l-6-4z"/>
                          <circle cx="12" cy="14" r="2"/>
                        </svg>
                        {profile.walletAddress ? (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(profile.walletAddress!);
                              setToast("コピーしました");
                            }}
                            className="truncate text-xs text-orange-600 dark:text-orange-400 font-mono hover:underline"
                            title={profile.walletAddress}
                          >
                            {profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}
                          </button>
                        ) : (
                          <button
                            onClick={() => setWalletModalProfile(profile)}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-orange-500 transition-colors"
                          >
                            {user?.email === profile.email ? "ウォレットを登録する →" : "未登録"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}

      {/* 管理者用 編集モーダル */}
      {editingProfile && (
        <EditProfileModal
          profile={editingProfile}
          staffRoles={staffRoles}
          onSave={(updates) => {
            updateStaffProfile(editingProfile.id, updates);
            setEditingProfile(null);
            setToast("プロフィールを更新しました");
          }}
          onClose={() => setEditingProfile(null)}
        />
      )}

      {/* ウォレット登録モーダル */}
      {walletModalProfile && (
        <WalletModal
          profile={walletModalProfile}
          onSave={(address) => {
            updateStaffProfile(walletModalProfile.id, { walletAddress: address || undefined });
            setWalletModalProfile(null);
            setToast(address ? "ウォレットアドレスを登録しました" : "ウォレットアドレスを削除しました");
          }}
          onClose={() => setWalletModalProfile(null)}
        />
      )}
    </div>
  );
}

// =============================================
// プロフィール編集モーダル（管理者用）
// =============================================

function EditProfileModal({
  profile,
  staffRoles,
  onSave,
  onClose,
}: {
  profile: StaffProfile;
  staffRoles: { id: string; name: string; order: number }[];
  onSave: (updates: Partial<StaffProfile>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [furigana, setFurigana] = useState(profile.furigana ?? "");
  const [grade, setGrade] = useState(profile.grade ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other">(profile.gender ?? "other");
  const [roleIds, setRoleIds] = useState<string[]>(profile.roleIds ?? []);
  const [nearestStation, setNearestStation] = useState(profile.nearestStation ?? "");
  const [birthday, setBirthday] = useState(profile.birthday ?? "");
  const [university, setUniversity] = useState(profile.university ?? "");
  const [faculty, setFaculty] = useState(profile.faculty ?? "");
  const [walletAddress, setWalletAddress] = useState(profile.walletAddress ?? "");

  const handleSubmit = () => {
    const fullName = [lastName, firstName].filter(Boolean).join(" ");
    onSave({ lastName, firstName, fullName, furigana, grade, gender, roleIds, nearestStation, birthday: birthday || undefined, university, faculty, walletAddress: walletAddress || undefined });
  };

  const toggleRole = (id: string) => {
    setRoleIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const inputCls = "w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {profile.fullName || profile.lastName} の情報を編集
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* メール（表示のみ） */}
          <div>
            <label className={labelCls}>メールアドレス（変更不可）</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">{profile.email}</p>
          </div>

          {/* 氏名 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>苗字</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} placeholder="田中" />
            </div>
            <div>
              <label className={labelCls}>名前</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} placeholder="太郎" />
            </div>
          </div>

          {/* ふりがな */}
          <div>
            <label className={labelCls}>ふりがな</label>
            <input type="text" value={furigana} onChange={e => setFurigana(e.target.value)} className={inputCls} placeholder="たなかたろう" />
          </div>

          {/* 学年・性別 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>学年</label>
              <input type="text" value={grade} onChange={e => setGrade(e.target.value)} className={inputCls} placeholder="3年" />
            </div>
            <div>
              <label className={labelCls}>性別</label>
              <select value={gender} onChange={e => setGender(e.target.value as "male" | "female" | "other")} className={inputCls}>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          {/* 大学・学部 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>大学名</label>
              <input type="text" value={university} onChange={e => setUniversity(e.target.value)} className={inputCls} placeholder="○○大学" />
            </div>
            <div>
              <label className={labelCls}>学部・学科</label>
              <input type="text" value={faculty} onChange={e => setFaculty(e.target.value)} className={inputCls} placeholder="経済学部" />
            </div>
          </div>

          {/* 最寄駅 */}
          <div>
            <label className={labelCls}>最寄駅</label>
            <input type="text" value={nearestStation} onChange={e => setNearestStation(e.target.value)} className={inputCls} placeholder="渋谷" />
          </div>

          {/* 生年月日 */}
          <div>
            <label className={labelCls}>生年月日</label>
            <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className={inputCls} />
          </div>

          {/* ロール */}
          {staffRoles.length > 0 && (
            <div>
              <label className={labelCls}>ロール</label>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {[...staffRoles].sort((a, b) => a.order - b.order).map(role => (
                  <label key={role.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ウォレットアドレス（管理者が直接編集） */}
          <div>
            <label className={labelCls}>MetaMaskウォレットアドレス</label>
            <input
              type="text"
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              className={inputCls}
              placeholder="0x..."
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              キャンセル
            </button>
            <button onClick={handleSubmit} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// ウォレット登録モーダル（各自が自分のを登録）
// =============================================

function WalletModal({
  profile,
  onSave,
  onClose,
}: {
  profile: StaffProfile;
  onSave: (address: string) => void;
  onClose: () => void;
}) {
  const [address, setAddress] = useState(profile.walletAddress ?? "");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const connectMetaMask = async () => {
    if (typeof window.ethereum === "undefined") {
      setError("MetaMaskがインストールされていません。手動で入力してください。");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        setAddress(accounts[0]);
      }
    } catch {
      setError("MetaMaskの接続をキャンセルしました。");
    } finally {
      setConnecting(false);
    }
  };

  const isValidAddress = !address || /^0x[0-9a-fA-F]{40}$/.test(address);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 3H8L2 7h20l-6-4z"/>
              <circle cx="12" cy="14" r="2"/>
            </svg>
            ウォレットアドレスを登録
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            MetaMaskのウォレットアドレスを登録してください。管理者のみ閲覧できます。
          </p>

          {/* MetaMask接続ボタン */}
          <button
            onClick={connectMetaMask}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 35 33" fill="none">
              <path d="M32.9 1L19.4 10.7l2.4-5.7L32.9 1z" fill="#E17726"/>
              <path d="M2.1 1l13.4 9.8-2.3-5.8L2.1 1z" fill="#E27625"/>
              <path d="M28.2 23.5l-3.6 5.5 7.7 2.1 2.2-7.4-6.3-.2z" fill="#E27625"/>
              <path d="M.9 23.7l2.2 7.4 7.7-2.1-3.6-5.5-6.3.2z" fill="#E27625"/>
              <path d="M10.4 14.5l-2.1 3.2 7.5.3-.3-8-5.1 4.5z" fill="#E27625"/>
              <path d="M24.6 14.5l-5.2-4.6-.2 8.1 7.5-.3-2.1-3.2z" fill="#E27625"/>
              <path d="M10.8 29l4.5-2.2-3.9-3-0.6 5.2z" fill="#E27625"/>
              <path d="M19.7 26.8l4.5 2.2-.6-5.2-3.9 3z" fill="#E27625"/>
            </svg>
            {connecting ? "接続中..." : "MetaMaskで接続する"}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            <span className="text-xs text-gray-400">または手動入力</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
          </div>

          {/* 手動入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ウォレットアドレス
            </label>
            <input
              type="text"
              value={address}
              onChange={e => { setAddress(e.target.value); setError(""); }}
              placeholder="0x..."
              className={`w-full px-3 py-2 border rounded-lg text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                !isValidAddress ? "border-red-400" : "border-gray-200 dark:border-gray-600"
              }`}
            />
            {!isValidAddress && (
              <p className="text-xs text-red-500 mt-1">有効なアドレスを入力してください（0x + 40文字の16進数）</p>
            )}
          </div>

          {error && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">{error}</p>
          )}

          {/* 現在の登録アドレス */}
          {profile.walletAddress && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">現在登録中</p>
              <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{profile.walletAddress}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {profile.walletAddress && (
              <button
                onClick={() => onSave("")}
                className="px-4 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                削除
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              キャンセル
            </button>
            <button
              onClick={() => { if (isValidAddress) onSave(address); }}
              disabled={!isValidAddress}
              className="flex-1 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

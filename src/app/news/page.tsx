"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { ExternalLinkIcon, PlusIcon, CloseIcon } from "@/components/Icons";

export default function NewsPage() {
  const { user, isLoading, isAdmin } = useAuth();
  const { announcements, announcementCategories, addAnnouncement, deleteAnnouncement } = useData();
  const { staffProfiles, staffRoles } = useSchedule();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  const sortedCategories = useMemo(() =>
    [...announcementCategories].sort((a, b) => a.order - b.order),
    [announcementCategories]
  );

  // email -> name map
  const emailToName = useMemo(() => {
    const map: Record<string, string> = {};
    staffProfiles.forEach(p => { map[p.email] = p.fullName || p.lastName || p.email; });
    return map;
  }, [staffProfiles]);

  // Get user's role IDs
  const myRoleIds = useMemo(() => {
    if (!user) return [];
    const profile = staffProfiles.find(p => p.email === user.email);
    return profile?.roleIds || [];
  }, [user, staffProfiles]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Filter announcements
  const filteredAnnouncements = useMemo(() => {
    let list = [...announcements];

    // Filter out expired (unless admin)
    if (!isAdmin) {
      list = list.filter(a => !a.expiresAt || a.expiresAt >= todayStr);
    }

    // Filter by target (unless admin)
    if (!isAdmin && user) {
      list = list.filter(a => {
        if (!a.targetType || a.targetType === "all") return true;
        if (a.targetType === "select") {
          return a.targetEmails?.includes(user.email) ?? false;
        }
        if (a.targetType === "role") {
          // targetEmails contains "role:roleId" entries
          const targetRoleIds = (a.targetEmails || [])
            .filter(e => e.startsWith("role:"))
            .map(e => e.replace("role:", ""));
          return targetRoleIds.some(rid => myRoleIds.includes(rid));
        }
        return true;
      });
    }

    // Filter by category
    if (activeCategory !== "all") {
      list = list.filter(a => a.category === activeCategory);
    }

    // Sort: pinned first, then by date desc
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.date.localeCompare(a.date);
    });
  }, [announcements, activeCategory, isAdmin, user, myRoleIds, todayStr]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const targetLabel = (a: typeof announcements[0]) => {
    if (!a.targetType || a.targetType === "all") return "全体";
    if (a.targetType === "select") return "個人宛";
    if (a.targetType === "role") {
      const roleNames = (a.targetEmails || [])
        .filter(e => e.startsWith("role:"))
        .map(e => {
          const rid = e.replace("role:", "");
          return staffRoles.find(r => r.id === rid)?.name || rid;
        });
      return roleNames.length > 0 ? roleNames.join(", ") : "ロール宛";
    }
    return "";
  };

  const getCategoryName = (catId?: string) => {
    if (!catId) return null;
    return announcementCategories.find(c => c.id === catId)?.name || null;
  };

  const isExpired = (a: typeof announcements[0]) => {
    return a.expiresAt && a.expiresAt < todayStr;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">お知らせ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">支部からのお知らせ一覧</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          投稿する
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeCategory === "all"
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          すべて
        </button>
        {sortedCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? "all" : cat.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Announcements list */}
      {filteredAnnouncements.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">お知らせはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.map(ann => (
            <div
              key={ann.id}
              className={`bg-white dark:bg-gray-800 rounded-xl border transition-colors ${
                isExpired(ann)
                  ? "border-red-200 dark:border-red-800 opacity-60"
                  : ann.pinned
                  ? "border-yellow-300 dark:border-yellow-700"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="px-4 py-4">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {ann.pinned && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-full font-medium">
                      ピン留め
                    </span>
                  )}
                  {getCategoryName(ann.category) && (
                    <span className="px-2 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                      {getCategoryName(ann.category)}
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    {targetLabel(ann)}
                  </span>
                  {isExpired(ann) && isAdmin && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full font-medium">
                      掲載終了
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {ann.title}
                </h3>

                {/* Content */}
                {ann.content && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-2">
                    {ann.content}
                  </p>
                )}

                {/* Link */}
                {ann.url && (
                  <a
                    href={ann.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                    関連リンク
                  </a>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-2">
                  <span>{ann.date}</span>
                  {ann.createdBy && (
                    <span>発信: {emailToName[ann.createdBy] || ann.createdBy}</span>
                  )}
                  {ann.expiresAt && (
                    <span>掲載期間: 〜{ann.expiresAt}</span>
                  )}
                  {(ann.createdBy === user.email || isAdmin) && (
                    <button
                      onClick={() => {
                        if (confirm("このお知らせを削除しますか？")) deleteAnnouncement(ann.id);
                      }}
                      className="text-red-400 hover:text-red-600 transition-colors ml-auto"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 削除ボタン（自分が投稿したもの or 管理者） */}

      {/* Add Announcement Modal */}
      {showAddModal && (
        <AddAnnouncementModal
          userEmail={user.email}
          categories={sortedCategories}
          staffProfiles={staffProfiles}
          staffRoles={staffRoles}
          onSave={async (data) => {
            await addAnnouncement(data);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// =============================================
// お知らせ投稿モーダル
// =============================================

function AddAnnouncementModal({
  userEmail,
  categories,
  staffProfiles,
  staffRoles,
  onSave,
  onClose,
}: {
  userEmail: string;
  categories: { id: string; name: string }[];
  staffProfiles: { email: string; lastName: string; fullName?: string; roleIds?: string[] }[];
  staffRoles: { id: string; name: string; order: number }[];
  onSave: (data: { title: string; content: string; date: string; pinned: boolean; category?: string; targetType?: "all" | "select" | "role"; targetEmails?: string[]; expiresAt?: string; url?: string; createdBy: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      content: content.trim(),
      date: new Date().toISOString().split("T")[0],
      pinned: false,
      category: category || undefined,
      targetType: "all",
      expiresAt: expiresAt || undefined,
      url: url.trim() || undefined,
      createdBy: userEmail,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">お知らせを投稿</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="お知らせのタイトル"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              placeholder="お知らせの詳細..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">なし</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">関連URL（任意）</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Expires */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">掲載期限（任意）</label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              disabled={!title.trim() || saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "投稿中..." : "投稿"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

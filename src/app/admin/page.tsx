"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import Toast from "@/components/Toast";
import { LinkIcon, PlusIcon, TrashIcon, EditIcon, CloseIcon } from "@/components/Icons";
import type { LinkItem, LinkIconType, AccountInfo, Announcement } from "@/types";

type Tab = "links" | "categories" | "accounts" | "users" | "roles" | "announcements";

export default function AdminPage() {
  const { user, isLoading, isAdmin, allowedEmails, adminEmails, addAllowedEmail, removeAllowedEmail, addAdminEmail, removeAdminEmail } = useAuth();
  const {
    links, categories, accounts, announcements,
    addLink, updateLink, deleteLink,
    addCategory, updateCategory, deleteCategory,
    addAccount, updateAccount, deleteAccount,
    addAnnouncement, updateAnnouncement, deleteAnnouncement,
  } = useData();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("links");
  const [toast, setToast] = useState("");

  // Link form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [linkForm, setLinkForm] = useState({ title: "", url: "", description: "", category: "", icon: "spreadsheet" as LinkIconType, order: 0 });

  // Category form state
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; name: string; order: number; description?: string } | null>(null);
  const [catForm, setCatForm] = useState({ name: "", order: 0, description: "" });

  // Account form state
  const [showAccForm, setShowAccForm] = useState(false);
  const [editingAcc, setEditingAcc] = useState<AccountInfo | null>(null);
  const [accForm, setAccForm] = useState({ serviceName: "", loginId: "", password: "", url: "", note: "", order: 0 });

  // Announcement form state
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annForm, setAnnForm] = useState({ title: "", content: "", date: new Date().toISOString().split("T")[0], pinned: false });

  // User management state
  const [newEmail, setNewEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // Role management
  const { staffRoles, addStaffRole, updateStaffRole, deleteStaffRole, staffProfiles, addStaffProfile, deleteStaffProfile } = useSchedule();
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) router.push("/dashboard");
  }, [user, isLoading, isAdmin, router]);

  if (isLoading || !user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  // Link handlers
  const openLinkForm = (link?: LinkItem) => {
    if (link) {
      setEditingLink(link);
      setLinkForm({ title: link.title, url: link.url, description: link.description, category: link.category, icon: link.icon, order: link.order });
    } else {
      setEditingLink(null);
      setLinkForm({ title: "", url: "", description: "", category: categories[0]?.id ?? "", icon: "spreadsheet", order: links.length + 1 });
    }
    setShowLinkForm(true);
  };

  const saveLinkForm = () => {
    if (!linkForm.title || !linkForm.url) return;
    if (editingLink) {
      updateLink(editingLink.id, linkForm);
      setToast("リンクを更新しました");
    } else {
      addLink(linkForm);
      setToast("リンクを追加しました");
    }
    setShowLinkForm(false);
  };

  const handleDeleteLink = (id: string) => {
    if (confirm("このリンクを削除しますか？")) {
      deleteLink(id);
      setToast("リンクを削除しました");
    }
  };

  // Category handlers
  const openCatForm = (cat?: typeof categories[0]) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, order: cat.order, description: cat.description ?? "" });
    } else {
      setEditingCat(null);
      setCatForm({ name: "", order: categories.length + 1, description: "" });
    }
    setShowCatForm(true);
  };

  const saveCatForm = () => {
    if (!catForm.name) return;
    if (editingCat) {
      updateCategory(editingCat.id, catForm);
      setToast("カテゴリを更新しました");
    } else {
      addCategory(catForm);
      setToast("カテゴリを追加しました");
    }
    setShowCatForm(false);
  };

  const handleDeleteCat = (id: string) => {
    const hasLinks = links.some(l => l.category === id);
    if (hasLinks) {
      alert("このカテゴリにはリンクが存在するため削除できません。先にリンクを移動または削除してください。");
      return;
    }
    if (confirm("このカテゴリを削除しますか？")) {
      deleteCategory(id);
      setToast("カテゴリを削除しました");
    }
  };

  // Account handlers
  const openAccForm = (acc?: AccountInfo) => {
    if (acc) {
      setEditingAcc(acc);
      setAccForm({ serviceName: acc.serviceName, loginId: acc.loginId, password: acc.password, url: acc.url, note: acc.note ?? "", order: acc.order });
    } else {
      setEditingAcc(null);
      setAccForm({ serviceName: "", loginId: "", password: "", url: "", note: "", order: accounts.length + 1 });
    }
    setShowAccForm(true);
  };

  const saveAccForm = () => {
    if (!accForm.serviceName || !accForm.loginId) return;
    if (editingAcc) {
      updateAccount(editingAcc.id, accForm);
      setToast("アカウントを更新しました");
    } else {
      addAccount(accForm);
      setToast("アカウントを追加しました");
    }
    setShowAccForm(false);
  };

  const handleDeleteAcc = (id: string) => {
    if (confirm("このアカウント情報を削除しますか？")) {
      deleteAccount(id);
      setToast("アカウントを削除しました");
    }
  };

  // User management handlers
  const handleAddAllowedEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.endsWith("@dot-jp.or.jp")) {
      alert("@dot-jp.or.jp ドメインのメールアドレスのみ追加できます。");
      return;
    }
    addAllowedEmail(email);
    // staffProfileが存在しなければ自動作成
    const existingProfile = staffProfiles.find(p => p.email === email);
    if (!existingProfile) {
      addStaffProfile({
        email,
        lastName: "",
        fullName: "",
        furigana: "",
        grade: "",
        gender: "other" as const,
        roleIds: [],
        nearestStation: "",
        birthday: "",
        university: "",
      });
    }
    setNewEmail("");
    setToast("メールアドレスを追加しました");
  };

  const handleAddAdminEmail = () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.endsWith("@dot-jp.or.jp")) {
      alert("@dot-jp.or.jp ドメインのメールアドレスのみ追加できます。");
      return;
    }
    addAdminEmail(email);
    // 許可メールにも追加（管理者は当然ログイン可能）
    if (!allowedEmails.includes(email)) {
      addAllowedEmail(email);
    }
    // staffProfileが存在しなければ自動作成
    const existingProfile = staffProfiles.find(p => p.email === email);
    if (!existingProfile) {
      addStaffProfile({
        email,
        lastName: "",
        fullName: "",
        furigana: "",
        grade: "",
        gender: "other" as const,
        roleIds: [],
        nearestStation: "",
        birthday: "",
        university: "",
      });
    }
    setNewAdminEmail("");
    setToast("管理者を追加しました");
  };

  // Announcement handlers
  const openAnnForm = (ann?: Announcement) => {
    if (ann) {
      setEditingAnn(ann);
      setAnnForm({ title: ann.title, content: ann.content, date: ann.date, pinned: ann.pinned });
    } else {
      setEditingAnn(null);
      setAnnForm({ title: "", content: "", date: new Date().toISOString().split("T")[0], pinned: false });
    }
    setShowAnnForm(true);
  };

  const saveAnnForm = () => {
    if (!annForm.title) return;
    if (editingAnn) {
      updateAnnouncement(editingAnn.id, annForm);
      setToast("お知らせを更新しました");
    } else {
      addAnnouncement(annForm);
      setToast("お知らせを追加しました");
    }
    setShowAnnForm(false);
  };

  const handleDeleteAnn = (id: string) => {
    if (confirm("このお知らせを削除しますか？")) {
      deleteAnnouncement(id);
      setToast("お知らせを削除しました");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "links", label: "リンク管理" },
    { id: "categories", label: "カテゴリ管理" },
    { id: "accounts", label: "アカウント管理" },
    { id: "announcements", label: "お知らせ管理" },
    { id: "users", label: "ユーザー管理" },
    { id: "roles", label: "ロール管理" },
  ];

  const iconOptions: { value: LinkIconType; label: string }[] = [
    { value: "spreadsheet", label: "スプレッドシート" },
    { value: "document", label: "ドキュメント" },
    { value: "slide", label: "スライド" },
    { value: "form", label: "フォーム" },
    { value: "video", label: "動画" },
    { value: "folder", label: "フォルダ" },
    { value: "website", label: "ウェブサイト" },
    { value: "other", label: "その他" },
  ];

  return (
    <>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">管理者パネル</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">リンク・カテゴリ・アカウント情報を管理できます</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex-1 py-2 px-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Links tab */}
        {activeTab === "links" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{links.length}件のリンク</p>
              <button onClick={() => openLinkForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> 新規追加
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {sortedCategories.map(cat => {
                const catLinks = links.filter(l => l.category === cat.id).sort((a, b) => a.order - b.order);
                if (catLinks.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="px-4 py-2 bg-gray-50/50">
                      <span className="text-xs font-medium text-gray-500">{cat.name}</span>
                    </div>
                    {catLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                        <LinkIcon type={link.icon} className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{link.title}</p>
                          <p className="text-xs text-gray-400 truncate">{link.url}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openLinkForm(link)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <EditIcon />
                          </button>
                          <button onClick={() => handleDeleteLink(link.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories tab */}
        {activeTab === "categories" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{categories.length}件のカテゴリ</p>
              <button onClick={() => openCatForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> 新規追加
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {sortedCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                    <p className="text-xs text-gray-300">リンク数: {links.filter(l => l.category === cat.id).length}</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">順番: {cat.order}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openCatForm(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <EditIcon />
                    </button>
                    <button onClick={() => handleDeleteCat(cat.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accounts tab */}
        {activeTab === "accounts" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{accounts.length}件のアカウント</p>
              <button onClick={() => openAccForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> 新規追加
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {[...accounts].sort((a, b) => a.order - b.order).map(acc => (
                <div key={acc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{acc.serviceName}</p>
                    <p className="text-xs text-gray-400">{acc.loginId}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openAccForm(acc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <EditIcon />
                    </button>
                    <button onClick={() => handleDeleteAcc(acc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Announcements tab */}
        {activeTab === "announcements" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{announcements.length}件のお知らせ</p>
              <button onClick={() => openAnnForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> 新規追加
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {[...announcements].sort((a, b) => b.date.localeCompare(a.date)).map(ann => (
                <div key={ann.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ann.title}</p>
                      {ann.pinned && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded-full shrink-0">ピン留め</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{ann.date} - {ann.content}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openAnnForm(ann)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <EditIcon />
                    </button>
                    <button onClick={() => handleDeleteAnn(ann.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* 管理者一覧 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">管理者アカウント</h3>
              <p className="text-xs text-gray-500 mb-3">管理者はリンク・カテゴリ・アカウント情報・ユーザーの管理ができます。</p>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                {adminEmails.map(email => (
                  <div key={email} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-purple-700 text-xs font-medium">
                        {email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{email}</p>
                      <p className="text-xs text-purple-600">管理者</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`${email} の管理者権限を削除しますか？`)) {
                          removeAdminEmail(email);
                          setToast("管理者を削除しました");
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  placeholder="admin@dot-jp.or.jp"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => e.key === "Enter" && handleAddAdminEmail()}
                />
                <button
                  onClick={handleAddAdminEmail}
                  className="flex items-center gap-1.5 bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shrink-0"
                >
                  <PlusIcon className="w-4 h-4" /> 追加
                </button>
              </div>
            </div>

            {/* 許可メールアドレス一覧 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">許可メールアドレス（個別追加）</h3>
              <p className="text-xs text-gray-500 mb-3">
                @dot-jp.or.jp ドメインのアカウントは全員ログインできます。それに加えて、個別にメールアドレスを許可したい場合に使います。
              </p>

              {allowedEmails.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {allowedEmails.map(email => (
                    <div key={email} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-blue-700 text-xs font-medium">
                          {email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="flex-1 text-sm text-gray-900 truncate">{email}</p>
                      <button
                        onClick={() => {
                          if (confirm(`${email} を許可リストから削除しますか？`)) {
                            removeAllowedEmail(email);
                            // 対応するstaffProfileも削除
                            const profileToDelete = staffProfiles.find(p => p.email === email);
                            if (profileToDelete) {
                              deleteStaffProfile(profileToDelete.id);
                            }
                            setToast("メールアドレスを削除しました");
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400">個別に追加されたメールアドレスはありません</p>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="name@dot-jp.or.jp"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => e.key === "Enter" && handleAddAllowedEmail()}
                />
                <button
                  onClick={handleAddAllowedEmail}
                  className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                >
                  <PlusIcon className="w-4 h-4" /> 追加
                </button>
              </div>
            </div>

            {/* セキュリティ情報 */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">セキュリティについて</h3>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• ログインは @dot-jp.or.jp ドメインの Google アカウントに限定されます</li>
                <li>• Google OAuth の hd パラメータでドメインを検証します</li>
                <li>• Google Cloud Console の OAuth クライアントID 設定が必要です（無料）</li>
                <li>• Firebase は使用しません — 静的ホスティング（GitHub Pages）で運用可能です</li>
                <li>• データは各ユーザーのブラウザ（localStorage）に保存されます</li>
              </ul>
            </div>
          </div>
        )}

        {/* Roles tab */}
        {activeTab === "roles" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">ロール一覧（役職・部署）</h3>
              <p className="text-xs text-gray-500 mb-3">
                スタッフに割り当てるロールを管理します。各スタッフは「スケジュール &gt; スタッフ設定」からロールを選択できます。
              </p>

              {staffRoles.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {[...staffRoles].sort((a, b) => a.order - b.order).map(role => (
                    <div key={role.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                      {editingRoleId === role.id ? (
                        <>
                          <input
                            type="text"
                            value={editingRoleName}
                            onChange={e => setEditingRoleName(e.target.value)}
                            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter" && editingRoleName.trim()) {
                                updateStaffRole(role.id, { name: editingRoleName.trim() });
                                setEditingRoleId(null);
                                setToast("ロールを更新しました");
                              }
                              if (e.key === "Escape") setEditingRoleId(null);
                            }}
                          />
                          <button
                            onClick={() => {
                              if (editingRoleName.trim()) {
                                updateStaffRole(role.id, { name: editingRoleName.trim() });
                                setEditingRoleId(null);
                                setToast("ロールを更新しました");
                              }
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12" strokeWidth="2" /></svg>
                          </button>
                          <button
                            onClick={() => setEditingRoleId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 text-xs font-medium">
                              {role.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{role.name}</p>
                          </div>
                          <span className="text-xs text-gray-300 shrink-0">#{role.order}</span>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingRoleId(role.id); setEditingRoleName(role.name); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <EditIcon />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`「${role.name}」を削除しますか？このロールが割り当てられているスタッフからも削除されます。`)) {
                                  deleteStaffRole(role.id);
                                  setToast("ロールを削除しました");
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400">ロールがありません</p>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  placeholder="例: マーケティング部署"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => {
                    if (e.key === "Enter" && newRoleName.trim()) {
                      addStaffRole(newRoleName.trim());
                      setNewRoleName("");
                      setToast("ロールを追加しました");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newRoleName.trim()) {
                      addStaffRole(newRoleName.trim());
                      setNewRoleName("");
                      setToast("ロールを追加しました");
                    }
                  }}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                >
                  <PlusIcon className="w-4 h-4" /> 追加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Link Modal */}
      {showLinkForm && (
        <Modal title={editingLink ? "リンクを編集" : "リンクを追加"} onClose={() => setShowLinkForm(false)}>
          <div className="space-y-3">
            <FormField label="タイトル">
              <input value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))} className="form-input" placeholder="例: 支部運営管理シート" />
            </FormField>
            <FormField label="URL">
              <input value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} className="form-input" placeholder="https://..." />
            </FormField>
            <FormField label="説明">
              <input value={linkForm.description} onChange={e => setLinkForm(f => ({ ...f, description: e.target.value }))} className="form-input" placeholder="このリンクの簡単な説明" />
            </FormField>
            <FormField label="カテゴリ">
              <select value={linkForm.category} onChange={e => setLinkForm(f => ({ ...f, category: e.target.value }))} className="form-input">
                {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="アイコン種別">
              <select value={linkForm.icon} onChange={e => setLinkForm(f => ({ ...f, icon: e.target.value as LinkIconType }))} className="form-input">
                {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField label="表示順">
              <input type="number" value={linkForm.order} onChange={e => setLinkForm(f => ({ ...f, order: Number(e.target.value) }))} className="form-input" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowLinkForm(false)} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">キャンセル</button>
              <button onClick={saveLinkForm} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Category Modal */}
      {showCatForm && (
        <Modal title={editingCat ? "カテゴリを編集" : "カテゴリを追加"} onClose={() => setShowCatForm(false)}>
          <div className="space-y-3">
            <FormField label="カテゴリ名">
              <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="例: コンシューマー" />
            </FormField>
            <FormField label="説明">
              <input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} className="form-input" placeholder="このカテゴリの説明" />
            </FormField>
            <FormField label="表示順">
              <input type="number" value={catForm.order} onChange={e => setCatForm(f => ({ ...f, order: Number(e.target.value) }))} className="form-input" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCatForm(false)} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">キャンセル</button>
              <button onClick={saveCatForm} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Announcement Modal */}
      {showAnnForm && (
        <Modal title={editingAnn ? "お知らせを編集" : "お知らせを追加"} onClose={() => setShowAnnForm(false)}>
          <div className="space-y-3">
            <FormField label="タイトル">
              <input value={annForm.title} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} className="form-input" placeholder="お知らせのタイトル" />
            </FormField>
            <FormField label="内容">
              <textarea value={annForm.content} onChange={e => setAnnForm(f => ({ ...f, content: e.target.value }))} className="form-input" rows={4} placeholder="お知らせの内容" style={{ resize: "vertical" }} />
            </FormField>
            <FormField label="日付">
              <input type="date" value={annForm.date} onChange={e => setAnnForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
            </FormField>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ann-pinned" checked={annForm.pinned} onChange={e => setAnnForm(f => ({ ...f, pinned: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="ann-pinned" className="text-sm text-gray-700">ピン留めする（常に上部に表示）</label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAnnForm(false)} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">キャンセル</button>
              <button onClick={saveAnnForm} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Account Modal */}
      {showAccForm && (
        <Modal title={editingAcc ? "アカウントを編集" : "アカウントを追加"} onClose={() => setShowAccForm(false)}>
          <div className="space-y-3">
            <FormField label="サービス名">
              <input value={accForm.serviceName} onChange={e => setAccForm(f => ({ ...f, serviceName: e.target.value }))} className="form-input" placeholder="例: Sales Force" />
            </FormField>
            <FormField label="ログインID">
              <input value={accForm.loginId} onChange={e => setAccForm(f => ({ ...f, loginId: e.target.value }))} className="form-input" placeholder="例: kanto3@dot-jp.or.jp" />
            </FormField>
            <FormField label="パスワード">
              <input value={accForm.password} onChange={e => setAccForm(f => ({ ...f, password: e.target.value }))} className="form-input" placeholder="パスワード" />
            </FormField>
            <FormField label="ログインURL">
              <input value={accForm.url} onChange={e => setAccForm(f => ({ ...f, url: e.target.value }))} className="form-input" placeholder="https://..." />
            </FormField>
            <FormField label="備考">
              <input value={accForm.note} onChange={e => setAccForm(f => ({ ...f, note: e.target.value }))} className="form-input" placeholder="任意のメモ" />
            </FormField>
            <FormField label="表示順">
              <input type="number" value={accForm.order} onChange={e => setAccForm(f => ({ ...f, order: Number(e.target.value) }))} className="form-input" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAccForm(false)} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">キャンセル</button>
              <button onClick={saveAccForm} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">保存</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      <style jsx global>{`
        .form-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.15s;
        }
        .form-input:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px #3b82f6;
        }
      `}</style>
    </div>
  );
}

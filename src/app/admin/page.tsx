"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useCountdown } from "@/contexts/CountdownContext";
import Toast from "@/components/Toast";
import { LinkIcon, PlusIcon, TrashIcon, EditIcon, CloseIcon } from "@/components/Icons";
import type { LinkItem, LinkIconType, AccountInfo, InstagramAccount, Announcement, AnnouncementCategory } from "@/types";

type Tab = "links" | "categories" | "accounts" | "users" | "roles" | "announcements" | "announcementCategories" | "countdowns";

export default function AdminPage() {
  const { user, isLoading, isAdmin, allowedEmails, adminEmails, addAllowedEmail, removeAllowedEmail, addAdminEmail, removeAdminEmail } = useAuth();
  const {
    links, categories, accounts, instaAccounts, announcements, announcementCategories,
    addLink, updateLink, deleteLink,
    addCategory, updateCategory, deleteCategory,
    addAccount, updateAccount, deleteAccount,
    addInstaAccount, updateInstaAccount, deleteInstaAccount,
    addAnnouncement, updateAnnouncement, deleteAnnouncement,
    addAnnouncementCategory, updateAnnouncementCategory, deleteAnnouncementCategory,
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

  // Insta account form state
  const [accSubTab, setAccSubTab] = useState<"site" | "insta">("site");
  const [showInstaForm, setShowInstaForm] = useState(false);
  const [editingInsta, setEditingInsta] = useState<InstagramAccount | null>(null);
  const [instaForm, setInstaForm] = useState({ handle: "", email: "", password: "", note: "", loggedInUsers: [] as string[], order: 0 });

  // Announcement form state
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annForm, setAnnForm] = useState({
    title: "", content: "", date: new Date().toISOString().split("T")[0], pinned: false,
    category: "" as string, targetType: "all" as "all" | "select" | "role",
    targetEmails: [] as string[], expiresAt: "" as string, url: "" as string, createdBy: "" as string,
  });

  // Announcement category management
  const [newAnnCatName, setNewAnnCatName] = useState("");
  const [editingAnnCatId, setEditingAnnCatId] = useState<string | null>(null);
  const [editingAnnCatName, setEditingAnnCatName] = useState("");

  // User management state
  const [newEmail, setNewEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // Role management
  const { staffRoles, addStaffRole, updateStaffRole, deleteStaffRole, staffProfiles, addStaffProfile, updateStaffProfile, deleteStaffProfile } = useSchedule();
  const [newRoleName, setNewRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");

  // Countdown
  const { countdowns, addCountdown, deleteCountdown } = useCountdown();
  const [newCountdownTitle, setNewCountdownTitle] = useState("");
  const [newCountdownDate, setNewCountdownDate] = useState("");

  // Drag-and-drop reorder refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDrop = <T extends { id: string; order: number }>(
    items: T[],
    updateFn: (id: string, updates: { order: number }) => void | Promise<void>
  ) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    const newItems = [...items];
    const dragged = newItems.splice(dragItem.current, 1)[0];
    newItems.splice(dragOverItem.current, 0, dragged);
    newItems.forEach((item, i) => updateFn(item.id, { order: i + 1 }));
    dragItem.current = null;
    dragOverItem.current = null;
  };

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

  // Insta account handlers
  const openInstaForm = (acc?: InstagramAccount) => {
    if (acc) {
      setEditingInsta(acc);
      setInstaForm({ handle: acc.handle, email: acc.email ?? "", password: acc.password ?? "", note: acc.note ?? "", loggedInUsers: acc.loggedInUsers, order: acc.order });
    } else {
      setEditingInsta(null);
      setInstaForm({ handle: "", email: "", password: "", note: "", loggedInUsers: [], order: instaAccounts.length + 1 });
    }
    setShowInstaForm(true);
  };

  const saveInstaForm = () => {
    const handle = instaForm.handle.replace(/^@/, "").trim();
    if (!handle) return;
    const data = {
      handle,
      email: instaForm.email.trim() || undefined,
      password: instaForm.password || undefined,
      note: instaForm.note.trim() || undefined,
      loggedInUsers: instaForm.loggedInUsers,
      order: instaForm.order,
    };
    if (editingInsta) {
      updateInstaAccount(editingInsta.id, data);
      setToast("インスタアカウントを更新しました");
    } else {
      addInstaAccount(data);
      setToast("インスタアカウントを追加しました");
    }
    setShowInstaForm(false);
  };

  const handleDeleteInsta = (id: string) => {
    if (confirm("このインスタアカウントを削除しますか？")) {
      deleteInstaAccount(id);
      setToast("インスタアカウントを削除しました");
    }
  };

  const toggleInstaUser = (email: string) => {
    setInstaForm(prev => ({
      ...prev,
      loggedInUsers: prev.loggedInUsers.includes(email)
        ? prev.loggedInUsers.filter(e => e !== email)
        : [...prev.loggedInUsers, email],
    }));
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
      setAnnForm({
        title: ann.title, content: ann.content, date: ann.date, pinned: ann.pinned,
        category: ann.category || "", targetType: ann.targetType || "all",
        targetEmails: ann.targetEmails || [], expiresAt: ann.expiresAt || "",
        url: ann.url || "", createdBy: ann.createdBy || "",
      });
    } else {
      setEditingAnn(null);
      setAnnForm({
        title: "", content: "", date: new Date().toISOString().split("T")[0], pinned: false,
        category: "", targetType: "all", targetEmails: [], expiresAt: "", url: "",
        createdBy: user?.email || "",
      });
    }
    setShowAnnForm(true);
  };

  const saveAnnForm = () => {
    if (!annForm.title) return;
    const data = {
      ...annForm,
      category: annForm.category || undefined,
      targetType: annForm.targetType || undefined,
      targetEmails: annForm.targetEmails.length > 0 ? annForm.targetEmails : undefined,
      expiresAt: annForm.expiresAt || undefined,
      url: annForm.url || undefined,
      createdBy: annForm.createdBy || user?.email || undefined,
    };
    if (editingAnn) {
      updateAnnouncement(editingAnn.id, data);
      setToast("お知らせを更新しました");
    } else {
      addAnnouncement(data);
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
    { id: "announcementCategories", label: "お知らせカテゴリ" },
    { id: "users", label: "ユーザー管理" },
    { id: "roles", label: "ロール管理" },
    { id: "countdowns", label: "カウントダウン" },
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

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar tabs (desktop) / Horizontal tabs (mobile) */}
          <div className="md:w-48 shrink-0">
            <div className="flex md:flex-col gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 overflow-x-auto md:overflow-x-visible scrollbar-none">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap text-left ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0">

        {/* Links tab */}
        {activeTab === "links" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{links.length}件のリンク</p>
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
                    <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-700/30">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{cat.name}</span>
                    </div>
                    {catLinks.map((link, idx) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                        draggable
                        onDragStart={() => { dragItem.current = idx; }}
                        onDragOver={(e) => { e.preventDefault(); dragOverItem.current = idx; }}
                        onDrop={() => handleDrop(catLinks, updateLink)}
                        onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; }}
                      >
                        <div className="cursor-grab active:cursor-grabbing shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                        </div>
                        <LinkIcon type={link.icon} className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{link.title}</p>
                          <p className="text-xs text-gray-400 truncate">{link.url}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openLinkForm(link)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                            <EditIcon />
                          </button>
                          <button onClick={() => handleDeleteLink(link.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">{categories.length}件のカテゴリ</p>
              <button onClick={() => openCatForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> 新規追加
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {sortedCategories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                  draggable
                  onDragStart={() => { dragItem.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); dragOverItem.current = idx; }}
                  onDrop={() => handleDrop(sortedCategories, updateCategory)}
                  onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; }}
                >
                  <div className="cursor-grab active:cursor-grabbing shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500">リンク数: {links.filter(l => l.category === cat.id).length}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openCatForm(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                      <EditIcon />
                    </button>
                    <button onClick={() => handleDeleteCat(cat.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
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
            {/* Sub-tabs */}
            <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setAccSubTab("site")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${accSubTab === "site" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                サイト
              </button>
              <button
                onClick={() => setAccSubTab("insta")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${accSubTab === "insta" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
              >
                インスタ
              </button>
            </div>

            {/* Site accounts */}
            {accSubTab === "site" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{accounts.length}件</p>
                  <button onClick={() => openAccForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    <PlusIcon className="w-4 h-4" /> 新規追加
                  </button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {(() => { const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order); return sortedAccounts.map((acc, idx) => (
                    <div
                      key={acc.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                      draggable
                      onDragStart={() => { dragItem.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); dragOverItem.current = idx; }}
                      onDrop={() => handleDrop(sortedAccounts, updateAccount)}
                      onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; }}
                    >
                      <div className="cursor-grab active:cursor-grabbing shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{acc.serviceName}</p>
                        <p className="text-xs text-gray-400">{acc.loginId}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openAccForm(acc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleDeleteAcc(acc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )); })()}
                </div>
              </div>
            )}

            {/* Instagram accounts */}
            {accSubTab === "insta" && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{instaAccounts.length}件</p>
                  <button onClick={() => openInstaForm()} className="flex items-center gap-1.5 bg-pink-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-pink-700 transition-colors">
                    <PlusIcon className="w-4 h-4" /> 新規追加
                  </button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {[...instaAccounts].sort((a, b) => a.order - b.order).map((acc) => (
                    <div key={acc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">@{acc.handle}</p>
                        <p className="text-xs text-gray-400">
                          {acc.loggedInUsers.length > 0
                            ? `ログイン中: ${acc.loggedInUsers.map(e => { const p = staffProfiles.find(p => p.email === e); return p ? (p.fullName || p.lastName) : e; }).join(", ")}`
                            : "ログイン中なし"}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openInstaForm(acc)} className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/30 rounded transition-colors">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleDeleteInsta(acc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Announcements tab */}
        {activeTab === "announcements" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{announcements.length}件のお知らせ</p>
              <button onClick={() => openAnnForm()} className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <PlusIcon className="w-4 h-4" /> 新規追加
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {[...announcements].sort((a, b) => b.date.localeCompare(a.date)).map(ann => (
                <div key={ann.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
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
                    <button onClick={() => openAnnForm(ann)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors">
                      <EditIcon />
                    </button>
                    <button onClick={() => handleDeleteAnn(ann.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">管理者はリンク・カテゴリ・アカウント情報・ユーザーの管理ができます。</p>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                {adminEmails.map(email => (
                  <div key={email} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-purple-700 text-xs font-medium">
                        {email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{email}</p>
                      <p className="text-xs text-purple-600">管理者</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`${email} の管理者権限を削除しますか？`)) {
                          removeAdminEmail(email);
                          setToast("管理者を削除しました");
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors shrink-0"
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
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
                      <p className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">{email}</p>
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
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors shrink-0"
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

            {/* メンバーロール管理 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">メンバーロール管理</h3>
              <p className="text-xs text-gray-500 mb-3">
                各メンバーにロールを割り当てます。1人に複数のロールを設定できます。
              </p>
              {staffProfiles.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {[...staffProfiles].sort((a, b) => (a.fullName || a.lastName).localeCompare(b.fullName || b.lastName)).map(profile => {
                    const displayName = profile.fullName || profile.lastName || profile.email;
                    return (
                      <div key={profile.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-blue-700 dark:text-blue-300 text-xs font-medium">
                              {displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
                          </div>
                        </div>
                        {staffRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 ml-10">
                            {[...staffRoles].sort((a, b) => a.order - b.order).map(role => {
                              const hasRole = (profile.roleIds ?? []).includes(role.id);
                              return (
                                <button
                                  key={role.id}
                                  onClick={() => {
                                    const currentRoles = profile.roleIds ?? [];
                                    const newRoles = hasRole
                                      ? currentRoles.filter(r => r !== role.id)
                                      : [...currentRoles, role.id];
                                    updateStaffProfile(profile.id, { roleIds: newRoles });
                                    setToast(`${displayName}のロールを更新しました`);
                                  }}
                                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                    hasRole
                                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600"
                                      : "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                                  }`}
                                >
                                  {hasRole ? "✓ " : ""}{role.name}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 ml-10">ロールが未登録です。「ロール管理」タブから追加してください。</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400">メンバーが登録されていません</p>
                </div>
              )}
            </div>

            {/* セキュリティ情報 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">セキュリティについて</h3>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <li>• ログインは @dot-jp.or.jp ドメインの Google アカウントに限定されます</li>
                <li>• Google OAuth の hd パラメータでドメインを検証します</li>
                <li>• Google Cloud Console の OAuth クライアントID 設定が必要です（無料）</li>
                <li>• データは Firebase Firestore にリアルタイム同期されます</li>
                <li>• Firestore セキュリティルールの設定を忘れずに行ってください</li>
              </ul>
            </div>
          </div>
        )}

        {/* Roles tab */}
        {activeTab === "roles" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">ロール一覧（役職・部署）</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                スタッフに割り当てるロールを管理します。各スタッフはマイページからロールを選択できます。
              </p>

              {staffRoles.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {(() => { const sortedRoles = [...staffRoles].sort((a, b) => a.order - b.order); return sortedRoles.map((role, idx) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                      draggable={editingRoleId !== role.id}
                      onDragStart={() => { if (editingRoleId !== role.id) dragItem.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); dragOverItem.current = idx; }}
                      onDrop={() => handleDrop(sortedRoles, updateStaffRole)}
                      onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; }}
                    >
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
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12" strokeWidth="2" /></svg>
                          </button>
                          <button
                            onClick={() => setEditingRoleId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="cursor-grab active:cursor-grabbing shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                          </div>
                          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                              {role.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-gray-100">{role.name}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingRoleId(role.id); setEditingRoleName(role.name); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
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
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )); })()}
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

        {/* Announcement Categories tab */}
        {activeTab === "announcementCategories" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">お知らせカテゴリ一覧</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">お知らせに設定するカテゴリを管理します。</p>

              {announcementCategories.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {(() => { const sortedAnnCats = [...announcementCategories].sort((a, b) => a.order - b.order); return sortedAnnCats.map((cat, idx) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
                      draggable={editingAnnCatId !== cat.id}
                      onDragStart={() => { if (editingAnnCatId !== cat.id) dragItem.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); dragOverItem.current = idx; }}
                      onDrop={() => handleDrop(sortedAnnCats, updateAnnouncementCategory)}
                      onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; }}
                    >
                      {editingAnnCatId === cat.id ? (
                        <>
                          <input
                            type="text"
                            value={editingAnnCatName}
                            onChange={e => setEditingAnnCatName(e.target.value)}
                            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter" && editingAnnCatName.trim()) {
                                updateAnnouncementCategory(cat.id, { name: editingAnnCatName.trim() });
                                setEditingAnnCatId(null);
                                setToast("カテゴリを更新しました");
                              }
                              if (e.key === "Escape") setEditingAnnCatId(null);
                            }}
                          />
                          <button
                            onClick={() => {
                              if (editingAnnCatName.trim()) {
                                updateAnnouncementCategory(cat.id, { name: editingAnnCatName.trim() });
                                setEditingAnnCatId(null);
                                setToast("カテゴリを更新しました");
                              }
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12" strokeWidth="2" /></svg>
                          </button>
                          <button
                            onClick={() => setEditingAnnCatId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="cursor-grab active:cursor-grabbing shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-gray-100">{cat.name}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingAnnCatId(cat.id); setEditingAnnCatName(cat.name); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            >
                              <EditIcon />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`「${cat.name}」を削除しますか？`)) {
                                  deleteAnnouncementCategory(cat.id);
                                  setToast("カテゴリを削除しました");
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )); })()}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">カテゴリがありません</p>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newAnnCatName}
                  onChange={e => setNewAnnCatName(e.target.value)}
                  placeholder="例: 重要連絡"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => {
                    if (e.key === "Enter" && newAnnCatName.trim()) {
                      addAnnouncementCategory({ name: newAnnCatName.trim(), order: announcementCategories.length + 1 });
                      setNewAnnCatName("");
                      setToast("カテゴリを追加しました");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newAnnCatName.trim()) {
                      addAnnouncementCategory({ name: newAnnCatName.trim(), order: announcementCategories.length + 1 });
                      setNewAnnCatName("");
                      setToast("カテゴリを追加しました");
                    }
                  }}
                  className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                >
                  <PlusIcon className="w-4 h-4" /> 追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Countdowns tab */}
        {activeTab === "countdowns" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">カウントダウン管理</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">ダッシュボードに表示されるカウントダウンイベントを管理します。</p>
              {countdowns.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {[...countdowns].sort((a, b) => a.targetDate.localeCompare(b.targetDate)).map(item => {
                    const days = Math.ceil((new Date(item.targetDate + "T00:00:00").getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                          <p className="text-xs text-gray-400">{item.targetDate} ({days > 0 ? `あと${days}日` : days === 0 ? "今日" : `${Math.abs(days)}日前`})</p>
                        </div>
                        <button
                          onClick={() => { if (confirm(`「${item.title}」を削除しますか？`)) { deleteCountdown(item.id); setToast("カウントダウンを削除しました"); } }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors shrink-0"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400">カウントダウンがありません</p>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <input type="text" value={newCountdownTitle} onChange={e => setNewCountdownTitle(e.target.value)} placeholder="イベント名" className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <input type="date" value={newCountdownDate} onChange={e => setNewCountdownDate(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <button
                  onClick={() => { if (newCountdownTitle.trim() && newCountdownDate) { addCountdown({ title: newCountdownTitle.trim(), targetDate: newCountdownDate, createdBy: user?.email || "" }); setNewCountdownTitle(""); setNewCountdownDate(""); setToast("カウントダウンを追加しました"); } }}
                  className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                >
                  <PlusIcon className="w-4 h-4" /> 追加
                </button>
              </div>
            </div>
          </div>
        )}

          </div>{/* end content area */}
        </div>{/* end sidebar layout */}
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
            <FormField label="カテゴリ">
              <select value={annForm.category} onChange={e => setAnnForm(f => ({ ...f, category: e.target.value }))} className="form-input">
                <option value="">カテゴリなし</option>
                {[...announcementCategories].sort((a, b) => a.order - b.order).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="日付">
              <input type="date" value={annForm.date} onChange={e => setAnnForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
            </FormField>
            <FormField label="掲載終了日">
              <input type="date" value={annForm.expiresAt} onChange={e => setAnnForm(f => ({ ...f, expiresAt: e.target.value }))} className="form-input" />
            </FormField>
            <FormField label="関連リンク">
              <input value={annForm.url} onChange={e => setAnnForm(f => ({ ...f, url: e.target.value }))} className="form-input" placeholder="https://..." />
            </FormField>
            <FormField label="対象">
              <select value={annForm.targetType} onChange={e => setAnnForm(f => ({ ...f, targetType: e.target.value as "all" | "select" | "role" }))} className="form-input">
                <option value="all">全体</option>
                <option value="select">個人指定</option>
                <option value="role">ロール指定</option>
              </select>
            </FormField>
            {annForm.targetType === "select" && (
              <FormField label="対象メールアドレス（カンマ区切り）">
                <input
                  value={annForm.targetEmails.join(", ")}
                  onChange={e => setAnnForm(f => ({ ...f, targetEmails: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                  className="form-input"
                  placeholder="user1@example.com, user2@example.com"
                />
              </FormField>
            )}
            {annForm.targetType === "role" && (
              <FormField label="対象ロール">
                <div className="flex flex-wrap gap-2">
                  {staffRoles.map(role => {
                    const roleKey = `role:${role.id}`;
                    const isSelected = annForm.targetEmails.includes(roleKey);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setAnnForm(f => ({
                            ...f,
                            targetEmails: isSelected
                              ? f.targetEmails.filter(e => e !== roleKey)
                              : [...f.targetEmails, roleKey],
                          }));
                        }}
                        className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                        }`}
                      >
                        {role.name}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            )}
            <FormField label="作成者メール">
              <input value={annForm.createdBy} onChange={e => setAnnForm(f => ({ ...f, createdBy: e.target.value }))} className="form-input" placeholder="自動入力" />
            </FormField>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ann-pinned" checked={annForm.pinned} onChange={e => setAnnForm(f => ({ ...f, pinned: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="ann-pinned" className="text-sm text-gray-700 dark:text-gray-300">ピン留めする（常に上部に表示）</label>
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

      {/* Instagram Account Modal */}
      {showInstaForm && (
        <Modal title={editingInsta ? "インスタアカウントを編集" : "インスタアカウントを追加"} onClose={() => setShowInstaForm(false)}>
          <div className="space-y-3">
            <FormField label="アカウントID（必須）">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
                <input
                  value={instaForm.handle}
                  onChange={e => setInstaForm(f => ({ ...f, handle: e.target.value.replace(/^@/, "") }))}
                  className="form-input pl-7"
                  placeholder="yugaapple"
                />
              </div>
            </FormField>
            <FormField label="メールアドレス（任意）">
              <input value={instaForm.email} onChange={e => setInstaForm(f => ({ ...f, email: e.target.value }))} className="form-input" placeholder="example@gmail.com" />
            </FormField>
            <FormField label="パスワード（任意）">
              <input value={instaForm.password} onChange={e => setInstaForm(f => ({ ...f, password: e.target.value }))} className="form-input" placeholder="パスワード" />
            </FormField>
            <FormField label="備考（任意）">
              <input value={instaForm.note} onChange={e => setInstaForm(f => ({ ...f, note: e.target.value }))} className="form-input" placeholder="例: 集客メインアカウント" />
            </FormField>
            <FormField label="ログイン中のメンバー（複数選択可）">
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {staffProfiles.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">メンバーが登録されていません</p>
                ) : [...staffProfiles].sort((a, b) => (a.fullName || a.lastName).localeCompare(b.fullName || b.lastName)).map(p => (
                  <label key={p.email} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={instaForm.loggedInUsers.includes(p.email)}
                      onChange={() => toggleInstaUser(p.email)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{p.fullName || p.lastName}</span>
                    <span className="text-xs text-gray-400 ml-auto">{p.email}</span>
                  </label>
                ))}
              </div>
            </FormField>
            <FormField label="表示順">
              <input type="number" value={instaForm.order} onChange={e => setInstaForm(f => ({ ...f, order: Number(e.target.value) }))} className="form-input" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowInstaForm(false)} className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">キャンセル</button>
              <button onClick={saveInstaForm} disabled={!instaForm.handle.trim()} className="flex-1 py-2 text-sm bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">保存</button>
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
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
      <style jsx global>{`
        .form-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: #ffffff;
          color: #111827;
          outline: none;
          transition: all 0.15s;
        }
        .form-input:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px #3b82f6;
        }
        .dark .form-input {
          background: #374151;
          border-color: #4b5563;
          color: #f3f4f6;
        }
        .dark .form-input:focus {
          border-color: transparent;
          box-shadow: 0 0 0 2px #3b82f6;
        }
      `}</style>
    </div>
  );
}

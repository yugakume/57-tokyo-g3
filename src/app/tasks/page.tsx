"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTask } from "@/contexts/TaskContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { PlusIcon, CloseIcon, TrashIcon, CheckIcon } from "@/components/Icons";
import type { Task, TaskStatus, TaskPriority } from "@/types";

// =============================================
// 定数
// =============================================

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "todo", label: "未着手", color: "bg-gray-100 text-gray-700" },
  { key: "done", label: "完了", color: "bg-green-100 text-green-700" },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "未着手",
  done: "完了",
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "高", color: "bg-red-100 text-red-700" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  low: { label: "低", color: "bg-green-100 text-green-700" },
};

function formatDate(dateStr: string, timeStr?: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  let result = `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
  if (timeStr) {
    result = `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
  }
  return result;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// =============================================
// メインページ
// =============================================

export default function TasksPage() {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();
  const { tasks, addTask, updateTask, deleteTask, updateTaskStatus } = useTask();
  const { staffProfiles, staffRoles } = useSchedule();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [hideDone, setHideDone] = useState(false);
  const [taskCategory, setTaskCategory] = useState<"mine" | "requested">("mine");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"normal" | "done">("normal");
  const [mailtoTask, setMailtoTask] = useState<Task | null>(null);
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  // スタッフ名のルックアップ（fullName優先）
  const staffNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    staffProfiles.forEach(p => {
      map[p.email] = (p as { fullName?: string }).fullName || p.lastName;
    });
    return map;
  }, [staffProfiles]);

  // ヘルパー: タスクが全体タスクか
  const isAllTask = (t: Task) => t.assigneeEmails?.length === 1 && t.assigneeEmails[0] === "all";
  // ヘルパー: タスクが複数人タスクか（全体含む）
  const isMultiTask = (t: Task) => isAllTask(t) || (t.assigneeEmails?.length ?? 0) > 1;

  // 自分のロールID
  const myRoleIds = useMemo(() => {
    const profile = staffProfiles.find(p => p.email === user?.email);
    return profile?.roleIds || [];
  }, [staffProfiles, user]);

  // タスクが自分に割り当てられているか
  const isAssignedToMe = useCallback((t: Task) => {
    if (isAllTask(t)) return true;
    if ((t.assigneeEmails || []).includes(user?.email || "")) return true;
    return (t.assigneeEmails || []).some(e => e.startsWith("role:") && myRoleIds.includes(e.replace("role:", "")));
  }, [user, myRoleIds]);

  // 担当者フィルタの選択肢
  const assigneeOptions = useMemo(() => {
    const emails = new Set<string>();
    tasks.forEach(t => {
      (t.assigneeEmails || []).forEach(e => emails.add(e));
    });
    return Array.from(emails).sort();
  }, [tasks]);

  // フィルタ済みタスク（カテゴリ + 担当者フィルタ）
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // カテゴリフィルタ
    if (taskCategory === "mine") {
      // 自分に割り当てられたタスク（自分が作成 or 他人が依頼、すべて含む）
      result = result.filter(t => isAssignedToMe(t));
    } else if (taskCategory === "requested") {
      // 自分が作成し、他人に依頼したタスク
      result = result.filter(t => {
        if (t.createdBy !== user?.email) return false;
        const emails = t.assigneeEmails || [];
        if (emails.length === 1 && emails[0] === user?.email) return false;
        return true;
      });
    }

    // 担当者フィルタ（追加絞り込み）
    if (filterAssignee !== "all") {
      result = result.filter(t =>
        isAllTask(t) || (t.assigneeEmails || []).includes(filterAssignee)
      );
    }
    return result;
  }, [tasks, filterAssignee, taskCategory, user, isAssignedToMe]);

  // カラムごとのタスク
  const columnTasks = useMemo(() => {
    const result: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    filteredTasks.forEach(t => {
      // in_progressは未着手として扱う
      if (t.status === "in_progress") {
        result["todo"].push(t);
      } else {
        result[t.status].push(t);
      }
    });
    // 各カラム内を期限日でソート（期限が近い順、期限なしは最後）
    for (const key of Object.keys(result) as TaskStatus[]) {
      result[key].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    return result;
  }, [filteredTasks]);

  const showToast = (msg: string, type: "normal" | "done" = "normal") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => { setToast(""); setToastType("normal"); }, type === "done" ? 3000 : 2500);
  };

  const handleAdd = (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    const newTask = addTask(data);
    setShowAddModal(false);
    showToast("タスクを追加しました");
    // 複数人/全体タスクの場合、メール通知モーダルを表示
    if (data.assigneeEmails.length > 1 || (data.assigneeEmails.length === 1 && data.assigneeEmails[0] === "all")) {
      setMailtoTask(newTask);
    }
  };

  const handleUpdate = (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    if (!editingTask) return;
    updateTask(editingTask.id, data);
    setEditingTask(null);
    showToast("タスクを更新しました");
  };

  const handleDeleteFromModal = (id: string) => {
    if (!confirm("このタスクを削除しますか？")) return;
    deleteTask(id);
    setEditingTask(null);
    showToast("削除しました");
  };

  const handleStatusChange = useCallback((id: string, newStatus: TaskStatus, e?: React.MouseEvent) => {
    if (newStatus === "done") {
      // 完了アニメーション — 先にステータス更新してから演出
      if (e) {
        setConfettiOrigin({ x: e.clientX, y: e.clientY });
      }
      setCompletedTaskId(id);
      updateTaskStatus(id, newStatus);
      showToast("タスク完了！🎉 「完了」列に移動しました", "done");
      setTimeout(() => {
        setCompletedTaskId(null);
        setConfettiOrigin(null);
      }, 1500);
    } else {
      updateTaskStatus(id, newStatus);
      showToast(`ステータスを「${STATUS_LABELS[newStatus]}」に変更しました`);
    }
  }, [updateTaskStatus]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">タスク管理</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          タスクを追加
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {([
          { key: "mine", label: "自分のタスク" },
          { key: "requested", label: "依頼したタスク" },
        ] as const).map(cat => (
          <button
            key={cat.key}
            onClick={() => setTaskCategory(cat.key)}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              taskCategory === cat.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm font-medium"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-sm text-gray-600 dark:text-gray-400 shrink-0">担当者で絞り込み:</label>
        <select
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 max-w-full"
        >
          <option value="all">すべて</option>
          {assigneeOptions.map(email => (
            <option key={email} value={email}>
              {email === "all" ? "全体（全メンバー）" : (staffNameMap[email] || email)}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filteredTasks.length}件</span>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 sm:ml-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={e => setHideDone(e.target.checked)}
            className="rounded border-gray-300"
          />
          完了を非表示
        </label>
      </div>

      {/* Kanban Board */}
      <div className={`grid grid-cols-1 ${hideDone ? "" : "md:grid-cols-2"} gap-4`}>
        {STATUS_COLUMNS.filter(col => !(hideDone && col.key === "done")).map(col => (
          <div key={col.key} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 min-h-[300px]">
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${col.color}`}>
                {col.label}
              </span>
              <span className="text-xs text-gray-400">
                {columnTasks[col.key].length}件
              </span>
            </div>

            {/* Task Cards */}
            <div className="space-y-3">
              {columnTasks[col.key].length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">タスクなし</p>
              ) : (
                columnTasks[col.key].map(task => {
                  const canEdit = isAdmin || task.createdBy === user.email;
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      staffNameMap={staffNameMap}
                      staffProfiles={staffProfiles}
                      staffRoles={staffRoles}
                      onStatusChange={handleStatusChange}
                      onEdit={canEdit ? () => setEditingTask(task) : undefined}
                      isAdmin={isAdmin}
                      currentUserEmail={user.email}
                      isCompleting={completedTaskId === task.id}
                    />
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <TaskModal
          userEmail={user.email}
          staffProfiles={staffProfiles}
          staffRoles={staffRoles}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingTask && (
        <TaskModal
          userEmail={user.email}
          staffProfiles={staffProfiles}
          staffRoles={staffRoles}
          initial={editingTask}
          onSave={handleUpdate}
          onClose={() => setEditingTask(null)}
          onDelete={() => handleDeleteFromModal(editingTask.id)}
          isAdmin={isAdmin}
          allStaffProfiles={staffProfiles}
          currentUserEmail={user.email}
          onUpdateCompletionStatus={(completionStatus) => {
            updateTask(editingTask.id, { completionStatus });
            setEditingTask(prev => prev ? { ...prev, completionStatus } : null);
          }}
        />
      )}

      {/* Mailto Modal for team tasks */}
      {mailtoTask && (
        <MailtoModal
          task={mailtoTask}
          staffProfiles={staffProfiles}
          onClose={() => setMailtoTask(null)}
        />
      )}

      {/* Confetti burst */}
      {confettiOrigin && <ConfettiBurst x={confettiOrigin.x} y={confettiOrigin.y} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-sm shadow-lg z-50 transition-all duration-300 ${
          toastType === "done"
            ? "bg-green-600 text-white shadow-green-300 dark:shadow-green-900 scale-110"
            : "bg-gray-900 text-white"
        }`} style={toastType === "done" ? { animation: "toast-pop 0.4s ease-out" } : undefined}>
          {toast}
        </div>
      )}
    </div>
  );
}

// =============================================
// タスクカード
// =============================================

function TaskCard({
  task,
  staffNameMap,
  staffProfiles,
  staffRoles,
  onStatusChange,
  onEdit,
  isAdmin,
  currentUserEmail,
  isCompleting,
}: {
  task: Task;
  staffNameMap: Record<string, string>;
  staffProfiles: { email: string; lastName: string }[];
  staffRoles: { id: string; name: string; order: number }[];
  onStatusChange: (id: string, status: TaskStatus, e?: React.MouseEvent) => void;
  onEdit?: () => void;
  isAdmin: boolean;
  currentUserEmail: string;
  isCompleting?: boolean;
}) {
  const today = getTodayStr();
  const isOverdue = task.dueDate && task.dueDate < today && task.status !== "done";
  const emails = task.assigneeEmails || [];
  const isAllTask = emails.length === 1 && emails[0] === "all";
  const isRoleTask = emails.some(e => e.startsWith("role:"));
  const isTeamTask = isAllTask || isRoleTask || emails.length > 1;

  // ステータス変更先の選択肢（現在のステータス以外）
  const nextStatuses = STATUS_COLUMNS.filter(c => c.key !== task.status);

  // 複数人タスクの完了状況
  const completionCount = useMemo(() => {
    const total = isAllTask ? staffProfiles.length : emails.length;
    if (!isTeamTask || !task.completionStatus) return { done: 0, total };
    const done = Object.values(task.completionStatus).filter(Boolean).length;
    return { done, total };
  }, [isTeamTask, isAllTask, task.completionStatus, staffProfiles.length, emails.length]);

  return (
    <div
      onClick={onEdit}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm transition-all duration-500 ${
        onEdit ? "cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600" : ""
      } ${isCompleting ? "border-green-400 bg-green-50 dark:bg-green-900/30 ring-2 ring-green-400/50" : ""}`}
      style={isCompleting ? { transform: "scale(1.02)", transition: "all 0.3s ease" } : undefined}
    >
      {/* Title */}
      <div className="mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{task.title}</h3>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Assignee & Due date & URL */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {isAllTask ? (
          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
            全体
          </span>
        ) : isRoleTask ? (
          emails.filter(e => e.startsWith("role:")).map(e => {
            const roleId = e.replace("role:", "");
            const role = staffRoles.find(r => r.id === roleId);
            return (
              <span key={e} className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                {role?.name || roleId}
              </span>
            );
          })
        ) : emails.length > 1 ? (
          emails.map(e => (
            <span key={e} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              {staffNameMap[e] || e}
            </span>
          ))
        ) : (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {staffNameMap[emails[0]] || emails[0]}
          </span>
        )}
        {task.dueDate && (
          <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
            {isOverdue ? "期限超過: " : "期限: "}{formatDate(task.dueDate, task.dueTime)}
          </span>
        )}
        {task.url && (
          <a
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-0.5"
          >
            <span>{"🔗"}</span>
            <span className="truncate max-w-[120px]">リンク</span>
          </a>
        )}
      </div>

      {/* Team task completion status */}
      {isTeamTask && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${completionCount.total > 0 ? (completionCount.done / completionCount.total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
              完了: {completionCount.done}/{completionCount.total}人
            </span>
          </div>
        </div>
      )}

      {/* 作成者 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          作成: {staffProfiles.find(p => p.email === task.createdBy)?.lastName || task.createdBy}
        </span>
        {!onEdit && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">※ 編集は作成者のみ</span>
        )}
      </div>

      {/* Actions: Status change only (no edit/delete buttons) */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
        {/* For team tasks, only admin can change status */}
        {(!isTeamTask || isAdmin) && nextStatuses.map(ns => (
          <button
            key={ns.key}
            onClick={e => { e.stopPropagation(); onStatusChange(task.id, ns.key, e); }}
            className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-all duration-200 ${
              ns.key === "done"
                ? "border-green-300 text-green-600 hover:bg-green-500 hover:text-white hover:border-green-500 hover:shadow-md hover:shadow-green-200 dark:hover:shadow-green-900 active:scale-90"
                : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95"
            }`}
          >
            {ns.key === "done" && <CheckIcon className="w-3.5 h-3.5 inline mr-1" />}
            {ns.key === "done" ? "完了！" : ns.label}
          </button>
        ))}
        {isTeamTask && !isAdmin && (
          <span className="text-[10px] text-gray-400">ステータス変更は管理者のみ</span>
        )}
      </div>
    </div>
  );
}

// =============================================
// useMemo import for TaskCard
// =============================================
// (already imported at top)

// =============================================
// 追加/編集モーダル
// =============================================

function TaskModal({
  userEmail,
  staffProfiles,
  staffRoles,
  initial,
  onSave,
  onClose,
  onDelete,
  isAdmin,
  allStaffProfiles,
  currentUserEmail,
  onUpdateCompletionStatus,
}: {
  userEmail: string;
  staffProfiles: { email: string; lastName: string; roleIds?: string[] }[];
  staffRoles: { id: string; name: string; order: number }[];
  initial?: Task;
  onSave: (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  allStaffProfiles?: { email: string; lastName: string }[];
  currentUserEmail?: string;
  onUpdateCompletionStatus?: (completionStatus: Record<string, boolean>) => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scopeType, setScopeType] = useState<"self" | "all" | "select" | "role">(() => {
    if (!initial) return "self";
    const emails = initial.assigneeEmails || [];
    if (emails.length === 1 && emails[0] === "all") return "all";
    if (emails.length === 1 && emails[0] === userEmail) return "self";
    if (emails.some(e => e.startsWith("role:"))) return "role";
    return "select";
  });
  const [selectedEmails, setSelectedEmails] = useState<string[]>(() => {
    if (!initial) return [];
    const emails = initial.assigneeEmails || [];
    if (emails.length === 1 && emails[0] === "all") return [];
    if (emails.length === 1 && emails[0] === userEmail) return [];
    if (emails.some(e => e.startsWith("role:"))) return [];
    return emails;
  });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(() => {
    if (!initial) return [];
    const emails = initial.assigneeEmails || [];
    return emails.filter(e => e.startsWith("role:")).map(e => e.replace("role:", ""));
  });
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");

  const emails = initial?.assigneeEmails || [];
  const isTeamTask = (emails.length === 1 && emails[0] === "all") || emails.length > 1;
  const completionStatus = initial?.completionStatus ?? {};

  const getAssigneeEmails = (): string[] => {
    if (scopeType === "all") return ["all"];
    if (scopeType === "role") return selectedRoleIds.length > 0 ? selectedRoleIds.map(id => `role:${id}`) : [userEmail];
    if (scopeType === "select") return selectedEmails.length > 0 ? selectedEmails : [userEmail];
    return [userEmail];
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    const assigneeEmails = getAssigneeEmails();
    const needsCompletion = assigneeEmails[0] === "all" || assigneeEmails.length > 1;
    onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      priority: "medium",
      assigneeEmails,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      url: url.trim() || undefined,
      completionStatus: needsCompletion ? (initial?.completionStatus ?? {}) : undefined,
      createdBy: initial?.createdBy ?? userEmail,
    });
    onClose();
  };

  const handleToggleCompletion = (email: string) => {
    if (!onUpdateCompletionStatus) return;
    const updated = { ...completionStatus, [email]: !completionStatus[email] };
    onUpdateCompletionStatus(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {initial ? "タスクを編集" : "タスクを追加"}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="タスクのタイトルを入力"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="タスクの詳細を記入..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

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

          {/* 対象 & 優先度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">対象</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {([
                { key: "self", label: "自分" },
                { key: "select", label: "メンバー指定" },
                { key: "role", label: "ロール指定" },
                { key: "all", label: "全体" },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setScopeType(opt.key)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    scopeType === opt.key
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {scopeType === "select" && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {staffProfiles.map(p => {
                  const name = (p as { fullName?: string }).fullName || p.lastName;
                  const checked = selectedEmails.includes(p.email);
                  return (
                    <label key={p.email} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmail(p.email)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                      <span className="text-xs text-gray-400 ml-auto">{p.email}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {scopeType === "role" && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {staffRoles.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">ロールが登録されていません</p>
                ) : (
                  [...staffRoles].sort((a, b) => a.order - b.order).map(role => {
                    const checked = selectedRoleIds.includes(role.id);
                    return (
                      <label key={role.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedRoleIds(prev => prev.includes(role.id) ? prev.filter(r => r !== role.id) : [...prev, role.id])}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{role.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>


          {/* 作成者表示 (編集時) */}
          {initial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">作成者</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                {staffProfiles.find(p => p.email === initial.createdBy)?.lastName || initial.createdBy}
              </p>
            </div>
          )}

          {/* Status (編集時のみ表示) */}
          {initial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ステータス</label>
              <select
                value={status === "in_progress" ? "todo" : status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">未着手</option>
                <option value="done">完了</option>
              </select>
            </div>
          )}

          {/* Due Date - Mini Calendar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">期限</label>
            <MiniCalendar selectedDate={dueDate} onSelectDate={(d) => { setDueDate(d); if (!dueTime) setDueTime("18:00"); }} />
            <div className="flex items-center gap-3 mt-2">
              <select
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">時間を選択</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const h = String(Math.floor(i / 2)).padStart(2, "0");
                  const m = i % 2 === 0 ? "00" : "30";
                  return <option key={i} value={`${h}:${m}`}>{h}:{m}</option>;
                })}
              </select>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => { setDueDate(""); setDueTime(""); }}
                  className="px-3 py-2 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 transition-colors"
                >
                  クリア
                </button>
              )}
            </div>
            {dueDate && (
              <p className="text-xs text-gray-400 mt-1">
                {(() => {
                  const d = new Date(dueDate + "T00:00:00");
                  const days = ["日", "月", "火", "水", "木", "金", "土"];
                  return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）${dueTime ? " " + dueTime : ""}`;
                })()}
              </p>
            )}
          </div>

          {/* Team task: completion status per member */}
          {initial && isTeamTask && allStaffProfiles && (() => {
            const isAll = emails.length === 1 && emails[0] === "all";
            const targetProfiles = isAll
              ? allStaffProfiles
              : allStaffProfiles.filter(sp => emails.includes(sp.email));
            return (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">メンバー完了状況</label>
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                  {targetProfiles.map(sp => {
                    const isDone = completionStatus[sp.email] === true;
                    const isSelf = sp.email === currentUserEmail;
                    const name = (sp as { fullName?: string }).fullName || sp.lastName;
                    return (
                      <div key={sp.email} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {name}
                          {isSelf && <span className="text-xs text-blue-500 ml-1">（自分）</span>}
                        </span>
                        {isSelf ? (
                          <button
                            onClick={() => handleToggleCompletion(sp.email)}
                            className={`text-sm px-2 py-0.5 rounded transition-colors ${
                              isDone
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {isDone ? "✅ 完了" : "⬜ 未完了"}
                          </button>
                        ) : (
                          <span className="text-sm">{isDone ? "✅ 完了" : "⬜ 未完了"}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
              disabled={!title.trim()}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initial ? "更新" : "追加"}
            </button>
          </div>

          {/* Delete button (edit mode only) */}
          {initial && onDelete && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={onDelete}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                このタスクを削除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// ミニカレンダー（日付選択用）
// =============================================

function MiniCalendar({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) return new Date(selectedDate + "T00:00:00").getFullYear();
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return new Date(selectedDate + "T00:00:00").getMonth();
    return today.getMonth();
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const fmt = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  // Build calendar grid cells
  const cells: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  // Previous month overflow
  for (let i = 0; i < firstDayOfWeek; i++) {
    const d = prevMonthDays - firstDayOfWeek + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ date: fmt(y, m, d), day: d, isCurrentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: fmt(viewYear, viewMonth, d), day: d, isCurrentMonth: true });
  }
  // Next month overflow (fill to 42 cells = 6 rows)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ date: fmt(y, m, d), day: d, isCurrentMonth: false });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={goToPrevMonth} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {viewYear}年{viewMonth + 1}月
        </span>
        <button type="button" onClick={goToNextMonth} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(wd => (
          <div key={wd} className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-1">
            {wd}
          </div>
        ))}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const isSelected = cell.date === selectedDate;
          const isToday = cell.date === todayStr;
          const isPast = cell.date < todayStr;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className={`aspect-square flex items-center justify-center text-xs rounded-md transition-colors ${
                isSelected
                  ? "bg-blue-600 text-white font-medium"
                  : isToday
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                    : cell.isCurrentMonth
                      ? isPast
                        ? "text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      : "text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// メール通知モーダル（全体タスク追加後）
// =============================================

function MailtoModal({
  task,
  staffProfiles,
  onClose,
}: {
  task: Task;
  staffProfiles: { email: string; lastName: string }[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const taskEmails = task.assigneeEmails || [];
  const isAll = taskEmails.length === 1 && taskEmails[0] === "all";
  const allEmails = isAll
    ? staffProfiles.map(p => p.email).join(",")
    : taskEmails.join(",");
  const subject = encodeURIComponent(`【Lueur】新しいタスク: ${task.title}`);
  const dueDateStr = task.dueDate ? `\n期限: ${formatDate(task.dueDate, task.dueTime)}` : "";
  const urlStr = task.url ? `\n関連URL: ${task.url}` : "";
  const body = encodeURIComponent(
    `新しい全体タスクが追加されました。\n\nタイトル: ${task.title}\n説明: ${task.description || "（なし）"}${dueDateStr}${urlStr}\n\nポータルサイトからご確認ください。`
  );
  const mailtoLink = `mailto:${allEmails}?subject=${subject}&body=${body}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">タスクを追加しました</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            タスク「{task.title}」を追加しました。担当メンバーに通知メールを送りますか？
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              閉じる
            </button>
            <a
              href={mailtoLink}
              onClick={() => { setTimeout(onClose, 500); }}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              メールを送信
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// 完了時のパーティクルアニメーション
// =============================================

const CONFETTI_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const particles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const velocity = 60 + Math.random() * 100;
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const size = 4 + Math.random() * 4;
      const rotation = Math.random() * 360;
      return { angle, velocity, color, size, rotation, id: i };
    });
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99998]">
      {particles.map(p => {
        const tx = Math.cos(p.angle) * p.velocity;
        const ty = Math.sin(p.angle) * p.velocity - 30;
        return (
          <div
            key={p.id}
            className="absolute rounded-sm"
            style={{
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              transform: `rotate(${p.rotation}deg)`,
              animation: `confetti-burst 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
              // @ts-expect-error CSS custom properties
              "--tx": `${tx}px`,
              "--ty": `${ty}px`,
            }}
          />
        );
      })}
    </div>
  );
}

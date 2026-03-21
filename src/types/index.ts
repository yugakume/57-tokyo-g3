export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: "admin" | "member";
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  icon: LinkIconType;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type LinkIconType =
  | "spreadsheet"
  | "document"
  | "slide"
  | "form"
  | "video"
  | "website"
  | "folder"
  | "other";

export interface LinkCategory {
  id: string;
  name: string;
  order: number;
  description?: string;
}

export interface AccountInfo {
  id: string;
  serviceName: string;
  loginId: string;
  password: string;
  url: string;
  note?: string;
  order: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  pinned: boolean;
}

// =============================================
// ロール（役職・部署）
// =============================================

export interface StaffRole {
  id: string;
  name: string;
  order: number;
}

export const DEFAULT_STAFF_ROLES: StaffRole[] = [
  { id: "role-01", name: "代表", order: 1 },
  { id: "role-02", name: "副代表", order: 2 },
  { id: "role-03", name: "コンシューマー部署", order: 3 },
  { id: "role-04", name: "クライアント部署", order: 4 },
  { id: "role-05", name: "プログラム部署", order: 5 },
  { id: "role-06", name: "事務局部署", order: 6 },
  { id: "role-07", name: "人財開発部署", order: 7 },
  { id: "role-08", name: "コンシューマー統括", order: 8 },
  { id: "role-09", name: "クライアント統括", order: 9 },
  { id: "role-10", name: "プログラム統括", order: 10 },
  { id: "role-11", name: "事務局統括", order: 11 },
  { id: "role-12", name: "人財開発統括", order: 12 },
];

// =============================================
// スケジュール・予約管理
// =============================================

export type EventType = "orientation" | "hearing" | "selection" | "meeting" | "other";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  orientation: "説明会",
  hearing: "ヒアリング",
  selection: "1次選考会",
  meeting: "ミーティング",
  other: "その他",
};

export interface StaffProfile {
  id: string;
  email: string;
  lastName: string;        // 苗字
  firstName?: string;      // 名前
  fullName?: string;       // フルネーム（lastName + firstName）
  furigana?: string;       // ふりがな（例: "くめゆうが"）
  grade: string;           // 学年（例: "3年", "4年", "M1"）
  gender: "male" | "female" | "other";
  roleIds: string[];       // StaffRole.id の配列
  nearestStation?: string; // 最寄駅
  birthday?: string;       // 誕生日 (MM-DD形式, e.g. "03-21")
  university?: string;     // 大学名
  faculty?: string;        // 学部・学科
  photoURL?: string;       // 顔写真（base64 data URL）
}

export interface TimeSlot {
  id: string;
  staffId: string;        // StaffProfile.id
  date: string;           // "2026-03-25"
  startTime: string;      // "10:00"
  endTime: string;        // "11:00"
  eventType: EventType;
  isBooked: boolean;
  bookingId?: string;
}

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface Booking {
  id: string;
  bookingNumber: string;  // ランダム予約番号（例: "BK-A3X9K2"）
  studentName: string;
  studentEmail: string;
  selectedSlotIds: string[];   // 学生が選んだ複数の希望枠
  confirmedSlotId?: string;    // スタッフが確定した枠
  assignedStaffId?: string;    // 担当スタッフ
  eventType: EventType;
  meetLink?: string;           // Google Meet リンク
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// MTG議事録
// =============================================

export type MeetingLocation = "対面" | "オンライン" | "ハイブリッド";

export interface MeetingMinutes {
  id: string;
  date: string;           // "2026-03-21"
  title: string;
  startTime: string;      // "09:00"
  endTime: string;        // "12:00"
  location: MeetingLocation;
  venue?: string;          // 会場名
  venueStation?: string;   // 会場最寄駅
  attendees: string[];    // 出席者名
  attendance?: Record<string, "出席" | "欠席" | "遅刻" | "未回答">; // email -> status
  content: string;        // 議事録本文
  createdBy: string;      // user email
  createdAt: string;
  updatedAt: string;
}

// =============================================
// タスク管理
// =============================================

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeEmails: string[];  // 担当者のemail配列。["all"]の場合は全体タスク
  assigneeEmail?: string;    // 後方互換用（旧データ対応）
  dueDate?: string;          // "2026-03-25"
  dueTime?: string;          // "HH:MM" 形式（任意）
  url?: string;              // 関連URL（任意）
  completionStatus?: Record<string, boolean>; // 複数人タスク用: emailをキーに完了/未完了
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

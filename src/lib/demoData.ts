// =============================================
// デモモード用ダミーデータ
// isDemoUser === true のとき Firestore の代わりに使用
// すべてのデータはサンプルであり、実在の個人情報ではありません
// =============================================

import type {
  LinkItem, LinkCategory, AccountInfo, InstagramAccount, Announcement, AnnouncementCategory,
  StaffProfile, StaffRole, TimeSlot, Booking, MeetingMinutes, Task,
} from "@/types";
import type { CountdownItem } from "@/contexts/CountdownContext";

export const DEMO_ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  { id: "demo-cat-1", name: "重要", order: 1 },
  { id: "demo-cat-2", name: "連絡事項", order: 2 },
];

export const DEMO_LINK_CATEGORIES: LinkCategory[] = [
  { id: "demo-lcat-1", name: "業務ツール", order: 1 },
  { id: "demo-lcat-2", name: "資料", order: 2 },
];

export const DEMO_LINKS: LinkItem[] = [
  {
    id: "demo-link-1", title: "共有ドライブ（サンプル）", url: "https://drive.google.com",
    description: "チームの資料・データを管理", category: "demo-lcat-1",
    icon: "folder", order: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "demo-link-2", title: "活動報告テンプレート（サンプル）", url: "https://docs.google.com",
    description: "月次活動報告書のテンプレート", category: "demo-lcat-2",
    icon: "document", order: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "demo-link-3", title: "スプレッドシート（サンプル）", url: "https://sheets.google.com",
    description: "データ管理用スプレッドシート", category: "demo-lcat-1",
    icon: "spreadsheet", order: 2, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
];

export const DEMO_ACCOUNTS: AccountInfo[] = [
  {
    id: "demo-acc-1", serviceName: "業務システム（サンプル）",
    loginId: "demo_user_01",
    password: "※デモモードではパスワードは表示されません",
    url: "https://example.com", note: "これはデモ用のサンプルデータです", order: 1,
  },
  {
    id: "demo-acc-2", serviceName: "連絡ツール（サンプル）",
    loginId: "57tokyo_sample",
    password: "※デモモードではパスワードは表示されません",
    url: "https://example.com", order: 2,
  },
];

export const DEMO_INSTA_ACCOUNTS: InstagramAccount[] = [
  {
    id: "demo-insta-1",
    handle: "dotjp_sample1",
    email: "sample1@dot-jp.or.jp",
    password: "※デモモードではパスワードは表示されません",
    note: "集客メインアカウント（サンプル）",
    loggedInUsers: ["demo_tanaka@dot-jp.or.jp", "demo_sato@dot-jp.or.jp"],
    order: 1,
  },
  {
    id: "demo-insta-2",
    handle: "dotjp_sample2",
    loggedInUsers: ["demo_yamada@dot-jp.or.jp"],
    order: 2,
  },
];

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "demo-ann-1", title: "4月定例ミーティングのご案内（サンプル）",
    content: "4月の定例ミーティングを下記の通り開催します。\n日時: 4月5日（土）10:00〜12:00\n場所: オリセン（参宮橋）\n\n参加できない方は事前にご連絡ください。",
    date: "2026-03-25", pinned: true, category: "demo-cat-1",
    targetType: "all", createdBy: "demo_tanaka@dot-jp.or.jp",
  },
  {
    id: "demo-ann-2", title: "新入生歓迎会の準備について（サンプル）",
    content: "新入生歓迎会の準備を進めています。担当者は資料を共有ドライブに提出してください。",
    date: "2026-03-20", pinned: false, category: "demo-cat-2",
    targetType: "all", createdBy: "demo_sato@dot-jp.or.jp",
  },
];

export const DEMO_STAFF_ROLES: StaffRole[] = [
  { id: "demo-role-01", name: "代表", order: 1 },
  { id: "demo-role-02", name: "副代表", order: 2 },
  { id: "demo-role-03", name: "コンシューマー部署", order: 3 },
  { id: "demo-role-04", name: "クライアント部署", order: 4 },
  { id: "demo-role-05", name: "事務局部署", order: 5 },
];

export const DEMO_STAFF_PROFILES: StaffProfile[] = [
  {
    id: "demo-sp-1", email: "demo_tanaka@dot-jp.or.jp",
    lastName: "田中", firstName: "太郎", fullName: "田中 太郎",
    grade: "3年", gender: "male", roleIds: ["demo-role-01"],
    nearestStation: "渋谷", university: "○○大学", faculty: "経済学部",
  },
  {
    id: "demo-sp-2", email: "demo_sato@dot-jp.or.jp",
    lastName: "佐藤", firstName: "花子", fullName: "佐藤 花子",
    grade: "2年", gender: "female", roleIds: ["demo-role-02"],
    nearestStation: "新宿", university: "△△大学", faculty: "文学部",
  },
  {
    id: "demo-sp-3", email: "demo_yamada@dot-jp.or.jp",
    lastName: "山田", firstName: "次郎", fullName: "山田 次郎",
    grade: "4年", gender: "male", roleIds: ["demo-role-03"],
    nearestStation: "池袋", university: "□□大学", faculty: "法学部",
  },
  {
    id: "demo-sp-4", email: "demo_suzuki@dot-jp.or.jp",
    lastName: "鈴木", firstName: "あい", fullName: "鈴木 あい",
    grade: "1年", gender: "female", roleIds: ["demo-role-04"],
    nearestStation: "品川", university: "◇◇大学", faculty: "理工学部",
  },
];

export const DEMO_TIME_SLOTS: TimeSlot[] = [
  { id: "demo-ts-1", staffId: "demo-sp-1", date: "2026-04-05", startTime: "10:00", endTime: "11:00", eventType: "orientation", isBooked: false },
  { id: "demo-ts-2", staffId: "demo-sp-2", date: "2026-04-05", startTime: "11:00", endTime: "12:00", eventType: "orientation", isBooked: true, bookingId: "demo-bk-1" },
  { id: "demo-ts-3", staffId: "demo-sp-1", date: "2026-04-12", startTime: "14:00", endTime: "15:00", eventType: "hearing", isBooked: false },
];

export const DEMO_BOOKINGS: Booking[] = [
  {
    id: "demo-bk-1", bookingNumber: "BK-DEMO01",
    studentName: "サンプル 太郎", studentEmail: "sample_taro@example.com",
    selectedSlotIds: ["demo-ts-2"], confirmedSlotId: "demo-ts-2",
    assignedStaffId: "demo-sp-2", eventType: "orientation",
    status: "confirmed", createdAt: "2026-03-20T10:00:00Z", updatedAt: "2026-03-20T10:00:00Z",
  },
];

export const DEMO_MEETING_MINUTES: MeetingMinutes[] = [
  {
    id: "demo-mm-1",
    date: "2026-03-15",
    title: "3月定例ミーティング（サンプル）",
    startTime: "09:00",
    endTime: "12:00",
    location: "対面",
    venue: "オリセン",
    venueStation: "参宮橋",
    attendees: ["田中 太郎", "佐藤 花子", "山田 次郎"],
    attendance: {
      "demo_tanaka@dot-jp.or.jp": "出席",
      "demo_sato@dot-jp.or.jp": "出席",
      "demo_yamada@dot-jp.or.jp": "欠席",
    },
    content: "【議題】\n1. 3月活動報告\n2. 4月のスケジュール調整\n3. 新入生歓迎会の企画\n\n【決定事項】\n・次回は4月5日（土）に開催。\n・資料は前日までに共有ドライブへ提出。\n・歓迎会の担当は佐藤、山田が担当。",
    createdBy: "demo_tanaka@dot-jp.or.jp",
    createdAt: "2026-03-15T13:00:00Z",
    updatedAt: "2026-03-15T13:00:00Z",
  },
];

export const DEMO_TASKS: Task[] = [
  {
    id: "demo-task-1",
    title: "説明会資料の作成（サンプル）",
    description: "4月の新入生向け説明会で使用するスライドを作成してください。テンプレートは共有ドライブにあります。",
    status: "todo",
    priority: "high",
    assigneeEmails: ["all"],
    dueDate: "2026-04-03",
    dueTime: "18:00",
    createdBy: "demo_tanaka@dot-jp.or.jp",
    createdAt: "2026-03-20T10:00:00Z",
    updatedAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "demo-task-2",
    title: "活動報告書の提出（サンプル）",
    description: "3月分の活動報告書を共有ドライブに提出してください。",
    status: "done",
    priority: "medium",
    assigneeEmails: ["demo_sato@dot-jp.or.jp", "demo_yamada@dot-jp.or.jp"],
    dueDate: "2026-03-31",
    completionStatus: {
      "demo_sato@dot-jp.or.jp": true,
      "demo_yamada@dot-jp.or.jp": false,
    },
    createdBy: "demo_tanaka@dot-jp.or.jp",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-25T10:00:00Z",
  },
];

export const DEMO_COUNTDOWNS: CountdownItem[] = [
  { id: "demo-cd-1", title: "春のイベント（サンプル）", targetDate: "2026-04-10", createdBy: "demo_tanaka@dot-jp.or.jp" },
  { id: "demo-cd-2", title: "新歓期間開始（サンプル）", targetDate: "2026-04-01", createdBy: "demo_tanaka@dot-jp.or.jp" },
];

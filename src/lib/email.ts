// =============================================
// メール送信サービス（Google Apps Script 連携）
// =============================================

// GAS Web App のデプロイURL（デプロイ後に設定）
const GAS_ENDPOINT = process.env.NEXT_PUBLIC_GAS_ENDPOINT || "";

// デモモード: GAS未設定時はconsole.logで代替
const IS_DEMO = !GAS_ENDPOINT;

interface SlotInfo {
  date: string;
  startTime: string;
  endTime: string;
  staffName: string;
}

interface ProvisionalEmailParams {
  studentName: string;
  studentEmail: string;
  bookingNumber: string;
  eventType: string;
  selectedSlots: SlotInfo[];
}

interface ConfirmationEmailParams {
  studentName: string;
  studentEmail: string;
  bookingNumber: string;
  eventType: string;
  confirmedSlot: {
    date: string;
    startTime: string;
    endTime: string;
  };
  staffName: string;
  meetLink?: string;
}

interface CreateMeetParams {
  title?: string;
  date: string;
  startTime: string;
  endTime: string;
  studentEmail?: string;
  staffEmail?: string;
}

interface GASResponse {
  success: boolean;
  message?: string;
  error?: string;
  meetLink?: string;
  warning?: string;
}

// ─── GAS呼び出しヘルパー ──────────────────────
async function callGAS(payload: Record<string, unknown>): Promise<GASResponse> {
  if (IS_DEMO) {
    console.log("[DEMO] GAS API call:", payload);
    return { success: true, message: "Demo mode - email not actually sent" };
  }

  try {
    const res = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data as GASResponse;
  } catch (err) {
    console.error("GAS API error:", err);
    return { success: false, error: String(err) };
  }
}

// =============================================
// 1. 仮予約完了メール送信
// =============================================
export async function sendProvisionalEmail(params: ProvisionalEmailParams): Promise<GASResponse> {
  return callGAS({
    action: "sendProvisionalEmail",
    ...params,
  });
}

// =============================================
// 2. 確定メール送信（Meetリンク付き）
// =============================================
export async function sendConfirmationEmail(params: ConfirmationEmailParams): Promise<GASResponse> {
  return callGAS({
    action: "sendConfirmationEmail",
    ...params,
  });
}

// =============================================
// 3. Google Meet リンク生成
// =============================================
export async function createMeetLink(params: CreateMeetParams): Promise<GASResponse> {
  return callGAS({
    action: "createMeetLink",
    ...params,
  });
}

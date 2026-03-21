// =============================================
// Google Apps Script - PUZZLE 予約メール送信 & Meet生成
// =============================================
// デプロイ方法:
// 1. Google Apps Script (https://script.google.com) で新規プロジェクト作成
// 2. このファイルの内容をコピー＆ペースト
// 3.「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
// 4. 実行ユーザー:「自分」、アクセス:「全員」
// 5. デプロイURLを portal の GAS_ENDPOINT に設定
// =============================================

// ─── 設定 ─────────────────────────────────────
const CONFIG = {
  ORG_NAME: "NPO法人ドットジェイピー",
  BRANCH_NAME: "PUZZLE",
  FROM_NAME: "PUZZLE 予約システム",
  // 予約確認ページURL（学生向け）
  BOOKING_PAGE_URL: "https://your-domain.com/booking",
};

// ─── エントリポイント (POST) ───────────────────
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;

    let result;

    switch (action) {
      case "sendProvisionalEmail":
        result = sendProvisionalEmail(params);
        break;
      case "sendConfirmationEmail":
        result = sendConfirmationEmail(params);
        break;
      case "createMeetLink":
        result = createMeetLink(params);
        break;
      default:
        return jsonResponse({ success: false, error: "Unknown action: " + action });
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// GETも対応（CORS preflight等）
function doGet(e) {
  return jsonResponse({ success: true, message: "PUZZLE Booking API is running" });
}

// ─── JSON レスポンス ────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================
// 1. 仮予約完了メール
// =============================================
function sendProvisionalEmail(params) {
  const {
    studentName,
    studentEmail,
    bookingNumber,
    eventType,
    selectedSlots, // [{ date, startTime, endTime, staffName }]
  } = params;

  const eventLabel = getEventTypeLabel(eventType);

  // 希望枠リスト
  const slotList = selectedSlots
    .map((s, i) => `  ${i + 1}. ${formatDateJP(s.date)} ${s.startTime}〜${s.endTime}（担当候補: ${s.staffName}）`)
    .join("\n");

  const subject = `【${CONFIG.BRANCH_NAME}】${eventLabel}の仮予約を受け付けました`;

  const body = `${studentName} 様

${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}です。
${eventLabel}の仮予約を受け付けました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 予約番号: ${bookingNumber}
■ イベント: ${eventLabel}
■ ステータス: 仮予約（スタッフ確定待ち）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【ご希望の日時】
${slotList}

※ 上記の中からスタッフが日程を確定し、改めてメールでお知らせいたします。
※ 確定まで数日お時間をいただく場合がございます。

【予約の確認・変更】
以下のページから予約番号とメールアドレスで確認・変更ができます。
${CONFIG.BOOKING_PAGE_URL}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※ このメールは自動送信されています。
※ お心当たりのない場合はこのメールを無視してください。`;

  const htmlBody = createHtmlEmail({
    title: `${eventLabel}の仮予約を受け付けました`,
    greeting: `${studentName} 様`,
    intro: `${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}です。<br>${eventLabel}の仮予約を受け付けました。`,
    sections: [
      {
        title: "予約情報",
        items: [
          { label: "予約番号", value: bookingNumber, highlight: true },
          { label: "イベント", value: eventLabel },
          { label: "ステータス", value: "仮予約（スタッフ確定待ち）" },
        ],
      },
      {
        title: "ご希望の日時",
        html: selectedSlots.map((s, i) =>
          `<div style="padding: 8px 12px; background: #f8fafc; border-radius: 6px; margin-bottom: 6px; font-size: 14px;">
            ${i + 1}. <strong>${formatDateJP(s.date)} ${s.startTime}〜${s.endTime}</strong>
            <span style="color: #6b7280; margin-left: 8px;">担当候補: ${s.staffName}</span>
          </div>`
        ).join(""),
      },
    ],
    notice: "上記の中からスタッフが日程を確定し、改めてメールでお知らせいたします。確定まで数日お時間をいただく場合がございます。",
    ctaUrl: CONFIG.BOOKING_PAGE_URL,
    ctaLabel: "予約を確認・変更する",
  });

  GmailApp.sendEmail(studentEmail, subject, body, {
    name: CONFIG.FROM_NAME,
    htmlBody: htmlBody,
  });

  return { success: true, message: "Provisional email sent" };
}

// =============================================
// 2. 確定メール（Meetリンク付き）
// =============================================
function sendConfirmationEmail(params) {
  const {
    studentName,
    studentEmail,
    bookingNumber,
    eventType,
    confirmedSlot, // { date, startTime, endTime }
    staffName,
    meetLink,
  } = params;

  const eventLabel = getEventTypeLabel(eventType);

  const subject = `【${CONFIG.BRANCH_NAME}】${eventLabel}の日程が確定しました`;

  const body = `${studentName} 様

${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}です。
${eventLabel}の日程が確定いたしました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 予約番号: ${bookingNumber}
■ イベント: ${eventLabel}
■ ステータス: 確定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【確定した日時】
日付: ${formatDateJP(confirmedSlot.date)}
時間: ${confirmedSlot.startTime}〜${confirmedSlot.endTime}
担当: ${staffName}

【オンライン参加】
Google Meet: ${meetLink || "（後日お知らせします）"}

${meetLink ? `上記のリンクから当日ご参加ください。\n開始5分前にはリンクにアクセスしてお待ちください。` : ""}

【予約の確認】
${CONFIG.BOOKING_PAGE_URL}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

※ このメールは自動送信されています。
※ ご都合が悪くなった場合は、上記ページからキャンセルの旨をお知らせください。`;

  const htmlBody = createHtmlEmail({
    title: `${eventLabel}の日程が確定しました`,
    greeting: `${studentName} 様`,
    intro: `${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}です。<br>${eventLabel}の日程が確定いたしました。`,
    sections: [
      {
        title: "予約情報",
        items: [
          { label: "予約番号", value: bookingNumber },
          { label: "イベント", value: eventLabel },
          { label: "ステータス", value: "確定", statusColor: "#16a34a" },
        ],
      },
      {
        title: "確定した日時",
        items: [
          { label: "日付", value: formatDateJP(confirmedSlot.date) },
          { label: "時間", value: `${confirmedSlot.startTime}〜${confirmedSlot.endTime}` },
          { label: "担当", value: staffName },
        ],
      },
      meetLink ? {
        title: "オンライン参加",
        html: `<a href="${meetLink}" style="display: inline-block; padding: 12px 24px; background: #1a73e8; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Google Meet に参加</a>
        <p style="margin-top: 8px; font-size: 13px; color: #6b7280;">リンク: ${meetLink}</p>
        <p style="margin-top: 4px; font-size: 13px; color: #6b7280;">開始5分前にはリンクにアクセスしてお待ちください。</p>`,
      } : null,
    ].filter(Boolean),
    ctaUrl: CONFIG.BOOKING_PAGE_URL,
    ctaLabel: "予約を確認する",
  });

  GmailApp.sendEmail(studentEmail, subject, body, {
    name: CONFIG.FROM_NAME,
    htmlBody: htmlBody,
  });

  return { success: true, message: "Confirmation email sent" };
}

// =============================================
// 3. Google Meet リンク生成
// =============================================
// Calendar API を使って Meet リンク付きイベントを作成
function createMeetLink(params) {
  const {
    title,
    date,       // "2026-03-25"
    startTime,  // "10:00"
    endTime,    // "11:00"
    studentEmail,
    staffEmail,
  } = params;

  const startDateTime = `${date}T${startTime}:00+09:00`;
  const endDateTime = `${date}T${endTime}:00+09:00`;

  const event = CalendarApp.getDefaultCalendar().createEvent(
    title || "PUZZLE インターン説明会",
    new Date(startDateTime),
    new Date(endDateTime),
    {
      description: `${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}\nインターン説明会`,
      guests: [studentEmail, staffEmail].filter(Boolean).join(","),
      sendInvites: false,
    }
  );

  // Calendar Advanced Service で Meet リンクを取得・生成
  // (Calendar Advanced Service を有効にする必要あり)
  try {
    const calendarId = "primary";
    const eventId = event.getId().split("@")[0];

    // Advanced Calendar Service で Conference Data を追加
    const calEvent = Calendar.Events.get(calendarId, eventId);
    calEvent.conferenceData = {
      createRequest: {
        requestId: eventId + "-meet-" + Date.now(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
    const updatedEvent = Calendar.Events.patch(calEvent, calendarId, eventId, {
      conferenceDataVersion: 1,
    });

    const meetLink = updatedEvent.conferenceData?.entryPoints?.[0]?.uri || "";

    return {
      success: true,
      meetLink: meetLink,
      calendarEventId: eventId,
    };
  } catch (err) {
    // Advanced Service が未有効の場合はイベントだけ作成
    return {
      success: true,
      meetLink: "",
      calendarEventId: event.getId(),
      warning: "Calendar Advanced Service が未有効のため Meet リンクを自動生成できませんでした: " + err.toString(),
    };
  }
}

// =============================================
// ユーティリティ
// =============================================

function getEventTypeLabel(eventType) {
  const labels = {
    orientation: "説明会",
    hearing: "ヒアリング",
    selection: "1次選考会",
    meeting: "ミーティング",
    other: "その他",
  };
  return labels[eventType] || eventType;
}

function formatDateJP(dateStr) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = days[d.getDay()];
  return `${y}年${m}月${day}日（${dow}）`;
}

// ─── HTMLメールテンプレート ─────────────────────
function createHtmlEmail({ title, greeting, intro, sections, notice, ctaUrl, ctaLabel }) {
  const sectionHtml = sections.map(section => {
    let content = "";
    if (section.items) {
      content = section.items.map(item => {
        const valueStyle = item.highlight
          ? "font-size: 20px; font-weight: bold; color: #2563eb; letter-spacing: 2px;"
          : item.statusColor
          ? `font-weight: bold; color: ${item.statusColor};`
          : "";
        return `<tr>
          <td style="padding: 8px 12px; color: #6b7280; font-size: 13px; white-space: nowrap; vertical-align: top;">${item.label}</td>
          <td style="padding: 8px 12px; color: #1f2937; font-size: 14px; ${valueStyle}">${item.value}</td>
        </tr>`;
      }).join("");
      content = `<table style="width: 100%; border-collapse: collapse;">${content}</table>`;
    }
    if (section.html) {
      content += section.html;
    }
    return `<div style="margin-bottom: 24px;">
      <h3 style="font-size: 14px; font-weight: bold; color: #374151; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">${section.title}</h3>
      ${content}
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; line-height: 40px; color: white; font-weight: bold; font-size: 18px;">P</div>
      <span style="font-weight: bold; font-size: 18px; color: #1f2937; vertical-align: middle; margin-left: 8px;">PUZZLE</span>
    </div>

    <!-- Card -->
    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="font-size: 18px; font-weight: bold; color: #1f2937; margin: 0 0 8px 0;">${title}</h2>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0; line-height: 1.6;">${greeting}<br><br>${intro}</p>

      ${sectionHtml}

      ${notice ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.6;">${notice}</p>
      </div>` : ""}

      ${ctaUrl ? `<div style="text-align: center; margin-top: 24px;">
        <a href="${ctaUrl}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">${ctaLabel}</a>
      </div>` : ""}
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px;">
      <p style="font-size: 11px; color: #9ca3af; line-height: 1.6;">
        ${CONFIG.ORG_NAME} ${CONFIG.BRANCH_NAME}<br>
        このメールは自動送信されています。
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── テスト用関数 ──────────────────────────────
function testProvisionalEmail() {
  sendProvisionalEmail({
    studentName: "テスト太郎",
    studentEmail: "your-test-email@example.com", // テスト用メアドに変更
    bookingNumber: "BK-TEST01",
    eventType: "orientation",
    selectedSlots: [
      { date: "2026-03-25", startTime: "10:00", endTime: "11:00", staffName: "田中" },
      { date: "2026-03-26", startTime: "14:00", endTime: "15:00", staffName: "佐藤" },
    ],
  });
}

function testConfirmationEmail() {
  sendConfirmationEmail({
    studentName: "テスト太郎",
    studentEmail: "your-test-email@example.com", // テスト用メアドに変更
    bookingNumber: "BK-TEST01",
    eventType: "orientation",
    confirmedSlot: { date: "2026-03-25", startTime: "10:00", endTime: "11:00" },
    staffName: "田中",
    meetLink: "https://meet.google.com/abc-defg-hij",
  });
}

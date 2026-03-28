// Gmail API を使ってメールを送信（OAuth access token必要）
// scope: https://www.googleapis.com/auth/gmail.send

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function encodeBase64Url(str: string): string {
  return utf8ToBase64(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function mimeEncodeSubject(subject: string): string {
  return `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
}

export async function sendGmail({
  accessToken,
  to,
  subject,
  htmlBody,
  from,
}: {
  accessToken: string;
  to: string | string[];
  subject: string;
  htmlBody: string;
  from?: string; // 送信元アドレス（Gmail "Send as" 設定済みのアドレスのみ有効）
}): Promise<void> {
  const toStr = Array.isArray(to) ? to.join(', ') : to;
  const headers: string[] = [
    `To: ${toStr}`,
    `Subject: ${mimeEncodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (from) headers.splice(1, 0, `From: ${from}`);
  const rawMessage = [...headers, '', htmlBody].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(rawMessage) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message || 'Gmail送信に失敗しました');
  }
}

// 説明会リマインドメールの本文生成
export function buildOrientationReminderHtml({
  staffName,
  studentName,
  date,
  startTime,
  endTime,
  eventTypeLabel,
  meetLink,
}: {
  staffName: string;
  studentName: string;
  date: string; // "2026-03-29"
  startTime: string;
  endTime: string;
  eventTypeLabel: string;
  meetLink?: string;
}): string {
  const d = new Date(date + 'T00:00:00');
  const days = ['日','月','火','水','木','金','土'];
  const dateLabel = `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
  const meetSection = meetLink
    ? `<p style="margin:12px 0"><strong>Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>`
    : '';
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <h2 style="color:#2563eb;margin-bottom:16px">📅 説明会リマインド</h2>
  <p>${staffName} さん、</p>
  <p>明日の説明会のご確認です。</p>
  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:6px 0"><strong>種別:</strong> ${eventTypeLabel}</p>
    <p style="margin:6px 0"><strong>日時:</strong> ${dateLabel} ${startTime}〜${endTime}</p>
    <p style="margin:6px 0"><strong>学生名:</strong> ${studentName}</p>
    ${meetSection}
  </div>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">このメールはポータルサイトから自動送信されました。</p>
</div>`;
}

// タスクリマインドメールの本文生成
export function buildTaskReminderHtml({
  taskTitle,
  description,
  dueDate,
  dueTime,
  assigneeNames,
  portalUrl,
}: {
  taskTitle: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  assigneeNames: string[];
  portalUrl?: string;
}): string {
  const dueDateLabel = dueDate
    ? (() => {
        const d = new Date(dueDate + 'T00:00:00');
        const days = ['日','月','火','水','木','金','土'];
        return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）${dueTime ? ' ' + dueTime : ''}`;
      })()
    : '期限なし';
  const descSection = description ? `<p style="margin:6px 0"><strong>詳細:</strong> ${description}</p>` : '';
  const urlSection = portalUrl ? `<p style="margin:12px 0"><a href="${portalUrl}" style="color:#2563eb">ポータルサイトで確認する</a></p>` : '';
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <h2 style="color:#d97706;margin-bottom:16px">✅ タスクリマインド</h2>
  <p>${assigneeNames.join('、')} さん、</p>
  <p>期限が近いタスクをお知らせします。</p>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:6px 0"><strong>タスク:</strong> ${taskTitle}</p>
    ${descSection}
    <p style="margin:6px 0"><strong>期限:</strong> ${dueDateLabel}</p>
  </div>
  ${urlSection}
  <p style="color:#6b7280;font-size:12px;margin-top:24px">このメールはポータルサイトから自動送信されました。</p>
</div>`;
}

// ================================================================
// Lueur ポータル - 自動メールリマインダー（個人設定対応版）
// Google Apps Script
// 実行アカウント: kanto3@dot-jp.or.jp
// 送信元: kanto3@dot-jp.or.jp（GASがそのアカウントで動くため自動）
// ================================================================
//
// 【初期設定手順】
// 1. https://script.google.com で新しいプロジェクトを作成
// 2. このコードをすべて貼り付けて保存
// 3. 「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加:
//      FIREBASE_PROJECT_ID  : astute-city-490906-k6
//      FIREBASE_API_KEY     : AIzaSyCPU7Ju3MA8f3KfNN3yx9qzFX3U9ZP2fVY
// 4. 「sendHourlyReminders」関数を一度手動実行して権限を付与
// 5. トリガーを追加:
//    「トリガーを追加」→ sendHourlyReminders → 時間主導型 → 時間ベース → 毎時
//
// 【ポータルサイト側】
//    各スタッフが「メール設定」→「リマインド設定」で自分の送信タイミングを設定すると
//    Firestore の emailSettings/{メールアドレス} に保存されます。
//    GASはそれを読み取り、各人の設定に従って送信します。
//
// 【Firestore ルール】
//    emailSettings コレクションに認証なし読み取り許可が必要です。
//    （portal/firestore.rules に追記済み）
// ================================================================

// ----------------------------------------------------------------
// 設定読み込み
// ----------------------------------------------------------------
function getConfig() {
  const p = PropertiesService.getScriptProperties();
  return {
    projectId: p.getProperty('FIREBASE_PROJECT_ID') || '',
    apiKey:    p.getProperty('FIREBASE_API_KEY')     || '',
  };
}

// ----------------------------------------------------------------
// Firestore REST API からコレクションを全件取得
// ----------------------------------------------------------------
function firestoreList(projectId, apiKey, collection) {
  const results = [];
  let pageToken = null;

  do {
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?key=${apiKey}&pageSize=200`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log(`Firestore fetch error (${collection}): ${res.getContentText()}`);
      break;
    }

    const json = JSON.parse(res.getContentText());
    if (json.documents) {
      json.documents.forEach(doc => {
        results.push(parseFirestoreDoc(doc));
      });
    }
    pageToken = json.nextPageToken || null;
  } while (pageToken);

  return results;
}

// Firestoreドキュメントを普通のオブジェクトに変換
function parseFirestoreDoc(doc) {
  const id = doc.name ? doc.name.split('/').pop() : '';
  const obj = { id };
  const fields = doc.fields || {};

  for (const [key, val] of Object.entries(fields)) {
    if      (val.stringValue  !== undefined) obj[key] = val.stringValue;
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue);
    else if (val.doubleValue  !== undefined) obj[key] = parseFloat(val.doubleValue);
    else if (val.nullValue    !== undefined) obj[key] = null;
    else if (val.arrayValue   !== undefined) {
      obj[key] = (val.arrayValue.values || []).map(v =>
        v.stringValue ?? v.integerValue ?? v.booleanValue ?? null
      );
    }
    else if (val.mapValue !== undefined) {
      obj[key] = parseFirestoreDoc({ name: '', fields: val.mapValue.fields || {} });
    }
  }
  return obj;
}

// ----------------------------------------------------------------
// 送信済みログ（Script Properties に保存）
// ----------------------------------------------------------------
function getSentLog() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('SENT_LOG') || '{}');
  } catch { return {}; }
}

function markAsSent(key) {
  const props = PropertiesService.getScriptProperties();
  const log = getSentLog();
  log[key] = new Date().toISOString();
  // 2000件超えたら古い順に削除
  const entries = Object.entries(log).sort((a, b) => a[1].localeCompare(b[1]));
  if (entries.length > 2000) entries.splice(0, entries.length - 2000);
  props.setProperty('SENT_LOG', JSON.stringify(Object.fromEntries(entries)));
}

function alreadySent(key) {
  return !!getSentLog()[key];
}

// ----------------------------------------------------------------
// 日付フォーマット
// ----------------------------------------------------------------
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日','月','火','水','木','金','土'];
  return `${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

// ----------------------------------------------------------------
// 個人設定のデフォルト値
// ----------------------------------------------------------------
const DEFAULT_SETTINGS = {
  orientationEnabled: true,
  orientationDaysBefore: 1,
  orientationHour: 9,
  orientationMinute: 0,
  taskEnabled: true,
  taskDaysBefore: 1,
  taskHour: 9,
  taskMinute: 0,
};

// emailSettings ドキュメントをパースして設定オブジェクトを返す
function parseUserSettings(doc) {
  return {
    email:                  doc.id, // ドキュメントIDがメールアドレス
    orientationEnabled:     doc.orientationEnabled  !== false,
    orientationDaysBefore:  typeof doc.orientationDaysBefore === 'number' ? doc.orientationDaysBefore : DEFAULT_SETTINGS.orientationDaysBefore,
    orientationHour:        typeof doc.orientationHour        === 'number' ? doc.orientationHour        : DEFAULT_SETTINGS.orientationHour,
    orientationMinute:      typeof doc.orientationMinute      === 'number' ? doc.orientationMinute      : DEFAULT_SETTINGS.orientationMinute,
    taskEnabled:            doc.taskEnabled         !== false,
    taskDaysBefore:         typeof doc.taskDaysBefore         === 'number' ? doc.taskDaysBefore         : DEFAULT_SETTINGS.taskDaysBefore,
    taskHour:               typeof doc.taskHour               === 'number' ? doc.taskHour               : DEFAULT_SETTINGS.taskHour,
    taskMinute:             typeof doc.taskMinute             === 'number' ? doc.taskMinute             : DEFAULT_SETTINGS.taskMinute,
  };
}

// ----------------------------------------------------------------
// 送信タイミングチェック: 現在時刻がリマインド時刻を過ぎているか
// (hourly実行なので ±0〜59分 の窓で判定)
// ----------------------------------------------------------------
function isDue(now, remindAt) {
  // remindAt 以降 かつ remindAt + 60分 未満  → この1時間の枠で送る
  const window = 60 * 60 * 1000;
  return now >= remindAt.getTime() && now < remindAt.getTime() + window;
}

// ----------------------------------------------------------------
// メイン関数 ← トリガーで毎時実行される
// ----------------------------------------------------------------
function sendHourlyReminders() {
  const config = getConfig();

  if (!config.projectId || !config.apiKey) {
    Logger.log('❌ エラー: スクリプトプロパティにFirebase設定がありません');
    return;
  }

  Logger.log(`▶ リマインダー送信開始: ${new Date().toLocaleString('ja-JP')}`);

  const now = new Date();

  // データ取得
  const bookings       = firestoreList(config.projectId, config.apiKey, 'bookings');
  const timeSlots      = firestoreList(config.projectId, config.apiKey, 'timeSlots');
  const staffProfiles  = firestoreList(config.projectId, config.apiKey, 'staffProfiles');
  const tasks          = firestoreList(config.projectId, config.apiKey, 'tasks');
  const emailSettingsDocs = firestoreList(config.projectId, config.apiKey, 'emailSettings');

  Logger.log(`  予約: ${bookings.length}件 / 枠: ${timeSlots.length}件 / スタッフ: ${staffProfiles.length}件 / タスク: ${tasks.length}件 / メール設定: ${emailSettingsDocs.length}件`);

  // emailSettingsをメールアドレスでマップ化
  const userSettingsMap = {};
  for (const doc of emailSettingsDocs) {
    userSettingsMap[doc.id] = parseUserSettings(doc);
  }

  let sentCount = 0;

  // ============================================================
  // ① 説明会リマインド（担当スタッフの個人設定で送る）
  // ============================================================
  for (const booking of bookings) {
    if (booking.status !== 'confirmed' || !booking.confirmedSlotId) continue;

    const slot = timeSlots.find(s => s.id === booking.confirmedSlotId);
    if (!slot || !slot.date || !slot.startTime) continue;

    const staff = staffProfiles.find(p => p.id === booking.assignedStaffId);
    if (!staff || !staff.email) continue;

    // 担当スタッフの個人設定を取得（なければデフォルト）
    const userSettings = userSettingsMap[staff.email] || DEFAULT_SETTINGS;
    if (!userSettings.orientationEnabled) continue;

    const slotDatetime = new Date(`${slot.date}T${slot.startTime}:00`);
    if (slotDatetime.getTime() <= now.getTime()) continue; // 既に過去

    // リマインド送信時刻: 説明会X日前の指定時刻
    const remindAt = new Date(slotDatetime);
    remindAt.setDate(remindAt.getDate() - userSettings.orientationDaysBefore);
    remindAt.setHours(userSettings.orientationHour, userSettings.orientationMinute, 0, 0);

    const logKey = `orientation_${booking.id}_${staff.email}`;
    if (!isDue(now, remindAt)) continue;
    if (alreadySent(logKey)) continue;

    const daysLabel = userSettings.orientationDaysBefore === 0 ? '本日' : `${userSettings.orientationDaysBefore}日後`;
    const subject = `【説明会リマインド】${formatDate(slot.date)} ${slot.startTime}〜 ${booking.studentName}さん`;
    const body = [
      `${staff.lastName} さん`,
      '',
      `${daysLabel}に説明会があります。ご確認ください。`,
      '',
      `▼ 説明会詳細`,
      `日時  : ${formatDate(slot.date)} ${slot.startTime}〜${slot.endTime}`,
      `学生  : ${booking.studentName}`,
      booking.studentEmail ? `メール: ${booking.studentEmail}` : '',
      booking.meetLink     ? `Meet  : ${booking.meetLink}` : '',
      '',
      '─────────────────────',
      'このメールは Lueur ポータルサイトから自動送信されました。',
    ].filter(l => l !== null && l !== undefined).join('\n');

    try {
      GmailApp.sendEmail(staff.email, subject, body);
      markAsSent(logKey);
      sentCount++;
      Logger.log(`  ✉ 送信: ${staff.email} → ${subject}`);
    } catch (e) {
      Logger.log(`  ❌ 送信失敗: ${staff.email} → ${e.message}`);
    }
  }

  // ============================================================
  // ② タスクリマインド（assigneeの個人設定で各人に送る）
  // ============================================================
  for (const task of tasks) {
    if (task.status === 'done' || !task.dueDate) continue;

    const dueEnd = new Date(task.dueDate + 'T23:59:59');
    if (dueEnd.getTime() <= now.getTime()) continue; // 期限切れ

    const assignees = task.assigneeEmails || [];
    const isAll = assignees.length === 1 && assignees[0] === 'all';

    // 送信先メールアドレス一覧
    const recipientEmails = isAll
      ? staffProfiles.map(p => p.email).filter(Boolean)
      : assignees.filter(e => e && !e.startsWith('role:'));

    for (const recipientEmail of recipientEmails) {
      const userSettings = userSettingsMap[recipientEmail] || DEFAULT_SETTINGS;
      if (!userSettings.taskEnabled) continue;

      const remindAt = new Date(task.dueDate + 'T00:00:00');
      remindAt.setDate(remindAt.getDate() - userSettings.taskDaysBefore);
      remindAt.setHours(userSettings.taskHour, userSettings.taskMinute, 0, 0);

      const logKey = `task_${task.id}_${recipientEmail}`;
      if (!isDue(now, remindAt)) continue;
      if (alreadySent(logKey)) continue;

      const recipientProfile = staffProfiles.find(p => p.email === recipientEmail);
      const recipientName = recipientProfile
        ? (recipientProfile.fullName || recipientProfile.lastName || recipientEmail)
        : recipientEmail;

      const dueDateLabel = formatDate(task.dueDate) + (task.dueTime ? ` ${task.dueTime}` : '');
      const subject = `【タスクリマインド】${task.title}`;
      const body = [
        `${recipientName} さん`,
        '',
        '期限が近いタスクのリマインドです。',
        '',
        `▼ タスク詳細`,
        `タスク: ${task.title}`,
        task.description ? `詳細 : ${task.description}` : '',
        `期限 : ${dueDateLabel}`,
        task.url ? `URL  : ${task.url}` : '',
        '',
        '─────────────────────',
        'このメールは Lueur ポータルサイトから自動送信されました。',
      ].filter(l => l !== null && l !== undefined).join('\n');

      try {
        GmailApp.sendEmail(recipientEmail, subject, body);
        markAsSent(logKey);
        sentCount++;
        Logger.log(`  ✉ 送信: ${recipientEmail} → ${subject}`);
      } catch (e) {
        Logger.log(`  ❌ 送信失敗: ${recipientEmail} → ${e.message}`);
      }
    }
  }

  Logger.log(`▶ 完了: ${sentCount}件送信`);
}

// ----------------------------------------------------------------
// テスト用: 手動でログだけ確認（メール送信しない）
// ----------------------------------------------------------------
function dryRun() {
  const config = getConfig();
  const now = new Date();

  const bookings       = firestoreList(config.projectId, config.apiKey, 'bookings');
  const timeSlots      = firestoreList(config.projectId, config.apiKey, 'timeSlots');
  const staffProfiles  = firestoreList(config.projectId, config.apiKey, 'staffProfiles');
  const tasks          = firestoreList(config.projectId, config.apiKey, 'tasks');
  const emailSettingsDocs = firestoreList(config.projectId, config.apiKey, 'emailSettings');

  Logger.log('=== DRY RUN ===');
  Logger.log(`取得データ: 予約${bookings.length}件, 枠${timeSlots.length}件, スタッフ${staffProfiles.length}件, タスク${tasks.length}件, メール設定${emailSettingsDocs.length}件`);

  const userSettingsMap = {};
  for (const doc of emailSettingsDocs) {
    userSettingsMap[doc.id] = parseUserSettings(doc);
  }

  Logger.log('--- 個人設定 ---');
  for (const [email, s] of Object.entries(userSettingsMap)) {
    Logger.log(`  ${email}: 説明会=${s.orientationEnabled ? `有効(${s.orientationDaysBefore}日前 ${s.orientationHour}:${String(s.orientationMinute).padStart(2,'0')})` : '無効'} / タスク=${s.taskEnabled ? `有効(${s.taskDaysBefore}日前 ${s.taskHour}:${String(s.taskMinute).padStart(2,'0')})` : '無効'}`);
  }

  Logger.log('--- 説明会リマインド対象 ---');
  for (const booking of bookings) {
    if (booking.status !== 'confirmed' || !booking.confirmedSlotId) continue;
    const slot = timeSlots.find(s => s.id === booking.confirmedSlotId);
    if (!slot) continue;
    const staff = staffProfiles.find(p => p.id === booking.assignedStaffId);
    const userSettings = staff ? (userSettingsMap[staff.email] || DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
    Logger.log(`  [説明会] ${slot.date} ${slot.startTime} / ${booking.studentName} / 担当: ${staff ? staff.lastName : '不明'} / 設定: ${userSettings.orientationDaysBefore}日前 ${userSettings.orientationHour}時`);
  }

  Logger.log('--- タスクリマインド対象 ---');
  for (const task of tasks) {
    if (task.status === 'done' || !task.dueDate) continue;
    Logger.log(`  [タスク] ${task.dueDate} / ${task.title} / 担当: ${(task.assigneeEmails || []).join(', ')}`);
  }

  Logger.log('=== END DRY RUN ===');
}

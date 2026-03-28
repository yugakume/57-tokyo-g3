// ================================================================
// Lueur ポータル - 自動メールリマインダー
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
//      ORIENTATION_ENABLED  : true
//      ORIENTATION_DAYS     : 1        ← 何日前（1=前日, 2=2日前）
//      ORIENTATION_HOUR     : 9        ← 何時に送るか（9=9:00）
//      TASK_ENABLED         : true
//      TASK_DAYS            : 1
//      TASK_HOUR            : 9
// 4. 「sendDailyReminders」関数を一度手動実行して権限を付与
// 5. トリガーを追加:
//    「トリガーを追加」→ sendDailyReminders → 時間主導型 → 日タイマー → 午前9時〜10時
//
// 【Firestore ルールの変更が必要】
//    Firebase Console → Firestore → ルール に以下を設定してください:
//    （ポータルサイトの README.md も参照）
// ================================================================

// ----------------------------------------------------------------
// 設定読み込み
// ----------------------------------------------------------------
function getSettings() {
  const p = PropertiesService.getScriptProperties();
  return {
    projectId:           p.getProperty('FIREBASE_PROJECT_ID')  || '',
    apiKey:              p.getProperty('FIREBASE_API_KEY')      || '',
    orientationEnabled:  p.getProperty('ORIENTATION_ENABLED')  !== 'false',
    orientationDays:     parseInt(p.getProperty('ORIENTATION_DAYS') || '1'),
    orientationHour:     parseInt(p.getProperty('ORIENTATION_HOUR') || '9'),
    taskEnabled:         p.getProperty('TASK_ENABLED')          !== 'false',
    taskDays:            parseInt(p.getProperty('TASK_DAYS')    || '1'),
    taskHour:            parseInt(p.getProperty('TASK_HOUR')    || '9'),
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
  const id = doc.name.split('/').pop();
  const obj = { id };
  const fields = doc.fields || {};

  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue  !== undefined) obj[key] = val.stringValue;
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
  // 1000件超えたら古い順に削除
  const entries = Object.entries(log).sort((a, b) => a[1].localeCompare(b[1]));
  if (entries.length > 1000) entries.splice(0, entries.length - 1000);
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
// メイン関数 ← トリガーで毎日実行される
// ----------------------------------------------------------------
function sendDailyReminders() {
  const settings = getSettings();

  if (!settings.projectId || !settings.apiKey) {
    Logger.log('❌ エラー: スクリプトプロパティにFirebase設定がありません');
    return;
  }

  Logger.log(`▶ リマインダー送信開始: ${new Date().toLocaleString('ja-JP')}`);

  const now = new Date();

  // データ取得
  const bookings      = firestoreList(settings.projectId, settings.apiKey, 'bookings');
  const timeSlots     = firestoreList(settings.projectId, settings.apiKey, 'timeSlots');
  const staffProfiles = firestoreList(settings.projectId, settings.apiKey, 'staffProfiles');
  const tasks         = firestoreList(settings.projectId, settings.apiKey, 'tasks');

  Logger.log(`  予約: ${bookings.length}件 / 枠: ${timeSlots.length}件 / スタッフ: ${staffProfiles.length}件 / タスク: ${tasks.length}件`);

  let sentCount = 0;

  // ============================================================
  // ① 説明会リマインド
  // ============================================================
  if (settings.orientationEnabled) {
    for (const booking of bookings) {
      if (booking.status !== 'confirmed' || !booking.confirmedSlotId) continue;

      const slot = timeSlots.find(s => s.id === booking.confirmedSlotId);
      if (!slot || !slot.date || !slot.startTime) continue;

      // 送信タイミング計算: 説明会X日前のsettings.orientationHour時
      const slotDatetime = new Date(`${slot.date}T${slot.startTime}:00`);
      const remindAt = new Date(slotDatetime);
      remindAt.setDate(remindAt.getDate() - settings.orientationDays);
      remindAt.setHours(settings.orientationHour, 0, 0, 0);

      const logKey = `orientation_${booking.id}`;
      if (now < remindAt || now >= slotDatetime) continue; // 時間外
      if (alreadySent(logKey)) continue;                   // 送信済み

      // 担当スタッフを特定
      const staff = staffProfiles.find(p => p.id === booking.assignedStaffId);
      if (!staff || !staff.email) continue;

      const subject = `【説明会リマインド】${formatDate(slot.date)} ${slot.startTime}〜 ${booking.studentName}さん`;
      const body = [
        `${staff.lastName} さん`,
        '',
        `${settings.orientationDays === 0 ? '本日' : settings.orientationDays + '日後'}に説明会があります。ご確認ください。`,
        '',
        `▼ 説明会詳細`,
        `日時  : ${formatDate(slot.date)} ${slot.startTime}〜${slot.endTime}`,
        `学生  : ${booking.studentName}`,
        booking.studentEmail ? `メール: ${booking.studentEmail}` : '',
        booking.meetLink     ? `Meet  : ${booking.meetLink}` : '',
        '',
        '─────────────────────',
        'このメールは Lueur ポータルサイトから自動送信されました。',
      ].filter(l => l !== null).join('\n');

      try {
        GmailApp.sendEmail(staff.email, subject, body);
        markAsSent(logKey);
        sentCount++;
        Logger.log(`  ✉ 送信: ${staff.email} → ${subject}`);
      } catch (e) {
        Logger.log(`  ❌ 送信失敗: ${staff.email} → ${e.message}`);
      }
    }
  }

  // ============================================================
  // ② タスクリマインド
  // ============================================================
  if (settings.taskEnabled) {
    for (const task of tasks) {
      if (task.status === 'done' || !task.dueDate) continue;

      const dueEnd  = new Date(task.dueDate + 'T23:59:00');
      const remindAt = new Date(task.dueDate + 'T00:00:00');
      remindAt.setDate(remindAt.getDate() - settings.taskDays);
      remindAt.setHours(settings.taskHour, 0, 0, 0);

      const logKey = `task_${task.id}`;
      if (now < remindAt || now >= dueEnd) continue;
      if (alreadySent(logKey)) continue;

      const assignees = task.assigneeEmails || [];
      const isAll = assignees.length === 1 && assignees[0] === 'all';
      const emails = isAll
        ? staffProfiles.map(p => p.email).filter(Boolean)
        : assignees.filter(e => e && !e.startsWith('role:'));

      if (emails.length === 0) continue;

      const names = emails.map(e => {
        const p = staffProfiles.find(p => p.email === e);
        return p ? (p.fullName || p.lastName || e) : e;
      });

      const dueDateLabel = formatDate(task.dueDate) + (task.dueTime ? ` ${task.dueTime}` : '');
      const subject = `【タスクリマインド】${task.title}`;
      const body = [
        `${names.join('、')} さん`,
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
      ].filter(l => l !== null).join('\n');

      try {
        GmailApp.sendEmail(emails.join(','), subject, body);
        markAsSent(logKey);
        sentCount++;
        Logger.log(`  ✉ 送信: ${emails.join(',')} → ${subject}`);
      } catch (e) {
        Logger.log(`  ❌ 送信失敗: ${e.message}`);
      }
    }
  }

  Logger.log(`▶ 完了: ${sentCount}件送信`);
}

// ----------------------------------------------------------------
// テスト用: 手動でログだけ確認（メール送信しない）
// ----------------------------------------------------------------
function dryRun() {
  const settings = getSettings();
  const now = new Date();

  const bookings      = firestoreList(settings.projectId, settings.apiKey, 'bookings');
  const timeSlots     = firestoreList(settings.projectId, settings.apiKey, 'timeSlots');
  const staffProfiles = firestoreList(settings.projectId, settings.apiKey, 'staffProfiles');
  const tasks         = firestoreList(settings.projectId, settings.apiKey, 'tasks');

  Logger.log('=== DRY RUN ===');
  Logger.log(`取得データ: 予約${bookings.length}件, 枠${timeSlots.length}件, スタッフ${staffProfiles.length}件, タスク${tasks.length}件`);

  // 送信予定の一覧を出力
  for (const booking of bookings) {
    if (booking.status !== 'confirmed' || !booking.confirmedSlotId) continue;
    const slot = timeSlots.find(s => s.id === booking.confirmedSlotId);
    if (!slot) continue;
    const staff = staffProfiles.find(p => p.id === booking.assignedStaffId);
    Logger.log(`[説明会] ${slot.date} ${slot.startTime} / ${booking.studentName} / 担当: ${staff ? staff.lastName : '不明'}`);
  }

  for (const task of tasks) {
    if (task.status === 'done' || !task.dueDate) continue;
    Logger.log(`[タスク] ${task.dueDate} / ${task.title}`);
  }

  Logger.log('=== END DRY RUN ===');
}

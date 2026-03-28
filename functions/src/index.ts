import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const GOOGLE_CLIENT_ID = "346842421426-kthmpbq2kndbahrh197i7bhldcab9uql.apps.googleusercontent.com";
const googleClientSecret = defineSecret("GOOGLE_CALENDAR_CLIENT_SECRET");

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://yugakume.github.io",
];

function handleCors(req: functions.https.Request, res: functions.Response): boolean {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith(".github.io"))) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send(""); return false;
  }
  return true;
}

function makeDocId(userId: string, googleEmail: string): string {
  return `${userId}_${googleEmail.replace(/@/g, "_at_").replace(/\./g, "_dot_")}`;
}

// exchangeAuthCode: OAuthコード → トークン取得・保存
export const exchangeAuthCode = functions
  .runWith({ secrets: [googleClientSecret] })
  .https.onRequest(async (req, res) => {
    if (!handleCors(req, res)) return;
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { code, userId } = req.body as { code?: string; userId?: string };
    if (!code || !userId) { res.status(400).json({ error: "Missing params" }); return; }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: googleClientSecret.value(),
          redirect_uri: "postmessage",
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json() as {
        access_token?: string; refresh_token?: string; expires_in?: number; error?: string;
      };
      if (!tokens.access_token) { res.status(400).json({ error: "Token exchange failed", detail: tokens }); return; }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json() as { email: string };
      const googleEmail = userInfo.email;
      const expiresAt = Date.now() + ((tokens.expires_in ?? 3600) - 60) * 1000;

      await db.collection("calendarTokens").doc(makeDocId(userId, googleEmail)).set({
        userId, googleEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        connectedAt: new Date().toISOString(),
      });

      res.json({ accessToken: tokens.access_token, expiresAt, googleEmail });
    } catch (e) {
      functions.logger.error("exchangeAuthCode:", e);
      res.status(500).json({ error: String(e) });
    }
  });

// getCalendarToken: 有効なトークンを返す（期限切れなら自動更新）
export const getCalendarToken = functions
  .runWith({ secrets: [googleClientSecret] })
  .https.onRequest(async (req, res) => {
    if (!handleCors(req, res)) return;
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { userId, googleEmail } = req.body as { userId?: string; googleEmail?: string };
    if (!userId || !googleEmail) { res.status(400).json({ error: "Missing params" }); return; }

    const docSnap = await db.collection("calendarTokens").doc(makeDocId(userId, googleEmail)).get();
    if (!docSnap.exists) { res.status(404).json({ error: "Not connected" }); return; }

    const data = docSnap.data()!;
    // まだ有効（5分以上残っている）
    if ((data.expiresAt as number) > Date.now() + 5 * 60 * 1000) {
      res.json({ accessToken: data.accessToken, expiresAt: data.expiresAt, googleEmail }); return;
    }
    if (!data.refreshToken) { res.status(400).json({ error: "No refresh token. Please reconnect." }); return; }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: data.refreshToken as string,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: googleClientSecret.value(),
          grant_type: "refresh_token",
        }),
      });
      const tokens = await tokenRes.json() as { access_token?: string; expires_in?: number };
      if (!tokens.access_token) { res.status(400).json({ error: "Token refresh failed" }); return; }

      const expiresAt = Date.now() + ((tokens.expires_in ?? 3600) - 60) * 1000;
      await db.collection("calendarTokens").doc(makeDocId(userId, googleEmail)).update({
        accessToken: tokens.access_token, expiresAt,
      });
      res.json({ accessToken: tokens.access_token, expiresAt, googleEmail });
    } catch (e) {
      functions.logger.error("getCalendarToken refresh:", e);
      res.status(500).json({ error: String(e) });
    }
  });

// listCalendarAccounts: 連携済みアカウント一覧
export const listCalendarAccounts = functions.https.onRequest(async (req, res) => {
  if (!handleCors(req, res)) return;
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: "Missing userId" }); return; }

  const snap = await db.collection("calendarTokens").where("userId", "==", userId).get();
  res.json({
    accounts: snap.docs.map(d => ({
      googleEmail: d.data().googleEmail as string,
      connectedAt: d.data().connectedAt as string,
    })),
  });
});

// revokeCalendarAccount: 連携解除
export const revokeCalendarAccount = functions.https.onRequest(async (req, res) => {
  if (!handleCors(req, res)) return;
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const { userId, googleEmail } = req.body as { userId?: string; googleEmail?: string };
  if (!userId || !googleEmail) { res.status(400).json({ error: "Missing params" }); return; }

  await db.collection("calendarTokens").doc(makeDocId(userId, googleEmail)).delete();
  res.json({ success: true });
});

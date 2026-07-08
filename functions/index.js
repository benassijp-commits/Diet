import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

const aiApiKey = defineSecret("AI_API_KEY");
const DEFAULT_AI_BASE_URL = "https://nano-gpt.com/api/v1";
const DEFAULT_AI_MODEL = "deepseek/deepseek-latest";
const SCHEDULED_NOTIFICATION_LIMIT = 100;
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const firestore = getFirestore();
const messaging = getMessaging();

export const aiProxy = onCall(
  {
    secrets: [aiApiKey],
    cors: true,
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before using AI.");
    }

    const messages = validateMessages(request.data?.messages);
    const temperature = normalizeTemperature(request.data?.temperature);
    const apiKey = readAiApiKey();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "AI_API_KEY is not configured.");
    }

    const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL);
    const model = String(process.env.AI_MODEL || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new HttpsError("internal", `AI request failed (${response.status}). ${detail.slice(0, 180)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new HttpsError("internal", "AI response did not include content.");
    }

    try {
      return JSON.parse(stripCodeFence(content));
    } catch {
      throw new HttpsError("internal", "AI response was not valid JSON.");
    }
  },
);

export const processScheduledNotifications = onSchedule("every 1 minutes", async () => {
  const now = Timestamp.now();
  const snapshot = await firestore.collectionGroup("scheduledNotifications")
    .where("status", "==", "pending")
    .where("dueAt", "<=", now)
    .orderBy("dueAt", "asc")
    .limit(SCHEDULED_NOTIFICATION_LIMIT)
    .get();

  let sent = 0;
  let failed = 0;
  const typeCounts = {};

  for (const notificationDoc of snapshot.docs) {
    const uid = notificationDoc.ref.parent.parent?.id;
    const notification = notificationDoc.data();
    const type = String(notification.type || "unknown");
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    if (!uid) {
      failed += 1;
      await markNotificationFailed(notificationDoc.ref, "missing-user");
      continue;
    }

    try {
      const tokenSnapshot = await firestore.collection("users").doc(uid).collection("notificationTokens")
        .where("enabled", "==", true)
        .limit(500)
        .get();
      const tokens = tokenSnapshot.docs
        .map((tokenDoc) => ({ ref: tokenDoc.ref, token: String(tokenDoc.data().token || "") }))
        .filter((item) => item.token);

      if (!tokens.length) {
        await markNotificationFailed(notificationDoc.ref, "no-active-token");
        failed += 1;
        continue;
      }

      const response = await messaging.sendEachForMulticast({
        tokens: tokens.map((item) => item.token),
        notification: {
          title: String(notification.title || "Lembrete"),
          body: String(notification.body || ""),
        },
        data: {
          type,
          notificationId: notificationDoc.id,
          dedupeKey: String(notification.dedupeKey || ""),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "reminders",
          },
        },
        webpush: {
          notification: {
            tag: String(notification.dedupeKey || notificationDoc.id),
            renotify: true,
          },
        },
      });

      await markInvalidTokens(tokens, response.responses);
      await notificationDoc.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        delivery: {
          successCount: response.successCount,
          failureCount: response.failureCount,
        },
      });
      sent += 1;
      console.info("scheduled notification processed", { id: notificationDoc.id, type, success: response.successCount, failure: response.failureCount });
    } catch (error) {
      failed += 1;
      await markNotificationFailed(notificationDoc.ref, error?.code || "send-failed");
      console.warn("scheduled notification failed", { id: notificationDoc.id, type, code: error?.code || "send-failed" });
    }
  }

  console.info("scheduled notifications run complete", {
    processed: snapshot.size,
    sent,
    failed,
    typeCounts,
  });
});

function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 12) {
    throw new HttpsError("invalid-argument", "messages must be a non-empty array.");
  }

  return messages.map((message) => {
    const role = String(message?.role || "").trim();
    const content = String(message?.content || "").trim();
    if (!["system", "user", "assistant"].includes(role) || !content) {
      throw new HttpsError("invalid-argument", "messages contain an invalid role or empty content.");
    }
    if (content.length > 120000) {
      throw new HttpsError("invalid-argument", "message content is too large.");
    }
    return { role, content };
  });
}

function normalizeTemperature(value) {
  const temperature = Number(value ?? 0.1);
  return Number.isFinite(temperature) ? Math.max(0, Math.min(1, temperature)) : 0.1;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
}

function readAiApiKey() {
  try {
    return aiApiKey.value() || process.env.AI_API_KEY || "";
  } catch {
    return process.env.AI_API_KEY || "";
  }
}

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function markInvalidTokens(tokens, responses) {
  const batch = firestore.batch();
  let invalidCount = 0;
  responses.forEach((response, index) => {
    const code = response.error?.code || "";
    if (!code || !INVALID_TOKEN_CODES.has(code)) return;
    invalidCount += 1;
    batch.update(tokens[index].ref, {
      enabled: false,
      invalidAt: FieldValue.serverTimestamp(),
      invalidReason: code,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  if (invalidCount) await batch.commit();
}

function markNotificationFailed(ref, reason) {
  return ref.update({
    status: "sent",
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    delivery: {
      successCount: 0,
      failureCount: 1,
      reason: String(reason || "unknown").slice(0, 80),
    },
  });
}

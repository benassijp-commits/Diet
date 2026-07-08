import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, getCurrentUser } from "./cloud-store.js";

const MEAL_REMINDER_ID = "mealReminder-next";
const TEST_REMINDER_PREFIX = "testReminder";

export async function scheduleMealReminderNotification({ state, t = (key) => key }) {
  const user = getCurrentUser();
  if (!user || !mealReminderSettingsEnabled(state)) {
    await cancelScheduledNotifications("mealReminder");
    return;
  }

  const reminderAt = state.mealReminder?.nextMealReminderAt;
  const baseMealId = state.mealReminder?.lastMealReminderBaseMealId;
  if (!validIso(reminderAt) || !baseMealId || !hasPlannedMealAfter(state, baseMealId)) {
    await cancelScheduledNotifications("mealReminder");
    return;
  }

  await cancelScheduledNotifications("mealReminder", MEAL_REMINDER_ID);
  await setDoc(notificationDoc(user.uid, MEAL_REMINDER_ID), {
    type: "mealReminder",
    dueAt: Timestamp.fromDate(new Date(reminderAt)),
    status: "pending",
    title: t("notifications.mealReminderTitle"),
    body: t("notifications.mealReminderBody"),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sentAt: null,
    cancelledAt: null,
    relatedMealId: nextMealAfter(state, baseMealId)?.id || "",
    workoutSessionId: "",
    dedupeKey: `mealReminder:${baseMealId}:${reminderAt}`,
  }, { merge: true });
}

export async function scheduleWorkoutRestNotification({ session, t = (key) => key }) {
  const user = getCurrentUser();
  if (!user || !validIso(session?.timerEndsAt)) return;

  const notificationId = workoutRestNotificationId(session.id);
  await cancelScheduledNotifications("workoutRest", notificationId);
  await setDoc(notificationDoc(user.uid, notificationId), {
    type: "workoutRest",
    dueAt: Timestamp.fromDate(new Date(session.timerEndsAt)),
    status: "pending",
    title: t("notifications.workoutRestTitle"),
    body: t("notifications.workoutRestBody"),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sentAt: null,
    cancelledAt: null,
    relatedMealId: "",
    workoutSessionId: session.id || "",
    dedupeKey: `workoutRest:${session.id || "session"}:${session.timerEndsAt}`,
  }, { merge: true });
}

export async function cancelScheduledNotifications(type, exceptNotificationId = "", options = {}) {
  const user = getCurrentUser();
  if (!user) return;

  const snapshot = await getDocs(query(
    notificationsCollection(user.uid),
    where("type", "==", type),
    where("status", "==", "pending"),
    limit(20),
  ));
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  let writeCount = 0;
  const preserveDueAfter = Number(options.preserveDueWithinMs || 0) > 0
    ? Date.now() + Number(options.preserveDueWithinMs || 0)
    : 0;
  for (const notification of snapshot.docs) {
    if (notification.id === exceptNotificationId) continue;
    if (preserveDueAfter && dueAtMillis(notification.data()?.dueAt) <= preserveDueAfter) continue;
    batch.update(notification.ref, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    writeCount += 1;
  }
  if (!writeCount) return;
  await batch.commit();
}

export async function getRegisteredNotificationTokenCount() {
  const user = getCurrentUser();
  if (!user) return 0;
  const snapshot = await getDocs(query(
    collection(db, "users", user.uid, "notificationTokens"),
    where("enabled", "==", true),
    limit(500),
  ));
  return snapshot.size;
}

export async function getScheduledNotificationDiagnostics() {
  const user = getCurrentUser();
  if (!user) {
    return {
      tokenCount: 0,
      mealReminder: null,
      workoutRest: null,
      testReminder: null,
    };
  }

  const [tokenCount, mealReminder, workoutRest, testReminder] = await Promise.all([
    getRegisteredNotificationTokenCount(),
    getNotificationDiagnostic("mealReminder"),
    getNotificationDiagnostic("workoutRest"),
    getNotificationDiagnostic("testReminder"),
  ]);

  return { tokenCount, mealReminder, workoutRest, testReminder };
}

export async function scheduleTestNotification({ t = (key) => key } = {}) {
  const user = getCurrentUser();
  if (!user) throw new Error("Usuario nao autenticado.");
  const dueAt = new Date(Date.now() + 60000);
  const notificationId = `${TEST_REMINDER_PREFIX}-${Date.now()}`;
  await setDoc(notificationDoc(user.uid, notificationId), {
    type: "testReminder",
    dueAt: Timestamp.fromDate(dueAt),
    status: "pending",
    title: t("notifications.testTitle"),
    body: t("notifications.testBody"),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sentAt: null,
    cancelledAt: null,
    relatedMealId: "",
    workoutSessionId: "",
    dedupeKey: `testReminder:${dueAt.toISOString()}`,
  });
  return { id: notificationId, dueAt: dueAt.toISOString(), status: "pending" };
}

async function getNotificationDiagnostic(type) {
  const user = getCurrentUser();
  if (!user) return null;
  const snapshot = await getDocs(query(
    notificationsCollection(user.uid),
    where("type", "==", type),
    limit(50),
  ));
  const rows = snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));

  const pending = rows
    .filter((row) => row.status === "pending")
    .sort((left, right) => dueAtMillis(left.dueAt) - dueAtMillis(right.dueAt))[0];
  const fallback = rows.sort((left, right) => updatedAtMillis(right) - updatedAtMillis(left))[0];
  return notificationDiagnosticRow(pending || fallback || null);
}

function notificationsCollection(uid) {
  return collection(db, "users", uid, "scheduledNotifications");
}

function notificationDoc(uid, notificationId) {
  return doc(db, "users", uid, "scheduledNotifications", notificationId);
}

function workoutRestNotificationId(sessionId) {
  return `workoutRest-${encodeURIComponent(sessionId || "active")}`;
}

function mealReminderSettingsEnabled(state) {
  return Boolean(state.appSettings?.notificationsEnabled && state.appSettings?.notificationTypes?.mealReminders);
}

function nextMealAfter(state, mealId) {
  const meals = state.meals || [];
  const index = meals.findIndex((meal) => meal.id === mealId);
  return index >= 0 ? meals[index + 1] : null;
}

function hasPlannedMealAfter(state, mealId) {
  return Boolean(nextMealAfter(state, mealId));
}

function validIso(value) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function notificationDiagnosticRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type || "",
    status: row.status || "unknown",
    dueAt: toIso(row.dueAt),
    sentAt: toIso(row.sentAt),
    cancelledAt: toIso(row.cancelledAt),
    delivery: row.delivery || null,
  };
}

function updatedAtMillis(row) {
  return Math.max(timestampMillis(row.updatedAt), timestampMillis(row.createdAt), timestampMillis(row.dueAt));
}

function dueAtMillis(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = timestampMillis(value);
  return time || Number.POSITIVE_INFINITY;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function toIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

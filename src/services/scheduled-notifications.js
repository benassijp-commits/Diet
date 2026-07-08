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

export async function cancelScheduledNotifications(type, exceptNotificationId = "") {
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
  for (const notification of snapshot.docs) {
    if (notification.id === exceptNotificationId) continue;
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
    limit(2),
  ));
  return snapshot.size;
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

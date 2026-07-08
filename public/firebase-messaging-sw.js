/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js");

const CONFIG_DB_NAME = "diet-fcm-config";
const CONFIG_STORE_NAME = "config";
const CONFIG_KEY = "firebase";
const DEFAULT_NOTIFICATION_TITLE = "Diet";
const DEFAULT_NOTIFICATION_BODY = "Voce tem um novo lembrete.";
const RECENT_NOTIFICATION_TTL_MS = 8000;
const recentNotifications = new Map();

let messaging = null;

self.addEventListener("message", (event) => {
  if (event.data?.type !== "FIREBASE_CONFIG" || !event.data.config) return;
  event.waitUntil(saveFirebaseConfig(event.data.config).then(() => initializeFirebaseMessaging(event.data.config)));
});

self.addEventListener("install", (event) => {
  event.waitUntil(loadFirebaseConfig().then(initializeFirebaseMessaging));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(loadFirebaseConfig().then(initializeFirebaseMessaging));
  self.clients.claim();
});

loadFirebaseConfig().then(initializeFirebaseMessaging);

self.addEventListener("push", (event) => {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openOrFocusApp());
});

async function initializeFirebaseMessaging(config) {
  if (messaging || !config?.apiKey || !config?.projectId || !config?.messagingSenderId || !config?.appId) return;

  firebase.initializeApp(config);
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    return showDietNotification(payload);
  });
}

async function handlePushEvent(event) {
  const payload = parsePushPayload(event);
  await showDietNotification(payload);
}

function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (error) {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

async function showDietNotification(payload = {}) {
  const data = payload.data || {};
  const title = String(payload.notification?.title || data.title || payload.title || DEFAULT_NOTIFICATION_TITLE);
  const body = String(payload.notification?.body || data.body || payload.body || DEFAULT_NOTIFICATION_BODY);
  const tag = String(data.dedupeKey || data.notificationId || payload.fcmMessageId || payload.messageId || Date.now());

  if (isRecentNotification(tag)) return;
  markRecentNotification(tag);

  await self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    renotify: true,
    data,
  });
}

function isRecentNotification(tag) {
  cleanupRecentNotifications();
  return recentNotifications.has(tag);
}

function markRecentNotification(tag) {
  recentNotifications.set(tag, Date.now());
  cleanupRecentNotifications();
}

function cleanupRecentNotifications() {
  const cutoff = Date.now() - RECENT_NOTIFICATION_TTL_MS;
  for (const [tag, createdAt] of recentNotifications.entries()) {
    if (createdAt < cutoff) recentNotifications.delete(tag);
  }
}

async function openOrFocusApp() {
  const url = new URL("/", self.location.origin).href;
  const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existingClient = windowClients.find((client) => client.url.startsWith(url));
  if (existingClient) return existingClient.focus();
  return self.clients.openWindow(url);
}

function openConfigDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(CONFIG_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFirebaseConfig(config) {
  const db = await openConfigDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONFIG_STORE_NAME, "readwrite");
    transaction.objectStore(CONFIG_STORE_NAME).put(config, CONFIG_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadFirebaseConfig() {
  const db = await openConfigDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONFIG_STORE_NAME, "readonly");
    const request = transaction.objectStore(CONFIG_STORE_NAME).get(CONFIG_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

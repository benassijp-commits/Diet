/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js");

const CONFIG_DB_NAME = "diet-fcm-config";
const CONFIG_STORE_NAME = "config";
const CONFIG_KEY = "firebase";

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

async function initializeFirebaseMessaging(config) {
  if (messaging || !config?.apiKey || !config?.projectId || !config?.messagingSenderId || !config?.appId) return;

  firebase.initializeApp(config);
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "Diet";
    const options = {
      body: payload.notification?.body || payload.data?.body || "Nova notificacao recebida.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: payload.data || {},
    };

    self.registration.showNotification(title, options);
  });
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

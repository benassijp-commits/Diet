import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { publicFirebaseConfig } from "../../firebase-config.js";
import { app, db, getCurrentUser } from "./cloud-store.js";

const FCM_SERVICE_WORKER_URL = "/firebase-messaging-sw.js";
const PERMISSION_PROMPT_KEY = "joao-diet-notification-permission-prompted-at";
const PROMPT_COOLDOWN_MS = 10 * 60 * 1000;

let foregroundUnsubscribe = null;

const STATUS_MESSAGES = {
  unsupported: "Este navegador nao suporta notificacoes.",
  "insecure-context": "As notificacoes e instalacao do app precisam de HTTPS ou localhost. Em celular, IP local HTTP nao funciona.",
  "service-worker-unsupported": "Este navegador nao suporta service workers.",
  "messaging-unsupported": "Este navegador nao suporta Firebase Messaging.",
  denied: "Permissao de notificacoes negada no navegador.",
  "denied-settings": "Permissao de notificacoes bloqueada. Libere nas configuracoes do navegador/Android para tentar novamente.",
  "missing-vapid": "Chave publica VAPID ausente.",
  "signed-out": "Entre com Google para ativar notificacoes.",
  ready: "Pronto para ativar notificacoes.",
  enabled: "Notificacoes ativadas.",
  "permission-dismissed": "Permissao de notificacoes nao foi concedida.",
  "permission-recently-dismissed": "Permissao nao concedida recentemente. Libere nas configuracoes do navegador ou tente novamente mais tarde.",
  "no-token": "Nao foi possivel gerar o token de notificacoes.",
  "token-failed": "Permissao concedida, mas nao foi possivel registrar este dispositivo.",
  "setup-failed": "Nao foi possivel configurar notificacoes.",
};

export function getPushEnvironmentStatus() {
  if (typeof window === "undefined") return pushStatus(false, "unsupported");
  if (window.isSecureContext === false) return pushStatus(false, "insecure-context");
  if (!("Notification" in window)) return pushStatus(false, "unsupported");
  if (!("serviceWorker" in navigator)) return pushStatus(false, "service-worker-unsupported");
  if (Notification.permission === "denied") return pushStatus(false, "denied-settings", { permission: Notification.permission });
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return pushStatus(false, "missing-vapid");
  if (!getCurrentUser()) return pushStatus(false, "signed-out");
  return pushStatus(true, Notification.permission === "granted" ? "enabled" : "ready", { permission: Notification.permission });
}

export async function enablePushNotifications() {
  const environment = getPushEnvironmentStatus();
  if (!environment.ok) return environment;

  const supported = await isSupported();
  if (!supported) return pushStatus(false, "messaging-unsupported", { permission: Notification.permission });

  let permission = Notification.permission;
  if (permission === "denied") return pushStatus(false, "denied-settings", { permission });
  if (permission !== "granted") {
    if (wasPermissionPromptedRecently()) {
      return pushStatus(false, "permission-recently-dismissed", { permission });
    }
    markPermissionPrompted();
    permission = await Notification.requestPermission();
  }
  if (permission === "denied") return pushStatus(false, "denied-settings", { permission });
  if (permission !== "granted") return pushStatus(false, "permission-dismissed", { permission });

  let registration;
  try {
    registration = await registerFirebaseMessagingWorker();
  } catch (error) {
    console.error(error);
    return pushStatus(false, "setup-failed");
  }

  const messaging = getMessaging(app);
  let token;
  try {
    token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.warn("FCM getToken failed", {
      code: error?.code || "",
      message: error?.message || "",
      permission,
    });
    return pushStatus(false, "token-failed", { permission, errorCode: error?.code || "" });
  }

  if (!token) return pushStatus(false, "no-token", { permission });

  await saveNotificationToken(token);
  return { ...pushStatus(true, "enabled"), token };
}

export async function getCurrentPushDiagnostics() {
  const registration = await findFirebaseMessagingRegistration();
  const worker = registration?.active || registration?.installing || registration?.waiting || null;
  let token = "";
  if (getPushEnvironmentStatus().ok && Notification.permission === "granted" && await isSupported()) {
    try {
      const messaging = getMessaging(app);
      const readyRegistration = registration || await registerFirebaseMessagingWorker();
      token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: readyRegistration,
      }) || "";
      if (token) await saveNotificationToken(token);
    } catch (error) {
      console.warn("FCM diagnostics token read failed:", error?.code || error?.message || error);
    }
  }

  return {
    permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    serviceWorker: worker ? {
      scriptURL: worker.scriptURL || "",
      state: worker.state || "",
      scope: registration?.scope || "",
    } : null,
    token,
    tokenId: token ? encodeURIComponent(token) : "",
    tokenPreview: truncateToken(token),
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
  };
}

export async function recreateCurrentDeviceToken() {
  const environment = getPushEnvironmentStatus();
  if (!environment.ok) return { ...environment, diagnostics: await getCurrentPushDiagnostics() };
  if (!(await isSupported())) return { ...pushStatus(false, "messaging-unsupported"), diagnostics: await getCurrentPushDiagnostics() };
  if (Notification.permission !== "granted") return { ...pushStatus(false, "permission-dismissed"), diagnostics: await getCurrentPushDiagnostics() };

  const registration = await registerFirebaseMessagingWorker();
  const messaging = getMessaging(app);
  const currentToken = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch(() => "");

  await disableTokensForCurrentDevice(currentToken);
  if (currentToken) {
    await deleteToken(messaging).catch((error) => console.warn("FCM deleteToken failed:", error?.code || error?.message || error));
  }

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return { ...pushStatus(false, "no-token"), diagnostics: await getCurrentPushDiagnostics() };

  await saveNotificationToken(token);
  return { ...pushStatus(true, "enabled"), token, diagnostics: await getCurrentPushDiagnostics() };
}

export function pushStatusMessage(status, t) {
  if (!status) return "";
  const key = `notifications.${status.code}`;
  const translated = t?.(key);
  return translated && translated !== key ? translated : status.message;
}

export async function listenForForegroundMessages(onNotification) {
  if (foregroundUnsubscribe) return foregroundUnsubscribe;
  if (typeof window === "undefined" || !("Notification" in window)) return () => {};
  if (!(await isSupported())) return () => {};

  const messaging = getMessaging(app);
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "Notificacao recebida";
    const body = payload.notification?.body || payload.data?.body || "";
    console.info("FCM foreground message", payload);
    onNotification?.(body ? `${title}: ${body}` : title, payload);
  });
  return foregroundUnsubscribe;
}

export async function saveNotificationToken(token) {
  const user = getCurrentUser();
  if (!user) throw new Error("Usuario nao autenticado.");

  const tokenId = encodeURIComponent(token);
  await setDoc(doc(db, "users", user.uid, "notificationTokens", tokenId), {
    token,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    enabled: true,
  }, { merge: true });
}

async function registerFirebaseMessagingWorker() {
  const registration = await navigator.serviceWorker.register(FCM_SERVICE_WORKER_URL);
  const worker = await waitForServiceWorkerActivation(registration);
  worker?.postMessage({ type: "FIREBASE_CONFIG", config: publicFirebaseConfig });
  return registration;
}

async function findFirebaseMessagingRegistration() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.getRegistrations) return null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const matches = registrations.filter((registration) => {
    const worker = registration.active || registration.installing || registration.waiting;
    return worker?.scriptURL?.endsWith(FCM_SERVICE_WORKER_URL);
  });
  const rootScope = `${window.location.origin}/`;
  return matches.find((registration) => registration.scope === rootScope) || matches[0] || null;
}

async function disableTokensForCurrentDevice(currentToken = "") {
  const user = getCurrentUser();
  if (!user) return;
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const snapshot = await getDocs(query(
    collection(db, "users", user.uid, "notificationTokens"),
    where("enabled", "==", true),
    limit(500),
  ));

  const batch = writeBatch(db);
  let count = 0;
  for (const tokenDoc of snapshot.docs) {
    const token = String(tokenDoc.data().token || "");
    if (tokenDoc.data().userAgent !== userAgent || tokenDoc.data().platform !== platform) continue;
    batch.set(tokenDoc.ref, {
      enabled: false,
      replacedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      replacedByCurrentDevice: true,
      ...(currentToken && token === currentToken ? { replacedCurrentToken: true } : {}),
    }, { merge: true });
    count += 1;
  }
  if (count) await batch.commit();
}

function truncateToken(token) {
  if (!token) return "";
  return token.length > 24 ? `${token.slice(0, 12)}...${token.slice(-8)}` : token;
}

function waitForServiceWorkerActivation(registration) {
  if (registration.active) return Promise.resolve(registration.active);

  const worker = registration.installing || registration.waiting;
  if (!worker) return Promise.resolve(null);

  return new Promise((resolve) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve(worker);
    });
  });
}

function wasPermissionPromptedRecently() {
  const lastPrompt = Number(localStorage.getItem(PERMISSION_PROMPT_KEY) || 0);
  return lastPrompt > 0 && Date.now() - lastPrompt < PROMPT_COOLDOWN_MS;
}

function markPermissionPrompted() {
  localStorage.setItem(PERMISSION_PROMPT_KEY, String(Date.now()));
}

function pushStatus(ok, code, detail = {}) {
  return {
    ok,
    code,
    message: STATUS_MESSAGES[code] || STATUS_MESSAGES["setup-failed"],
    ...detail,
  };
}

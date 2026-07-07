import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { publicFirebaseConfig } from "../../firebase-config.js";
import { app, db, getCurrentUser } from "./cloud-store.js";

const FCM_SERVICE_WORKER_URL = "/firebase-messaging-sw.js";
const FCM_SERVICE_WORKER_SCOPE = "/firebase-cloud-messaging-push-scope/";

let foregroundUnsubscribe = null;

const STATUS_MESSAGES = {
  unsupported: "Este navegador nao suporta notificacoes.",
  "insecure-context": "As notificacoes e instalacao do app precisam de HTTPS ou localhost. Em celular, IP local HTTP nao funciona.",
  "service-worker-unsupported": "Este navegador nao suporta service workers.",
  denied: "Permissao de notificacoes negada no navegador.",
  "missing-vapid": "Chave publica VAPID ausente.",
  "signed-out": "Entre com Google para ativar notificacoes.",
  ready: "Pronto para ativar notificacoes.",
  enabled: "Notificacoes ativadas.",
  "permission-dismissed": "Permissao de notificacoes nao foi concedida.",
  "no-token": "Nao foi possivel gerar o token de notificacoes.",
  "setup-failed": "Nao foi possivel configurar notificacoes.",
};

export function getPushEnvironmentStatus() {
  if (typeof window === "undefined") return pushStatus(false, "unsupported");
  if (window.isSecureContext === false) return pushStatus(false, "insecure-context");
  if (!("Notification" in window)) return pushStatus(false, "unsupported");
  if (!("serviceWorker" in navigator)) return pushStatus(false, "service-worker-unsupported");
  if (Notification.permission === "denied") return pushStatus(false, "denied");
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return pushStatus(false, "missing-vapid");
  if (!getCurrentUser()) return pushStatus(false, "signed-out");
  return pushStatus(true, Notification.permission === "granted" ? "enabled" : "ready");
}

export async function enablePushNotifications() {
  const environment = getPushEnvironmentStatus();
  if (!environment.ok) return environment;

  const supported = await isSupported();
  if (!supported) return pushStatus(false, "unsupported");

  const permission = await Notification.requestPermission();
  if (permission === "denied") return pushStatus(false, "denied");
  if (permission !== "granted") return pushStatus(false, "permission-dismissed");

  let registration;
  try {
    registration = await navigator.serviceWorker.register(FCM_SERVICE_WORKER_URL, {
      scope: FCM_SERVICE_WORKER_SCOPE,
    });
    const worker = await waitForServiceWorkerActivation(registration);
    worker?.postMessage({ type: "FIREBASE_CONFIG", config: publicFirebaseConfig });
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
    console.error(error);
    return pushStatus(false, "no-token");
  }

  if (!token) return pushStatus(false, "no-token");

  await saveNotificationToken(token);
  return { ...pushStatus(true, "enabled"), token };
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

async function saveNotificationToken(token) {
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

function pushStatus(ok, code) {
  return {
    ok,
    code,
    message: STATUS_MESSAGES[code] || STATUS_MESSAGES["setup-failed"],
  };
}

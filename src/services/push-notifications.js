import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { publicFirebaseConfig } from "../../firebase-config.js";
import { app, db, getCurrentUser } from "./cloud-store.js";

const FCM_SERVICE_WORKER_URL = "/firebase-messaging-sw.js";
const FCM_SERVICE_WORKER_SCOPE = "/firebase-cloud-messaging-push-scope/";

let foregroundUnsubscribe = null;

export function getPushEnvironmentStatus() {
  if (typeof window === "undefined") return { ok: false, code: "unsupported", message: "Este navegador nao suporta notificacoes." };
  if (!("Notification" in window)) return { ok: false, code: "unsupported", message: "Este navegador nao suporta notificacoes." };
  if (!("serviceWorker" in navigator)) return { ok: false, code: "unsupported", message: "Este navegador nao suporta service workers." };
  if (Notification.permission === "denied") return { ok: false, code: "denied", message: "Permissao de notificacoes negada no navegador." };
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return { ok: false, code: "missing-vapid", message: "Chave publica VAPID ausente." };
  if (!getCurrentUser()) return { ok: false, code: "signed-out", message: "Entre com Google para ativar notificacoes." };
  return { ok: true, code: Notification.permission, message: Notification.permission === "granted" ? "Notificacoes ativadas." : "Pronto para ativar notificacoes." };
}

export async function enablePushNotifications() {
  const environment = getPushEnvironmentStatus();
  if (!environment.ok) return environment;

  const supported = await isSupported();
  if (!supported) return { ok: false, code: "unsupported", message: "Firebase Messaging nao e suportado neste navegador." };

  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, code: "denied", message: "Permissao de notificacoes negada no navegador." };
  if (permission !== "granted") return { ok: false, code: permission, message: "Permissao de notificacoes nao foi concedida." };

  const registration = await navigator.serviceWorker.register(FCM_SERVICE_WORKER_URL, {
    scope: FCM_SERVICE_WORKER_SCOPE,
  });
  const worker = await waitForServiceWorkerActivation(registration);
  worker?.postMessage({ type: "FIREBASE_CONFIG", config: publicFirebaseConfig });

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) return { ok: false, code: "no-token", message: "Nao foi possivel gerar o token de notificacoes." };

  await saveNotificationToken(token);
  return { ok: true, code: "enabled", message: "Notificacoes ativadas.", token };
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

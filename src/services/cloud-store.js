import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firebaseConfig } from "../../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let unsubscribeState = null;

export function watchSession({ onUser, onState, onError }) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    onUser(user);

    if (unsubscribeState) {
      unsubscribeState();
      unsubscribeState = null;
    }

    if (!user) return;

    unsubscribeState = onSnapshot(
      userStateDoc(user.uid),
      (snapshot) => onState(snapshot.exists() ? snapshot.data().state : null),
      onError,
    );
  });
}

export function getCurrentUser() {
  return currentUser;
}

export async function signIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function saveUserState(state) {
  if (!currentUser) return;
  await setDoc(userStateDoc(currentUser.uid), {
    state,
    updatedAt: serverTimestamp(),
  });
}

function userStateDoc(uid) {
  return doc(db, "users", uid, "state", stateDocumentId());
}

function stateDocumentId() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ? "current-dev" : "current";
}

getRedirectResult(auth).catch((error) => {
  console.error(error);
});

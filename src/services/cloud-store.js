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
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseConfig } from "../../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const provider = new GoogleAuthProvider();

export { app, db };

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

export function watchApprovedGlobalFoods({ onFoods, onError }) {
  return onSnapshot(
    query(collection(db, "globalFoods"), where("status", "==", "approved")),
    (snapshot) => onFoods(snapshot.docs.map((foodDoc) => globalFoodToStockItem({ id: foodDoc.id, ...foodDoc.data() }))),
    onError,
  );
}

export async function resolveImportedIngredientNutrition(input) {
  const callable = httpsCallable(functions, "resolveIngredientNutrition");
  const result = await callable(input);
  return result.data || {};
}

function userStateDoc(uid) {
  return doc(db, "users", uid, "state", stateDocumentId());
}

function stateDocumentId() {
  return "current";
}

function globalFoodToStockItem(food) {
  return {
    id: food.id,
    globalFoodId: food.id,
    name: food.name || food.names?.pt || food.id,
    unit: food.unit || "g",
    names: food.names || { pt: food.name || food.id },
    aliasesByLanguage: food.aliasesByLanguage || {},
    nutrition: perUnitNutrition(food.nutrition),
    nutritionSource: food.nutritionSource || "global_food",
    nutritionStatus: "approved",
    needsReview: false,
  };
}

function perUnitNutrition(nutrition) {
  return {
    kcal: Number(nutrition?.kcal || 0) / 100,
    protein: Number(nutrition?.protein || 0) / 100,
    carbs: Number(nutrition?.carbs || 0) / 100,
    fat: Number(nutrition?.fat || 0) / 100,
  };
}

getRedirectResult(auth).catch((error) => {
  console.error(error);
});

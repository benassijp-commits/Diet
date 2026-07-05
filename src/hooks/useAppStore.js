import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getCurrentUser, saveUserState, signIn, signOut, watchSession } from "../services/cloud-store.js";
import { loadStoredState, migrateState, persistState, reducer } from "../state/app-state.js";

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, loadStoredState);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Local: salvo neste navegador.");
  const hasRemoteSnapshot = useRef(false);
  const applyingRemote = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("light-mode", state.theme === "light");
    document.documentElement.style.colorScheme = state.theme === "light" ? "light" : "dark";
  }, [state.theme]);

  useEffect(() => {
    persistState(state);
    if (!getCurrentUser() || applyingRemote.current || !hasRemoteSnapshot.current) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveUserState(state);
        setSyncStatus("Sincronizado com Firestore.");
      } catch (error) {
        console.error(error);
        setSyncStatus("Falha ao sincronizar. Dados locais preservados.");
      }
    }, 450);

    return () => clearTimeout(saveTimer.current);
  }, [state]);

  useEffect(() => {
    return watchSession({
      onUser(nextUser) {
        hasRemoteSnapshot.current = false;
        setUser(nextUser);
        setSyncStatus(nextUser ? "Conectado. Carregando Firestore..." : "Local: salvo neste navegador.");
      },
      async onState(remoteState) {
        hasRemoteSnapshot.current = true;
        if (!getCurrentUser()) return;
        if (remoteState) {
          applyingRemote.current = true;
          dispatch({ type: "replace", state: migrateState(remoteState) });
          queueMicrotask(() => {
            applyingRemote.current = false;
          });
          setSyncStatus("Sincronizado com Firestore.");
          return;
        }
        await saveUserState(state);
        setSyncStatus("Primeiro backup criado no Firestore.");
      },
      onError(error) {
        console.error(error);
        hasRemoteSnapshot.current = false;
        setSyncStatus("Erro no Firestore. Confira regras e Auth.");
      },
    });
  }, []);

  const auth = useMemo(() => ({
    user,
    signIn,
    signOut,
    syncStatus,
  }), [user, syncStatus]);

  return { state, dispatch, auth };
}

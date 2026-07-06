import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getCurrentUser, saveUserState, signIn, signOut, watchSession } from "../services/cloud-store.js";
import { loadStoredState, migrateState, persistState, reducer } from "../state/app-state.js";

export function useAppStore() {
  const [state, baseDispatch] = useReducer(reducer, undefined, loadStoredState);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Local: salvo neste navegador.");
  const hasRemoteSnapshot = useRef(false);
  const applyingRemote = useRef(false);
  const skipNextRemoteStateSave = useRef(false);
  const latestState = useRef(state);
  const hasPendingLocalChange = useRef(false);
  const lastLocalChangeAt = useRef(0);
  const lastRemoteSaveStartedAt = useRef(0);
  const lastRemoteSaveCompletedAt = useRef(0);
  const saveTimer = useRef(null);
  const LOCAL_CHANGE_GRACE_MS = 1200;

  const dispatch = (action) => {
    if (!applyingRemote.current) {
      hasPendingLocalChange.current = true;
      lastLocalChangeAt.current = Date.now();
    }
    baseDispatch(action);
  };

  const preserveLocalUiState = (remoteState) => ({
    ...remoteState,
    collapsedMeals: latestState.current.collapsedMeals || {},
    cartCollapsed: Boolean(latestState.current.cartCollapsed),
  });

  const hasRecentLocalChange = () => Date.now() - lastLocalChangeAt.current < LOCAL_CHANGE_GRACE_MS;

  const saveLatestStateToRemote = async (statusMessage) => {
    const saveStartedAt = Date.now();
    lastRemoteSaveStartedAt.current = saveStartedAt;
    try {
      await saveUserState(latestState.current);
      lastRemoteSaveCompletedAt.current = Date.now();
      if (lastLocalChangeAt.current <= saveStartedAt) hasPendingLocalChange.current = false;
      setSyncStatus(statusMessage);
    } catch (error) {
      console.error(error);
      setSyncStatus("Falha ao sincronizar. Dados locais preservados.");
    }
  };

  const scheduleRemoteSave = () => {
    if (!getCurrentUser() || applyingRemote.current || !hasRemoteSnapshot.current) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveLatestStateToRemote("Sincronizado com Firestore.");
    }, 450);
  };

  useEffect(() => {
    latestState.current = state;
    document.body.classList.toggle("light-mode", state.theme === "light");
    document.documentElement.style.colorScheme = state.theme === "light" ? "light" : "dark";
  }, [state.theme]);

  useEffect(() => {
    latestState.current = state;
    persistState(state);
    if (skipNextRemoteStateSave.current) {
      skipNextRemoteStateSave.current = false;
      return;
    }
    scheduleRemoteSave();

    return () => clearTimeout(saveTimer.current);
  }, [state]);

  useEffect(() => {
    return watchSession({
      onUser(nextUser) {
        hasRemoteSnapshot.current = false;
        hasPendingLocalChange.current = false;
        lastLocalChangeAt.current = 0;
        lastRemoteSaveStartedAt.current = 0;
        lastRemoteSaveCompletedAt.current = 0;
        setUser(nextUser);
        setSyncStatus(nextUser ? "Conectado. Carregando Firestore..." : "Local: salvo neste navegador.");
      },
      async onState(remoteState) {
        hasRemoteSnapshot.current = true;
        if (!getCurrentUser()) return;
        if (remoteState) {
          if (hasPendingLocalChange.current || hasRecentLocalChange()) {
            scheduleRemoteSave();
            setSyncStatus("Alteracoes locais preservadas. Sincronizando Firestore...");
            return;
          }
          applyingRemote.current = true;
          skipNextRemoteStateSave.current = true;
          baseDispatch({ type: "replace", state: preserveLocalUiState(migrateState(remoteState)) });
          setTimeout(() => {
            applyingRemote.current = false;
          }, 0);
          setSyncStatus("Sincronizado com Firestore.");
          return;
        }
        await saveLatestStateToRemote("Primeiro backup criado no Firestore.");
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

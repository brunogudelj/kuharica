import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppData } from "./model";
import { defaultData } from "./model";
import type { Storage } from "../storage/storage";
import type { SyncConfig } from "../storage/gistSync";
import { SyncError, connect, decide, loadSyncConfig, pull, push, saveSyncConfig, toRemote } from "../storage/gistSync";

interface ToastState {
  msg: string;
  undo: AppData | null;
  key: number;
}

export interface SyncStatus {
  state: "off" | "syncing" | "ok" | "error";
  at?: number;
  msg?: string;
}

interface Ctx {
  data: AppData;
  loaded: boolean;
  saveError: boolean;
  /** Promjena koja dobije toast s Poništi (vraća prethodno stanje) */
  apply: (next: AppData, msg: string) => void;
  /** Tiha promjena (stepper, cijena, odabir) */
  update: (fn: (d: AppData) => AppData) => void;
  toast: ToastState | null;
  notify: (msg: string) => void;
  undo: () => void;
  closeToast: () => void;
  sync: SyncStatus;
  syncConfigured: boolean;
  connectSync: (token: string) => Promise<void>;
  disconnectSync: () => void;
  syncNow: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

/** Promjena podataka (bez postavki prikaza) dobiva novo vrijeme, za sinkronizaciju */
function stamp(prev: AppData, next: AppData): AppData {
  if (next === prev) return prev;
  if (next.updatedAt !== prev.updatedAt) return next;
  return toRemote(next) === toRemote(prev) ? next : { ...next, updatedAt: Math.max(Date.now(), prev.updatedAt + 1) };
}

export function AppProvider({ storage, children }: { storage: Storage; children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cfg, setCfg] = useState<SyncConfig | null>(loadSyncConfig);
  const [sync, setSync] = useState<SyncStatus>({ state: cfg ? "syncing" : "off" });
  const timer = useRef<number | undefined>(undefined);
  const dataRef = useRef(data);
  /** updatedAt zadnjeg stanja koje je isto lokalno i na GitHubu */
  const syncedAt = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let alive = true;
    storage
      .load()
      .then((d) => {
        if (alive && d) {
          dataRef.current = d;
          setData(d);
        }
      })
      .catch(() => setSaveError(true))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [storage]);

  // Spremanje na uređaj s odgodom od 500 ms
  useEffect(() => {
    if (!loaded) return;
    const h = window.setTimeout(() => {
      storage
        .save(data)
        .then(() => setSaveError(false))
        .catch(() => setSaveError(true));
    }, 500);
    return () => window.clearTimeout(h);
  }, [data, loaded, storage]);

  const fail = useCallback((e: unknown) => {
    setSync({
      state: "error",
      msg: e instanceof SyncError ? e.message : "Sinkronizacija nije uspjela. Pokušaj ponovno.",
    });
  }, []);

  /** Povuci s GitHuba i spoji: novije pobjeđuje, postavke prikaza ostaju lokalne */
  const pullMerge = useCallback(
    async (c: SyncConfig) => {
      if (busy.current) return;
      busy.current = true;
      setSync((s) => ({ ...s, state: "syncing" }));
      try {
        const remote = await pull(c);
        const local = dataRef.current;
        const dir = decide(local, remote);
        if (dir === "pull" && remote) {
          const merged = { ...remote, ui: local.ui };
          dataRef.current = merged;
          setData(merged);
          syncedAt.current = remote.updatedAt;
        } else if (dir === "push") {
          await push(c, local);
          syncedAt.current = local.updatedAt;
        } else {
          syncedAt.current = local.updatedAt;
        }
        setSync({ state: "ok", at: Date.now() });
      } catch (e) {
        fail(e);
      } finally {
        busy.current = false;
      }
    },
    [fail],
  );

  // Pri pokretanju i svaki put kad se aplikacija vrati u prvi plan
  useEffect(() => {
    if (!loaded || !cfg) return;
    pullMerge(cfg);
    const onVis = () => {
      if (document.visibilityState === "visible") pullMerge(cfg);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [loaded, cfg, pullMerge]);

  // Slanje promjena na GitHub 2 s nakon zadnje promjene
  useEffect(() => {
    if (!loaded || !cfg || data.updatedAt <= syncedAt.current) return;
    const h = window.setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      setSync((s) => ({ ...s, state: "syncing" }));
      const snap = dataRef.current;
      try {
        await push(cfg, snap);
        syncedAt.current = snap.updatedAt;
        setSync({ state: "ok", at: Date.now() });
      } catch (e) {
        fail(e);
      } finally {
        busy.current = false;
      }
    }, 2000);
    return () => window.clearTimeout(h);
  }, [data, loaded, cfg, fail]);

  const show = useCallback((t: Omit<ToastState, "key">) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const apply = useCallback(
    (next: AppData, msg: string) => {
      const prev = dataRef.current;
      const n = stamp(prev, { ...next, updatedAt: prev.updatedAt });
      show({ msg, undo: prev });
      dataRef.current = n;
      setData(n);
    },
    [show],
  );
  const update = useCallback((fn: (d: AppData) => AppData) => {
    const prev = dataRef.current;
    const n = stamp(prev, fn(prev));
    dataRef.current = n;
    setData(n);
  }, []);
  const notify = useCallback((msg: string) => show({ msg, undo: null }), [show]);
  const undo = useCallback(() => {
    if (!toast?.undo) return;
    // poništavanje je nova promjena, da se pošalje i na druge uređaje
    const n = { ...toast.undo, ui: dataRef.current.ui, updatedAt: Math.max(Date.now(), dataRef.current.updatedAt + 1) };
    dataRef.current = n;
    setData(n);
    show({ msg: "Poništeno.", undo: null });
  }, [toast, show]);
  const closeToast = useCallback(() => setToast(null), []);

  const connectSync = useCallback(
    async (token: string) => {
      setSync({ state: "syncing" });
      try {
        const { gistId, remote } = await connect(token.trim(), dataRef.current);
        const c = { token: token.trim(), gistId };
        if (remote && remote.updatedAt > 0) {
          // Drugi uređaj: podaci s GitHuba zamjenjuju prazne lokalne
          const local = dataRef.current;
          if (decide(local, remote) === "pull" || local.updatedAt === 0) {
            const merged = { ...remote, ui: local.ui };
            dataRef.current = merged;
            setData(merged);
          }
          // ako je lokalno novije, efekt slanja ga pošalje
          syncedAt.current = remote.updatedAt;
        } else {
          syncedAt.current = dataRef.current.updatedAt;
        }
        saveSyncConfig(c);
        setCfg(c);
        setSync({ state: "ok", at: Date.now() });
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    [fail],
  );
  const disconnectSync = useCallback(() => {
    saveSyncConfig(null);
    setCfg(null);
    setSync({ state: "off" });
  }, []);
  const syncNow = useCallback(() => {
    if (cfg) pullMerge(cfg);
  }, [cfg, pullMerge]);

  return (
    <AppCtx.Provider
      value={{
        data,
        loaded,
        saveError,
        apply,
        update,
        toast,
        notify,
        undo,
        closeToast,
        sync,
        syncConfigured: !!cfg,
        connectSync,
        disconnectSync,
        syncNow,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp mora biti unutar AppProvider");
  return c;
}

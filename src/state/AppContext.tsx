import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppData } from "./model";
import { defaultData } from "./model";
import type { Storage } from "../storage/storage";

interface ToastState {
  msg: string;
  undo: AppData | null;
  key: number;
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
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ storage, children }: { storage: Storage; children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let alive = true;
    storage
      .load()
      .then((d) => {
        if (alive && d) setData(d);
      })
      .catch(() => setSaveError(true))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [storage]);

  // Spremanje s odgodom od 500 ms
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

  const show = useCallback((t: Omit<ToastState, "key">) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const apply = useCallback(
    (next: AppData, msg: string) => {
      show({ msg, undo: dataRef.current });
      dataRef.current = next;
      setData(next);
    },
    [show],
  );
  const update = useCallback((fn: (d: AppData) => AppData) => setData((prev) => fn(prev)), []);
  const notify = useCallback((msg: string) => show({ msg, undo: null }), [show]);
  const undo = useCallback(() => {
    if (!toast?.undo) return;
    setData(toast.undo);
    show({ msg: "Poništeno.", undo: null });
  }, [toast, show]);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <AppCtx.Provider value={{ data, loaded, saveError, apply, update, toast, notify, undo, closeToast }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp mora biti unutar AppProvider");
  return c;
}

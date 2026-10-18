/* Bočni panel (na mobitelu preko cijelog ekrana) za recept, omlet, odabir recepta za dan i obrasce */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { OmSel } from "../data";
import { Icon } from "./icons";

export type View =
  | { t: "meal"; id: string; day?: string }
  | { t: "om"; sel?: OmSel; day?: string; n?: string }
  | { t: "prep"; id: string }
  | { t: "newRecipe"; day?: string }
  | { t: "editRecipe"; id: string }
  | { t: "importRecipe" }
  | { t: "newPrep" }
  | { t: "editPrep"; id: string };

interface PanelCtx {
  view: View | null;
  open: (v: View) => void;
  close: () => void;
}

const Ctx = createContext<PanelCtx | null>(null);

export function PanelProvider({ children, render }: { children: ReactNode; render: (v: View) => ReactNode }) {
  const [view, setView] = useState<View | null>(null);
  const back = useRef<HTMLElement | null>(null);
  const open = useCallback((v: View) => {
    if (!back.current) back.current = document.activeElement as HTMLElement | null;
    setView(v);
  }, []);
  const close = useCallback(() => {
    setView(null);
    back.current?.focus?.();
    back.current = null;
  }, []);
  return (
    <Ctx.Provider value={{ view, open, close }}>
      {children}
      {view && <Sheet onClose={close}>{render(view)}</Sheet>}
    </Ctx.Provider>
  );
}

export function usePanel() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanel mora biti unutar PanelProvider");
  return c;
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    document.body.classList.add("noscroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("noscroll");
    };
  }, [onClose]);
  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        <button type="button" className="iconbtn sheet-close" aria-label="Zatvori" onClick={onClose}>
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
  );
}

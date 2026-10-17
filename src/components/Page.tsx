import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export type Chip = [label: string, remove: () => void];

/** Naredba svim skupinama filtera: otvori ili zatvori (n raste pri svakom kliku) */
const FoldCtx = createContext<{ open: boolean; n: number }>({ open: true, n: 0 });

/**
 * Raspored svakog ekrana: filteri lijevo, rezultati desno (na mobitelu filteri izlaze s lijeva).
 * Naslov, broj rezultata i akcije su u zaglavlju rezultata.
 */
export function Page({
  id,
  title,
  count,
  filters,
  filterTitle = "Filteri",
  active = 0,
  onClear,
  actions,
  tabs,
  chips,
  children,
}: {
  id: string;
  title: string;
  count?: ReactNode;
  filters?: ReactNode;
  filterTitle?: string;
  active?: number;
  onClear?: () => void;
  actions?: ReactNode;
  tabs?: ReactNode;
  chips?: Chip[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [fold, setFold] = useState({ open: true, n: 0 });
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <section className={"page" + (filters ? "" : " nofilters") + (open ? " fopen" : "")} id={id} aria-labelledby={`${id}-h`}>
      {filters && (
        <>
          <aside className="fpanel" aria-label={filterTitle}>
            <div className="fhead">
              <span className="ftitle">
                <Icon name="filter" size={18} />
                {filterTitle}
                {active > 0 && <span className="badge">{active}</span>}
              </span>
              {active > 0 && onClear && (
                <button type="button" className="linkbtn" onClick={onClear}>
                  Očisti
                </button>
              )}
              <button
                type="button"
                className="linkbtn quiet"
                onClick={() => setFold((f) => ({ open: !f.open, n: f.n + 1 }))}
                title={fold.open ? "Zatvori sve skupine filtera (odabir ostaje)" : "Otvori sve skupine filtera"}
              >
                {fold.open ? "Zatvori sve" : "Otvori sve"}
              </button>
              <button type="button" className="iconbtn fclose" aria-label="Zatvori filtere" onClick={() => setOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="fbody">
              <FoldCtx.Provider value={fold}>{filters}</FoldCtx.Provider>
            </div>
            <div className="ffoot">
              <button type="button" className="btn wide" onClick={() => setOpen(false)}>
                Prikaži rezultate
              </button>
            </div>
          </aside>
          <div className="fscrim" aria-hidden="true" onClick={() => setOpen(false)} />
        </>
      )}

      <div className="results">
        <header className="rhead">
          <div className="rtitle">
            <h1 id={`${id}-h`}>{title}</h1>
            {count != null && <span className="rcount">{count}</span>}
          </div>
          <div className="ractions">
            {filters && (
              <button type="button" className="btn ghost fbtn" aria-expanded={open} onClick={() => setOpen(true)}>
                <Icon name="filter" size={18} />
                {filterTitle}
                {active > 0 && <span className="badge">{active}</span>}
              </button>
            )}
            {actions}
          </div>
        </header>
        {tabs && <div className="rtabs">{tabs}</div>}
        {chips && chips.length > 0 && (
          <div className="chipbar">
            {chips.map(([l, rm]) => (
              <button key={l} type="button" className="chip removable" onClick={rm} aria-label={`Makni filter: ${l}`}>
                {l} <Icon name="close" size={12} />
              </button>
            ))}
            {onClear && (
              <button type="button" className="linkbtn" onClick={onClear}>
                Očisti sve
              </button>
            )}
          </div>
        )}
        <div className="rbody-wrap">{children}</div>
      </div>
    </section>
  );
}

/** Skupina filtera (sklopiva) */
export function FGroup({ title, children, open = true, count }: { title: string; children: ReactNode; open?: boolean; count?: number }) {
  const fold = useContext(FoldCtx);
  const [isOpen, setOpen] = useState(open);
  const [seen, setSeen] = useState(fold.n);
  if (seen !== fold.n) {
    setSeen(fold.n);
    setOpen(fold.open);
  }
  return (
    <details
      className="fgroup"
      open={isOpen}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        if (o !== isOpen) setOpen(o);
      }}
    >
      <summary>
        <span>{title}</span>
        {count ? <span className="badge">{count}</span> : null}
        <Icon name="chev" size={16} />
      </summary>
      <div className="fgbody">{children}</div>
    </details>
  );
}

/** Kvačica (ili radio) s brojem rezultata */
export function FCheck({
  on,
  label,
  count,
  onChange,
  radio,
  dot,
}: {
  on: boolean;
  label: ReactNode;
  count?: number;
  onChange: () => void;
  radio?: boolean;
  /** CSS klasa obojene točkice */
  dot?: string;
}) {
  return (
    <label className={"checkrow" + (count === 0 && !on ? " dim" : "")}>
      <input type={radio ? "radio" : "checkbox"} checked={on} onChange={onChange} />
      {dot && <i className={"fdot " + dot} aria-hidden="true" />}
      <span>{label}</span>
      {count != null && <small>{count}</small>}
    </label>
  );
}

/** Tražilica u panelu filtera */
export function FSearch({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id?: string;
}) {
  return (
    <div className="searchbox">
      <Icon name="search" size={18} />
      <input id={id} type="search" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

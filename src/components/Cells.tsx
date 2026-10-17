import { useState } from "react";
import { round } from "../logic/format";

const parse = (s: string) => parseFloat(s.replace(",", "."));
const show = (v: number | null | undefined) => (v == null ? "" : String(round(v)).replace(".", ","));

/** Brojčana ćelija tablice: uređuje se na mjestu, sprema na Enter ili izlaz iz polja, Esc odustaje */
export function NumCell({
  value,
  onCommit,
  placeholder,
  label,
  allowEmpty,
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  label: string;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const t = draft.trim();
    if (t === "") {
      if (allowEmpty) onCommit(null);
    } else {
      const v = parse(t);
      if (!isNaN(v) && v >= 0 && v !== value) onCommit(v);
    }
    setDraft(null);
  };
  return (
    <input
      className="cellin num"
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? show(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(null);
          setTimeout(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

/** Tekstualna ćelija */
export function TextCell({ value, onCommit, label }: { value: string; onCommit: (v: string) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="cellin"
      type="text"
      aria-label={label}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null && draft.trim() && draft.trim() !== value) onCommit(draft.trim());
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(null);
          setTimeout(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

/** Ćelija s odabirom */
export function SelectCell<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select className="cellsel" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([k, t]) => (
        <option key={k} value={k}>
          {t}
        </option>
      ))}
    </select>
  );
}

/** Naslov kolone koji sortira */
export function SortTh<K extends string>({
  k,
  sort,
  setSort,
  children,
  className,
}: {
  k: K;
  sort: { k: K; dir: 1 | -1 };
  setSort: (s: { k: K; dir: 1 | -1 }) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const on = sort.k === k;
  return (
    <th className={className} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort({ k, dir: on ? ((-sort.dir) as 1 | -1) : 1 })}>
        {children}
        <span aria-hidden="true">{on ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}

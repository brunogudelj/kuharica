import type { ReactNode } from "react";
import type { Status } from "../logic/inventory";

/** HTML iz podataka (sastojci s <span class=g>). Podaci su statični i dolaze iz src/data. */
export const Html = ({ html, as: Tag = "span" }: { html: string; as?: "span" | "li" | "div" }) => (
  <Tag dangerouslySetInnerHTML={{ __html: html }} />
);

export function Stepper({
  value,
  onDec,
  onInc,
  label,
  inline,
}: {
  value?: ReactNode;
  onDec: () => void;
  onInc: () => void;
  label: string;
  inline?: boolean;
}) {
  return (
    <div className={"stepper" + (inline ? " inline" : "")}>
      <button type="button" onClick={onDec} aria-label={`Manje: ${label}`}>
        −
      </button>
      {value != null && <span className="qty">{value}</span>}
      <button type="button" onClick={onInc} aria-label={`Više: ${label}`}>
        +
      </button>
    </div>
  );
}

export function StatusPill({ s }: { s: Status }) {
  if (s === "ok") return <span className="pill p-ok">ok</span>;
  if (s === "low") return <span className="pill p-low">nisko</span>;
  if (s === "out") return <span className="pill p-out">nema</span>;
  return null;
}

export function SrcTag({ s }: { s: string }) {
  if (s === "AZ") return <span className="src a">AZ</span>;
  if (s === "BIO") return <span className="src b">BIO</span>;
  return <span className="src">K</span>;
}

export function Filters<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: [T, ReactNode][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="filters" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Kartica recepta koja se otvara (details) */
export function Card({
  title,
  meta,
  children,
  id,
}: {
  title: ReactNode;
  meta: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <details className="rec" id={id}>
      <summary>
        <div className="rtitle">
          <h3>{title}</h3>
          <div className="meta">{meta}</div>
        </div>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="rbody">{children}</div>
    </details>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <div className="note">{children}</div>;

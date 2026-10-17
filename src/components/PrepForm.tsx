/* Obrazac za vlastiti prep: sastojci za jednu turu i koliko jedinica tura daje */
import { useState } from "react";
import type { FormEvent } from "react";
import { PREP_K, UNITS } from "../data";
import type { CustomPrep, PrepCat, UnitId } from "../data";
import { useApp } from "../state/AppContext";
import { allItems, itemOf } from "../logic/items";
import { catOpts } from "../logic/lists";
import { newPrepId, saveCustomPrep } from "../logic/preps";
import { round } from "../logic/format";
import { ItemForm } from "./ItemForm";

interface Row {
  key: number;
  id: string;
  amt: string;
}
const parse = (s: string) => parseFloat(s.replace(",", "."));
const show = (n: number) => String(round(n)).replace(".", ",");
const lines = (t: string) =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function PrepForm({
  existing,
  draft,
  onDone,
}: {
  existing?: CustomPrep;
  /** nacrt (npr. iz uvoza recepta): sprema se kao novi prep */
  draft?: CustomPrep;
  onDone: (id?: string) => void;
}) {
  const { data, apply } = useApp();
  const init = existing ?? draft;
  const [n, setN] = useState(init?.n ?? "");
  const [k, setK] = useState<PrepCat>(init?.k ?? "Umaci");
  const [time, setTime] = useState(init?.time ?? "");
  const [keep, setKeep] = useState(init?.keep ?? "Hladnjak 1 tjedan");
  const [make, setMake] = useState(show(init?.make ?? 1));
  const [unit, setUnit] = useState<UnitId>(init?.unit ?? "porcija");
  const [rows, setRows] = useState<Row[]>(() =>
    init && Object.keys(init.use).length
      ? Object.entries(init.use).map(([id, a], i) => ({ key: i, id, amt: show(a) }))
      : [{ key: 0, id: "", amt: "" }],
  );
  const [extra, setExtra] = useState(init?.extra.join("\n") ?? "");
  const [steps, setSteps] = useState(init?.st.join("\n") ?? "");
  const [err, setErr] = useState("");
  const [newFor, setNewFor] = useState<number | null>(null);
  const items = allItems(data)
    .filter((i) => !data.items.hidden.includes(i.id) || rows.some((r) => r.id === i.id))
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const setRow = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const nextKey = () => Math.max(0, ...rows.map((r) => r.key)) + 1;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!n.trim()) return setErr("Upiši naziv prepa.");
    const m = parse(make);
    if (!(m > 0)) return setErr("Upiši koliko jedinica daje jedna tura.");
    const use: Record<string, number> = {};
    for (const r of rows) {
      if (!r.id) continue;
      const a = parse(r.amt);
      if (!(a > 0)) return setErr(`Upiši količinu za ${itemOf(data, r.id)?.n ?? "namirnicu"}.`);
      use[r.id] = (use[r.id] || 0) + a;
    }
    const p: CustomPrep = {
      id: existing?.id ?? draft?.id ?? newPrepId(n),
      n: n.trim(),
      k,
      time: time.trim(),
      keep: keep.trim(),
      make: m,
      unit,
      use,
      extra: lines(extra),
      st: lines(steps),
    };
    const r = saveCustomPrep(data, p);
    apply(r.data, r.msg);
    onDone(p.id);
  };

  return (
    <>
      <form className="confirm" onSubmit={submit} aria-label={existing ? "Uredi prep" : "Novi prep"}>
        <div className="edit">
          <label>
            Naziv
            <input value={n} onChange={(e) => setN(e.target.value)} placeholder="npr. Teriyaki umak" />
          </label>
          <label>
            Vrsta
            <select value={k} onChange={(e) => setK(e.target.value as PrepCat)}>
              {(Object.entries(PREP_K) as [PrepCat, string][]).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jedna tura daje
            <span className="amtrow">
              <input
                inputMode="decimal"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                aria-label="Koliko jedinica"
              />
              <select value={unit} onChange={(e) => setUnit(e.target.value as UnitId)} aria-label="Jedinica">
                {(Object.entries(UNITS) as [UnitId, [string, string, string]][]).map(([v, f]) => (
                  <option key={v} value={v}>
                    {f[2]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label>
            Vrijeme
            <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="npr. 10 min" />
          </label>
          <label>
            Čuvanje
            <input value={keep} onChange={(e) => setKeep(e.target.value)} placeholder="npr. Hladnjak 2 tjedna" />
          </label>
        </div>

        <h4 className="omh">Sastojci za jednu turu</h4>
        <div className="rfrows">
          {rows.map((r) => {
            const it = r.id ? itemOf(data, r.id) : undefined;
            return (
              <div key={r.key} className="rfrow">
                <select
                  aria-label="Namirnica"
                  value={r.id}
                  onChange={(e) =>
                    e.target.value === "__new" ? setNewFor(r.key) : setRow(r.key, { id: e.target.value })
                  }
                >
                  <option value="">Odaberi namirnicu…</option>
                  <option value="__new">+ Nova namirnica</option>
                  {catOpts(data).map(([c, t]) => (
                    <optgroup key={c} label={t}>
                      {items
                        .filter((i) => i.cat === c)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.n}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  aria-label="Količina"
                  inputMode="decimal"
                  placeholder="koliko"
                  value={r.amt}
                  onChange={(e) => setRow(r.key, { amt: e.target.value })}
                />
                <span className="unit">{it?.u ?? ""}</span>
                <button
                  type="button"
                  className="del"
                  aria-label="Makni namirnicu"
                  onClick={() =>
                    setRows((rs) =>
                      rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [{ key: nextKey(), id: "", amt: "" }],
                    )
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setRows((rs) => [...rs, { key: nextKey(), id: "", amt: "" }])}
          >
            + Još jedna namirnica
          </button>
        </div>
        <div className="edit one">
          <label>
            Ostalo što ne pratiš (jedno po retku)
            <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="sol, papar" />
          </label>
          <label>
            Priprema (jedan korak po retku)
            <textarea rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} />
          </label>
        </div>
        <p className="sub">
          Recepti troše prep u jedinicama (npr. 1 porcija umaka). Kad ga nemaš napravljenog, troše se njegovi sirovi
          sastojci.
        </p>
        {err && <p className="miss">{err}</p>}
        <div className="btnrow">
          <button type="submit" className="btn">
            {existing ? "Spremi" : "Dodaj prep"}
          </button>
          <button type="button" className="btn ghost" onClick={() => onDone()}>
            Odustani
          </button>
        </div>
      </form>
      {newFor != null && (
        <ItemForm
          onDone={(i) => {
            if (i) setRow(newFor, { id: i.id });
            setNewFor(null);
          }}
        />
      )}
    </>
  );
}

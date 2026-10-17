import { useState } from "react";
import type { FormEvent } from "react";
import { CATS, PREP, PREP_INV, SHOPS } from "../data";
import type { CatId, Item, ShopId, Unit } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { pc, price, qty, status } from "../logic/inventory";
import { hiddenItems, isCustom, newCustomItem, visibleItems } from "../logic/items";
import { addItem, buy, editItem, removeItem, setHidden, setQty } from "../logic/actions";
import { eur, fmt, pfmt, round } from "../logic/format";
import { Filters, Note, SrcTag, StatusPill, Stepper } from "../components/ui";

type F = "sve" | "nisko" | CatId;
const UNITS: [Unit, string][] = [
  ["g", "grami (g)"],
  ["ml", "mililitri (ml)"],
  ["kom", "komadi (kom)"],
];
const parse = (s: string) => parseFloat(s.replace(",", "."));

function PrepStock({ data, update }: { data: AppData; update: (fn: (d: AppData) => AppData) => void }) {
  const have = PREP.filter((p) => pc(data, p.id) > 0);
  if (!have.length) return null;
  const step = (id: string, by: number) =>
    update((d) => {
      const n = clone(d);
      n.prepStock[id] = Math.max(0, pc(n, id) + by);
      return n;
    });
  return (
    <div className="group">
      <div className="ghead">
        <h2>Pripremljeno</h2>
        <span className="count">{have.length} vrsta</span>
      </div>
      <div className="list">
        {have.map((p) => (
          <div key={p.id} className="row">
            <div className="rtop">
              <div className="rname">
                <b>{p.n}</b>
                <small>{p.keep}</small>
              </div>
              <Stepper
                label={p.n}
                value={pfmt(pc(data, p.id), PREP_INV[p.id].unit)}
                onDec={() => step(p.id, -1)}
                onInc={() => step(p.id, 1)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Obrazac za novu namirnicu */
function AddItem({ onDone }: { onDone: () => void }) {
  const { data, apply } = useApp();
  const [n, setN] = useState("");
  const [cat, setCat] = useState<CatId>("fri");
  const [u, setU] = useState<Unit>("g");
  const [pack, setPack] = useState("");
  const [min, setMin] = useState("0");
  const [src, setSrc] = useState<ShopId>("K");
  const [have, setHave] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parse(pack);
    const m = parse(min || "0");
    const h = parse(have || "0");
    if (!n.trim()) return setErr("Upiši naziv namirnice.");
    if (visibleItems(data).some((i) => i.n.toLowerCase() === n.trim().toLowerCase()))
      return setErr("Namirnica s tim nazivom već postoji. Potraži je u popisu.");
    if (isNaN(p) || p <= 0) return setErr(`Upiši koliko je u jednom pakiranju (${u}).`);
    if (isNaN(m) || m < 0) return setErr("Minimum mora biti 0 ili više.");
    const item = newCustomItem({ n, cat, src, u, pack: p, min: m });
    const r = addItem(data, item, isNaN(h) ? 0 : h);
    apply(r.data, r.msg);
    onDone();
  };

  return (
    <form className="confirm" onSubmit={submit} aria-label="Nova namirnica">
      <b>Nova namirnica</b>
      <div className="edit">
        <label htmlFor="niName">
          Naziv
          <input
            id="niName"
            type="text"
            placeholder="npr. Pileće kobasice Gavrilović"
            value={n}
            onChange={(e) => setN(e.target.value)}
          />
        </label>
        <label htmlFor="niCat">
          Gdje stoji
          <select id="niCat" value={cat} onChange={(e) => setCat(e.target.value as CatId)}>
            {(Object.entries(CATS) as [CatId, string][]).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="niUnit">
          Mjeri se u
          <select id="niUnit" value={u} onChange={(e) => setU(e.target.value as Unit)}>
            {UNITS.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="niPack">
          Jedno pakiranje ({u})
          <input
            id="niPack"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={u === "kom" ? "npr. 10" : "npr. 400"}
            value={pack}
            onChange={(e) => setPack(e.target.value)}
          />
        </label>
        <label htmlFor="niHave">
          Trenutno imam ({u})
          <input
            id="niHave"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0"
            value={have}
            onChange={(e) => setHave(e.target.value)}
          />
        </label>
        <label htmlFor="niMin">
          Uvijek želim imati barem ({u})
          <input
            id="niMin"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label htmlFor="niSrc">
          Kupujem u
          <select id="niSrc" value={src} onChange={(e) => setSrc(e.target.value as ShopId)}>
            {(Object.entries(SHOPS) as [ShopId, string][]).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="sub">
        Minimum 0 znači da je samo pratiš, a ne dolazi na popis za kupovinu dok je ne potroši recept. Jedinicu kasnije
        ne možeš mijenjati.
      </p>
      {err && <p className="miss">{err}</p>}
      <div className="btnrow">
        <button type="submit" className="btn">
          Dodaj
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          Odustani
        </button>
      </div>
    </form>
  );
}

function NumField({
  id,
  label,
  value,
  onCommit,
  placeholder,
}: {
  id: string;
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder={placeholder}
        value={draft ?? (value == null ? "" : String(round(value)))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft != null) {
            const v = draft.trim() === "" ? null : parse(draft);
            if (v == null || (!isNaN(v) && v >= 0)) onCommit(v);
          }
          setDraft(null);
        }}
      />
    </label>
  );
}

function ItemRow({ i, open, onOpen }: { i: Item; open: boolean; onOpen: () => void }) {
  const { data, update, apply } = useApp();
  const p = price(data, i.id);
  const custom = isCustom(i.id);
  const [confirmDel, setConfirmDel] = useState(false);
  const change = (fn: (n: AppData) => AppData | void) =>
    update((d) => {
      const n = clone(d);
      return fn(n) || n;
    });

  return (
    <div className="row">
      <div className="rtop">
        <button type="button" className="rname" aria-expanded={open} onClick={onOpen}>
          <b>{i.n}</b>
          <small>
            <StatusPill s={status(data, i)} />
            <SrcTag s={i.src} />
            {i.hint}
            {p != null && ` · ${eur(p)}`}
          </small>
        </button>
        <Stepper
          label={i.n}
          value={fmt(qty(data, i.id), i.u)}
          onDec={() => change((n) => setQty(n, i.id, qty(n, i.id) - i.step))}
          onInc={() => change((n) => setQty(n, i.id, qty(n, i.id) + i.step))}
        />
      </div>
      {open && (
        <div className="itemedit">
          <div className="edit">
            <NumField
              id={`q-${i.id}`}
              label={`Imam (${i.u})`}
              value={qty(data, i.id)}
              onCommit={(v) => change((n) => setQty(n, i.id, v ?? 0))}
            />
            <NumField
              id={`pr-${i.id}`}
              label={`Cijena pakiranja (€)`}
              placeholder="npr. 3,49"
              value={p}
              onCommit={(v) =>
                change((n) => {
                  n.stock[i.id] = { qty: qty(n, i.id), price: v == null ? null : round(v) };
                })
              }
            />
            <NumField
              id={`pk-${i.id}`}
              label={`Jedno pakiranje (${i.u})`}
              value={i.pack}
              onCommit={(v) => v && v > 0 && change((n) => editItem(n, i.id, { pack: v }))}
            />
            <NumField
              id={`mn-${i.id}`}
              label={`Uvijek barem (${i.u})`}
              value={i.min}
              onCommit={(v) => change((n) => editItem(n, i.id, { min: v ?? 0 }))}
            />
            {custom && (
              <>
                <label htmlFor={`nm-${i.id}`}>
                  Naziv
                  <input
                    id={`nm-${i.id}`}
                    type="text"
                    defaultValue={i.n}
                    onBlur={(e) =>
                      e.target.value.trim() &&
                      e.target.value.trim() !== i.n &&
                      change((n) => editItem(n, i.id, { n: e.target.value.trim() }))
                    }
                  />
                </label>
                <label htmlFor={`ct-${i.id}`}>
                  Gdje stoji
                  <select
                    id={`ct-${i.id}`}
                    value={i.cat}
                    onChange={(e) => change((n) => editItem(n, i.id, { cat: e.target.value as CatId }))}
                  >
                    {(Object.entries(CATS) as [CatId, string][]).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor={`sr-${i.id}`}>
                  Kupujem u
                  <select
                    id={`sr-${i.id}`}
                    value={i.src}
                    onChange={(e) => change((n) => editItem(n, i.id, { src: e.target.value as ShopId }))}
                  >
                    {(Object.entries(SHOPS) as [ShopId, string][]).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="btnrow">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                const r = buy(data, i.id, 1);
                apply(r.data, r.msg);
              }}
            >
              Kupio +{fmt(i.pack, i.u)}
            </button>
            {custom ? (
              confirmDel ? (
                <>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => {
                      const r = removeItem(data, i.id);
                      apply(r.data, r.msg);
                    }}
                  >
                    Da, obriši
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>
                    Odustani
                  </button>
                </>
              ) : (
                <button type="button" className="btn ghost" onClick={() => setConfirmDel(true)}>
                  Obriši namirnicu
                </button>
              )
            ) : (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const r = setHidden(data, i.id, true);
                  apply(r.data, r.msg);
                }}
              >
                Ne koristim, sakrij
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ZalihaTab() {
  const { data, update, apply } = useApp();
  const [f, setF] = useState<F>("sve");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const items = visibleItems(data);
  const hidden = hiddenItems(data);
  const counts = { out: 0, low: 0, ok: 0 };
  items.forEach((i) => {
    const s = status(data, i);
    if (s === "out") counts.out++;
    else if (s === "low") counts.low++;
    else if (s === "ok") counts.ok++;
  });
  const term = q.trim().toLowerCase();

  const groups = (Object.entries(CATS) as [CatId, string][])
    .map(([k, t]) => {
      let list = items.filter((i) => i.cat === k);
      if (term) list = list.filter((i) => i.n.toLowerCase().includes(term));
      else if (f === "nisko") list = list.filter((i) => ["low", "out"].includes(status(data, i)));
      else if (f !== "sve" && f !== k) return null;
      return list.length ? { k, t, list } : null;
    })
    .filter((g) => g !== null);

  return (
    <section id="zaliha" role="tabpanel" aria-labelledby="tab-zaliha">
      <PrepStock data={data} update={update} />
      <div className="summary">
        <div>
          <b>{counts.ok}</b>
          <span>na zalihi</span>
        </div>
        <div>
          <b>{counts.low}</b>
          <span>nisko</span>
        </div>
        <div>
          <b>{counts.out}</b>
          <span>nema</span>
        </div>
      </div>

      <div className="ghead">
        <input
          id="itemSearch"
          className="search"
          type="search"
          placeholder="Traži namirnicu"
          aria-label="Traži namirnicu"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Dodaj namirnicu
          </button>
        )}
      </div>
      {adding && <AddItem onDone={() => setAdding(false)} />}

      <Note>
        Plusom i minusom mijenjaš količinu. Dodir na naziv otvara točan unos, cijenu, pakiranje i minimum, a namirnice
        koje ne koristiš možeš sakriti. <SrcTag s="K" /> Kaufland, <SrcTag s="BIO" /> Bio&amp;Bio, <SrcTag s="AZ" />{" "}
        azijski dućan, <SrcTag s="O" /> ostalo.
      </Note>
      {!term && (
        <Filters<F>
          label="Filtriraj zalihu"
          value={f}
          onChange={setF}
          options={[
            ["sve", "Sve"],
            ["nisko", "Nisko i nema"],
            ["frz", "Zamrzivač"],
            ["fri", "Hladnjak"],
            ["dry", "Smočnica"],
            ["fre", "Svježe"],
          ]}
        />
      )}
      <div className="group">
        {groups.length ? (
          groups.map((g) => (
            <div key={g.k} className="group">
              <div className="ghead">
                <h2>{g.t}</h2>
                <span className={`tag t-${g.k}`}>{g.t}</span>
              </div>
              <div className="list">
                {g.list.map((i) => (
                  <ItemRow key={i.id} i={i} open={open === i.id} onOpen={() => setOpen(open === i.id ? null : i.id)} />
                ))}
              </div>
            </div>
          ))
        ) : term ? (
          <Note>
            Nema namirnice „{q.trim()}”.{" "}
            <button type="button" className="linkbtn" onClick={() => setAdding(true)}>
              Dodaj je
            </button>
          </Note>
        ) : (
          <Note>Ništa nije nisko. Sve je na zalihi.</Note>
        )}
      </div>

      {hidden.length > 0 && (
        <details className="rec">
          <summary>
            <div className="rtitle">
              <h3>Skrivene namirnice</h3>
              <div className="meta">
                <span>{hidden.length} skriveno</span>
              </div>
            </div>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </summary>
          <div className="rbody">
            <p className="sub">
              Skrivene ne dolaze na popis za kupovinu, osim ako ih traži recept ili omlet koji si isplanirao.
            </p>
            <div className="list">
              {hidden.map((i) => (
                <div key={i.id} className="lrow">
                  <div className="ln">
                    <b>{i.n}</b>
                    <small>{CATS[i.cat]}</small>
                  </div>
                  <button
                    type="button"
                    className="cookbtn"
                    onClick={() => {
                      const r = setHidden(data, i.id, false);
                      apply(r.data, r.msg);
                    }}
                  >
                    Vrati
                  </button>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

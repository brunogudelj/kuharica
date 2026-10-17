import { useState } from "react";
import { CATS, ITEMS, PREP, PREP_INV } from "../data";
import type { CatId, Item } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { pc, price, qty, status } from "../logic/inventory";
import { buy, setQty } from "../logic/actions";
import { eur, fmt, pfmt, round } from "../logic/format";
import { Filters, Note, SrcTag, StatusPill, Stepper } from "../components/ui";

type F = "sve" | "nisko" | CatId;

function PrepStock({ data, update }: { data: AppData; update: (fn: (d: AppData) => AppData) => void }) {
  const have = PREP.filter((p) => pc(data, p.id) > 0);
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
        <span className="count">{have.length ? have.length + " vrsta" : ""}</span>
      </div>
      {have.length ? (
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
      ) : (
        <Note>
          Ništa pripremljeno. Kad u Prepu stisneš <strong>Napravio sam</strong>, vrećice i kutije pojavit će se ovdje, a
          recepti će ih trošiti umjesto sirovih sastojaka.
        </Note>
      )}
    </div>
  );
}

function ItemRow({ i, open, onOpen }: { i: Item; open: boolean; onOpen: () => void }) {
  const { data, update, apply } = useApp();
  const p = price(data, i.id);
  const [qDraft, setQDraft] = useState<string | null>(null);
  const [pDraft, setPDraft] = useState<string | null>(null);
  const change = (fn: (n: AppData) => void) =>
    update((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });
  const parse = (s: string) => parseFloat(s.replace(",", "."));

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
        <div className="edit">
          <label htmlFor={`q-${i.id}`}>
            Količina ({i.u})
            <input
              id={`q-${i.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={qDraft ?? String(round(qty(data, i.id)))}
              onChange={(e) => setQDraft(e.target.value)}
              onBlur={() => {
                if (qDraft != null && !isNaN(parse(qDraft))) change((n) => setQty(n, i.id, parse(qDraft)));
                setQDraft(null);
              }}
            />
          </label>
          <label htmlFor={`pr-${i.id}`}>
            Cijena po pakiranju ({fmt(i.pack, i.u)}) €
            <input
              id={`pr-${i.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="npr. 3,49"
              value={pDraft ?? p ?? ""}
              onChange={(e) => setPDraft(e.target.value)}
              onBlur={() => {
                if (pDraft != null) {
                  const v = pDraft.trim() === "" ? null : parse(pDraft);
                  change((n) => {
                    n.stock[i.id] = { qty: qty(n, i.id), price: v == null || isNaN(v) ? null : round(v) };
                  });
                }
                setPDraft(null);
              }}
            />
          </label>
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
        </div>
      )}
    </div>
  );
}

export function ZalihaTab() {
  const { data, update } = useApp();
  const [f, setF] = useState<F>("sve");
  const [open, setOpen] = useState<string | null>(null);
  const counts = { out: 0, low: 0, ok: 0 };
  ITEMS.forEach((i) => {
    const s = status(data, i);
    if (s === "out") counts.out++;
    else if (s === "low") counts.low++;
    else if (s === "ok") counts.ok++;
  });

  const groups = (Object.entries(CATS) as [CatId, string][])
    .map(([k, t]) => {
      let items = ITEMS.filter((i) => i.cat === k);
      if (f === "nisko") items = items.filter((i) => ["low", "out"].includes(status(data, i)));
      else if (f !== "sve" && f !== k) return null;
      return items.length ? { k, t, items } : null;
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
      <Note>
        Plusom i minusom mijenjaš količinu, a dodir na naziv otvara točan unos i cijenu po pakiranju. <SrcTag s="K" />{" "}
        Kaufland, <SrcTag s="BIO" /> Bio&amp;Bio, <SrcTag s="AZ" /> azijski dućan.
      </Note>
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
      <div className="group">
        {groups.length ? (
          groups.map((g) => (
            <div key={g.k} className="group">
              <div className="ghead">
                <h2>{g.t}</h2>
                <span className={`tag t-${g.k}`}>{g.t}</span>
              </div>
              <div className="list">
                {g.items.map((i) => (
                  <ItemRow key={i.id} i={i} open={open === i.id} onOpen={() => setOpen(open === i.id ? null : i.id)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <Note>Ništa nije nisko. Sve je na zalihi.</Note>
        )}
      </div>
    </section>
  );
}

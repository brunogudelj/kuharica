import { useState } from "react";
import { CATS, PREP, PREP_INV, SHOPS } from "../data";
import type { CatId, Item, ShopId } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { pc, price, qty, status } from "../logic/inventory";
import { hiddenItems, isCustom, visibleItems } from "../logic/items";
import { buy, editItem, removeItem, resetItems, setHidden, setQty } from "../logic/actions";
import { eur, fmt, pfmt, round } from "../logic/format";
import { Filters, Note, SrcTag, StatusPill, Stepper } from "../components/ui";
import { ItemForm, OmFields, omPatch } from "../components/ItemForm";
import type { OmRole } from "../components/ItemForm";

type F = "sve" | "nisko" | CatId;
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
  const [role, setRole] = useState<OmRole>(i.om?.role ?? "");
  const [amt, setAmt] = useState(i.om ? String(i.om.amt) : "");
  const [pre, setPre] = useState(i.om?.pre ?? "");
  const [kcal, setKcal] = useState(i.kcal != null ? String(i.kcal) : "");
  const [prot, setProt] = useState(i.prot != null ? String(i.prot) : "");
  const commitOm = () => change((n) => editItem(n, i.id, omPatch(role, amt, pre, kcal, prot)));
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
          {custom && (
            <>
              <h4 className="omh">Omlet i kalorije</h4>
              <OmFields
                idp={`om-${i.id}`}
                u={i.u}
                role={role}
                setRole={(v) => {
                  setRole(v);
                  change((n) => editItem(n, i.id, omPatch(v, amt || (i.u === "kom" ? "1" : "50"), pre, kcal, prot)));
                  if (v && !amt) setAmt(i.u === "kom" ? "1" : "50");
                }}
                amt={amt}
                setAmt={setAmt}
                pre={pre}
                setPre={setPre}
                kcal={kcal}
                setKcal={setKcal}
                prot={prot}
                setProt={setProt}
                onBlur={commitOm}
              />
            </>
          )}
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
  const [confirmReset, setConfirmReset] = useState(false);
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
      {adding && <ItemForm initialName={q.trim()} onDone={() => setAdding(false)} />}

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
          !hidden.some((i) => i.n.toLowerCase().includes(term)) && (
            <Note>
              Nema namirnice „{q.trim()}”.{" "}
              <button type="button" className="linkbtn" onClick={() => setAdding(true)}>
                Dodaj je
              </button>
            </Note>
          )
        ) : items.length === 0 ? (
          <Note>
            <strong>Zaliha je prazna.</strong> U tražilicu upiši što imaš, npr. „jaja”. Ako je to u katalogu, vratiš ga
            jednim klikom, a ako nije, dodaš novu namirnicu.
          </Note>
        ) : (
          <Note>Ništa nije nisko. Sve je na zalihi.</Note>
        )}
        {term && hidden.some((i) => i.n.toLowerCase().includes(term)) && (
          <div className="group">
            <div className="ghead">
              <h2>Iz kataloga</h2>
              <span className="count">skriveno, vrati jednim klikom</span>
            </div>
            <div className="list">
              {hidden
                .filter((i) => i.n.toLowerCase().includes(term))
                .map((i) => (
                  <div key={i.id} className="lrow">
                    <div className="ln">
                      <b>{i.n}</b>
                      <small>
                        {CATS[i.cat]} · {i.u} · pakiranje {fmt(i.pack, i.u)}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="cookbtn"
                      onClick={() => {
                        const r = setHidden(data, i.id, false);
                        apply(r.data, r.msg);
                        setOpen(i.id);
                      }}
                    >
                      Vrati
                    </button>
                  </div>
                ))}
            </div>
            <p className="sub">
              Nije to što tražiš?{" "}
              <button type="button" className="linkbtn" onClick={() => setAdding(true)}>
                Dodaj novu namirnicu „{q.trim()}”
              </button>
            </p>
          </div>
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

      <div className="group">
        <h2>Kreni od nule</h2>
        {confirmReset ? (
          <div className="confirm" role="alertdialog" aria-label="Potvrda brisanja zalihe">
            <b>Obrisati sve namirnice?</b>
            <span className="sub">
              Sakrit će se sve ugrađene namirnice, obrisat će se tvoje dodane namirnice te sve količine, cijene i
              pripremljeno. Recepti, plan, omleti i troškovi ostaju. Ugrađene namirnice uvijek možeš vratiti preko
              tražilice.
            </span>
            <div className="btnrow">
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const r = resetItems(data);
                  apply(r.data, r.msg);
                  setConfirmReset(false);
                  setQ("");
                  window.scrollTo({ top: 0 });
                }}
              >
                Da, obriši sve
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>
                Odustani
              </button>
            </div>
          </div>
        ) : (
          <div className="btnrow">
            <button type="button" className="btn ghost danger" onClick={() => setConfirmReset(true)}>
              Obriši sve namirnice
            </button>
            <span className="count">prazna zaliha, popunjavaš sam</span>
          </div>
        )}
      </div>
    </section>
  );
}

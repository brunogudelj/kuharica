import { Fragment, useState } from "react";
import { CATS, OM_FILL, PREP, PREP_INV, SHOPS } from "../data";
import type { CatId, Item, ShopId } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { pc, price, qty, status } from "../logic/inventory";
import type { Status } from "../logic/inventory";
import { hiddenItems, isCustom, visibleItems } from "../logic/items";
import { buy, editItem, removeItem, resetItems, setHidden, setQty } from "../logic/actions";
import { macDisplay } from "../logic/omlet";
import { fmt, pfmt } from "../logic/format";
import { Filters, Note, StatusPill } from "../components/ui";
import { ItemForm } from "../components/ItemForm";
import { NumCell, SelectCell, SortTh, TextCell } from "../components/Cells";
import { Icon } from "../components/icons";

type F = "sve" | "nisko" | CatId;
type SortK = "mjesto" | "n" | "src" | "qty" | "stanje" | "min" | "pack" | "price" | "kcal" | "prot";

const CAT_OPTS = Object.entries(CATS) as [CatId, string][];
const SHOP_OPTS = Object.entries(SHOPS) as [ShopId, string][];
const OM_OPTS: ["" | "prot" | "veg", string][] = [
  ["", "—"],
  ["prot", "protein"],
  ["veg", "povrće"],
];
/** Ugrađene namirnice koje se koriste u ugrađenim nadjevima za omlet */
const BUILTIN_OM = new Set(OM_FILL.flatMap((f) => Object.keys(f.use)));
const ST_ORDER: Record<Status, number> = { out: 0, low: 1, ok: 2, none: 3 };

function PrepStock({ data, update }: { data: AppData; update: (fn: (d: AppData) => AppData) => void }) {
  const have = PREP.filter((p) => pc(data, p.id) > 0);
  if (!have.length) return null;
  const set = (id: string, v: number) =>
    update((d) => {
      const n = clone(d);
      n.prepStock[id] = Math.max(0, v);
      return n;
    });
  return (
    <div className="group">
      <h2>Pripremljeno</h2>
      <div className="tablewrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky">Što</th>
              <th className="num">Imam</th>
              <th>Jedinica</th>
              <th>Čuvanje</th>
            </tr>
          </thead>
          <tbody>
            {have.map((p) => (
              <tr key={p.id}>
                <td className="sticky txt">
                  <b>{p.n}</b>
                </td>
                <td style={{ width: 90 }}>
                  <NumCell label={`Imam: ${p.n}`} value={pc(data, p.id)} onCommit={(v) => set(p.id, v ?? 0)} />
                </td>
                <td className="txt">{pfmt(pc(data, p.id), PREP_INV[p.id].unit).replace(/^[\d,.]+ /, "")}</td>
                <td className="txt">{p.keep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ i, open, onToggle }: { i: Item; open: boolean; onToggle: () => void }) {
  const { data, update, apply } = useApp();
  const st = status(data, i);
  const q = qty(data, i.id);
  const p = price(data, i.id);
  const custom = isCustom(i.id);
  const [kcal, prot] = macDisplay(data, i.id);
  const per = i.u === "kom" ? "/kom" : `/100 ${i.u}`;
  const change = (fn: (n: AppData) => AppData | void) =>
    update((d) => {
      const n = clone(d);
      return fn(n) || n;
    });
  const pct = i.min > 0 ? Math.min(100, (q / (i.min * 2)) * 100) : q > 0 ? 100 : 0;

  return (
    <>
      <tr className={`st-${st}`}>
        <td className="sticky" style={{ minWidth: 180 }}>
          <div className="namecell">
            <TextCell label="Naziv" value={i.n} onCommit={(v) => change((n) => editItem(n, i.id, { n: v }))} />
          </div>
        </td>
        <td style={{ minWidth: 112 }}>
          <SelectCell<CatId> label={`Mjesto: ${i.n}`} value={i.cat} options={CAT_OPTS} onChange={(v) => change((n) => editItem(n, i.id, { cat: v }))} />
        </td>
        <td style={{ minWidth: 118 }}>
          <SelectCell<ShopId> label={`Dućan: ${i.n}`} value={i.src} options={SHOP_OPTS} onChange={(v) => change((n) => editItem(n, i.id, { src: v }))} />
        </td>
        <td style={{ minWidth: 96 }}>
          <NumCell label={`Imam (${i.u}): ${i.n}`} value={q} onCommit={(v) => change((n) => setQty(n, i.id, v ?? 0))} />
          <div className="qtybar" aria-hidden="true">
            <i className={st} style={{ width: `${pct}%` }} />
          </div>
        </td>
        <td className="txt c">{i.u}</td>
        <td className="c" style={{ minWidth: 76 }}>
          <span className="stepper inline">
            <button type="button" aria-label={`Manje: ${i.n}`} onClick={() => change((n) => setQty(n, i.id, qty(n, i.id) - i.step))}>
              −
            </button>
            <button type="button" aria-label={`Više: ${i.n}`} onClick={() => change((n) => setQty(n, i.id, qty(n, i.id) + i.step))}>
              +
            </button>
          </span>
        </td>
        <td className="txt c">
          <StatusPill s={st} />
        </td>
        <td style={{ width: 84 }}>
          <NumCell label={`Minimum (${i.u}): ${i.n}`} value={i.min} onCommit={(v) => change((n) => editItem(n, i.id, { min: v ?? 0 }))} />
        </td>
        <td style={{ width: 92 }}>
          <NumCell label={`Pakiranje (${i.u}): ${i.n}`} value={i.pack} onCommit={(v) => v && change((n) => editItem(n, i.id, { pack: v }))} />
        </td>
        <td style={{ width: 92 }}>
          <NumCell
            label={`Cijena pakiranja (€): ${i.n}`}
            placeholder="€"
            allowEmpty
            value={p}
            onCommit={(v) =>
              change((n) => {
                n.stock[i.id] = { qty: qty(n, i.id), price: v };
              })
            }
          />
        </td>
        <td style={{ width: 84 }} title={`kcal ${per}`}>
          <NumCell label={`kcal ${per}: ${i.n}`} placeholder="–" allowEmpty value={kcal} onCommit={(v) => change((n) => editItem(n, i.id, { kcal: v ?? undefined }))} />
        </td>
        <td style={{ width: 76 }} title={`proteini g ${per}`}>
          <NumCell label={`Proteini ${per}: ${i.n}`} placeholder="–" allowEmpty value={prot} onCommit={(v) => change((n) => editItem(n, i.id, { prot: v ?? undefined }))} />
        </td>
        <td style={{ minWidth: 96 }}>
          {custom ? (
            <SelectCell
              label={`Omlet: ${i.n}`}
              value={i.om?.role ?? ""}
              options={OM_OPTS}
              onChange={(v) =>
                change((n) => editItem(n, i.id, { om: v ? { role: v, amt: i.om?.amt ?? (i.u === "kom" ? 1 : 50), ...(i.om?.pre ? { pre: i.om.pre } : {}) } : undefined }))
              }
            />
          ) : (
            <span className="txt" style={{ padding: "7px 8px", display: "block", color: "var(--muted)" }}>
              {BUILTIN_OM.has(i.id) ? "ugrađeno" : "—"}
            </span>
          )}
        </td>
        <td style={{ width: 84 }}>
          {custom && i.om ? (
            <NumCell label={`Količina u omletu (${i.u}): ${i.n}`} value={i.om.amt} onCommit={(v) => v && change((n) => editItem(n, i.id, { om: { ...i.om!, amt: v } }))} />
          ) : (
            <span className="txt" style={{ padding: "7px 8px", display: "block", color: "var(--muted)" }}>
              –
            </span>
          )}
        </td>
        <td className="c">
          <button type="button" className="rowbtn" aria-expanded={open} aria-label={`Više opcija: ${i.n}`} onClick={onToggle}>
            <Icon name="more" />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="detailrow">
          <td colSpan={15}>
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
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => {
                    const r = removeItem(data, i.id);
                    apply(r.data, r.msg);
                  }}
                >
                  Obriši namirnicu
                </button>
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
              {custom && i.om && (
                <label className="inline-label" htmlFor={`pre-${i.id}`}>
                  Priprema u omletu
                  <input
                    id={`pre-${i.id}`}
                    className="search"
                    type="text"
                    defaultValue={i.om.pre ?? ""}
                    placeholder="npr. Nareži i zapeci 3 min."
                    onBlur={(e) => change((n) => editItem(n, i.id, { om: { ...i.om!, pre: e.target.value.trim() || undefined } }))}
                  />
                </label>
              )}
            </div>
            <p className="sub">
              Kcal i proteini su {per.replace("/", "na ")}. {custom ? "" : "Prazno znači ugrađenu vrijednost. "}
              Brisanje i sakrivanje možeš poništiti odmah nakon toga.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

export function ZalihaTab() {
  const { data, update, apply } = useApp();
  const [f, setF] = useState<F>("sve");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sort, setSort] = useState<{ k: SortK; dir: 1 | -1 }>({ k: "mjesto", dir: 1 });
  const items = visibleItems(data);
  const hidden = hiddenItems(data);
  const term = q.trim().toLowerCase();
  const counts = { out: 0, low: 0, ok: 0 };
  items.forEach((i) => {
    const s = status(data, i);
    if (s === "out") counts.out++;
    else if (s === "low") counts.low++;
    else if (s === "ok") counts.ok++;
  });

  let rows = items.filter((i) => {
    if (term) return i.n.toLowerCase().includes(term);
    if (f === "nisko") return ["low", "out"].includes(status(data, i));
    if (f !== "sve") return i.cat === f;
    return true;
  });
  const val = (i: Item): number | string => {
    switch (sort.k) {
      case "n":
        return i.n.toLowerCase();
      case "src":
        return SHOPS[i.src];
      case "qty":
        return qty(data, i.id);
      case "stanje":
        return ST_ORDER[status(data, i)];
      case "min":
        return i.min;
      case "pack":
        return i.pack;
      case "price":
        return price(data, i.id) ?? -1;
      case "kcal":
        return macDisplay(data, i.id)[0] ?? -1;
      case "prot":
        return macDisplay(data, i.id)[1] ?? -1;
      default:
        return CAT_OPTS.findIndex(([k]) => k === i.cat) * 1000 + 0;
    }
  };
  rows = rows.slice().sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c = x < y ? -1 : x > y ? 1 : a.n.localeCompare(b.n, "hr");
    return c * sort.dir;
  });
  const grouped = sort.k === "mjesto";
  const hiddenMatches = term ? hidden.filter((i) => i.n.toLowerCase().includes(term)) : [];

  return (
    <section id="zaliha" aria-labelledby="tab-zaliha">
      <div className="weekstats">
        <div>
          <b>{items.length}</b>
          <span>namirnica u popisu</span>
        </div>
        <div>
          <b style={{ color: "var(--ok)" }}>{counts.ok}</b>
          <span>na zalihi</span>
        </div>
        <div>
          <b style={{ color: "var(--low)" }}>{counts.low}</b>
          <span>nisko</span>
        </div>
        <div>
          <b style={{ color: "var(--out)" }}>{counts.out}</b>
          <span>nema</span>
        </div>
      </div>

      <PrepStock data={data} update={update} />

      <div className="toolbar">
        <input id="itemSearch" className="search" type="search" placeholder="Traži namirnicu" aria-label="Traži namirnicu" value={q} onChange={(e) => setQ(e.target.value)} />
        {!adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Dodaj namirnicu
          </button>
        )}
      </div>
      {adding && <ItemForm initialName={q.trim()} onDone={() => setAdding(false)} />}
      {!term && (
        <Filters<F>
          label="Filtriraj zalihu"
          value={f}
          onChange={setF}
          options={[["sve", "Sve"], ["nisko", "Nisko i nema"], ...CAT_OPTS]}
        />
      )}

      {rows.length > 0 ? (
        <div className="tablewrap">
          <table className="grid" aria-label="Zaliha namirnica">
            <thead>
              <tr>
                <SortTh k="n" sort={sort} setSort={setSort} className="sticky">
                  Naziv
                </SortTh>
                <SortTh k="mjesto" sort={sort} setSort={setSort}>
                  Mjesto
                </SortTh>
                <SortTh k="src" sort={sort} setSort={setSort}>
                  Dućan
                </SortTh>
                <SortTh k="qty" sort={sort} setSort={setSort} className="num">
                  Imam
                </SortTh>
                <th>Jed.</th>
                <th>±</th>
                <SortTh k="stanje" sort={sort} setSort={setSort}>
                  Stanje
                </SortTh>
                <SortTh k="min" sort={sort} setSort={setSort} className="num">
                  Min.
                </SortTh>
                <SortTh k="pack" sort={sort} setSort={setSort} className="num">
                  Pakiranje
                </SortTh>
                <SortTh k="price" sort={sort} setSort={setSort} className="num">
                  €/pak.
                </SortTh>
                <SortTh k="kcal" sort={sort} setSort={setSort} className="num">
                  kcal
                </SortTh>
                <SortTh k="prot" sort={sort} setSort={setSort} className="num">
                  Prot. g
                </SortTh>
                <th>Omlet</th>
                <th className="num">U omletu</th>
                <th>
                  <span className="sr-only">Opcije</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i, k) => (
                <Fragment key={i.id}>
                  {grouped && (k === 0 || rows[k - 1].cat !== i.cat) && (
                    <tr className="grouprow">
                      <td className="sticky">{CATS[i.cat]}</td>
                      <td colSpan={14} />
                    </tr>
                  )}
                  <Row i={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} />
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="tblfoot">
            <span>
              {rows.length} od {items.length} namirnica
            </span>
            <span>Klikni ćeliju i piši. Enter sprema, Esc odustaje. Klik na naslov kolone sortira.</span>
          </div>
        </div>
      ) : term ? (
        !hiddenMatches.length && (
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

      {hiddenMatches.length > 0 && (
        <div className="group">
          <div className="ghead">
            <h2>Iz kataloga</h2>
            <span className="count">skriveno, vrati jednim klikom</span>
          </div>
          <div className="tablewrap">
            <table className="grid">
              <tbody>
                {hiddenMatches.map((i) => (
                  <tr key={i.id}>
                    <td className="sticky txt">
                      <b>{i.n}</b>
                    </td>
                    <td className="txt">{CATS[i.cat]}</td>
                    <td className="txt">
                      {i.u} · pakiranje {fmt(i.pack, i.u)}
                    </td>
                    <td className="c" style={{ width: 90 }}>
                      <button
                        type="button"
                        className="cookbtn"
                        onClick={() => {
                          const r = setHidden(data, i.id, false);
                          apply(r.data, r.msg);
                          setQ("");
                        }}
                      >
                        Vrati
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub">
            Nije to što tražiš?{" "}
            <button type="button" className="linkbtn" onClick={() => setAdding(true)}>
              Dodaj novu namirnicu „{q.trim()}”
            </button>
          </p>
        </div>
      )}

      {hidden.length > 0 && !term && (
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
            <p className="sub">Skrivene ne dolaze na popis za kupovinu, osim ako ih traži recept ili omlet koji si isplanirao.</p>
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
              pripremljeno. Recepti, plan, omleti i troškovi ostaju. Ugrađene namirnice uvijek možeš vratiti preko tražilice.
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

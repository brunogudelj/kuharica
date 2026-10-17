import { Fragment, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CATS } from "../data";
import type { CatId, Item } from "../data";
import { useApp } from "../state/AppContext";
import { price, shopping } from "../logic/inventory";
import type { ShopRow } from "../logic/inventory";
import { allItems } from "../logic/items";
import { purchase, undoPurchase } from "../logic/actions";
import { shopIndex, shopName } from "../logic/shops";
import { clone } from "../state/model";
import { SortTh } from "../components/Cells";

const CAT_ORDER: CatId[] = ["fre", "fri", "frz", "dry"];
import { eur, fmt, monthKey, round, sameDay, stavki } from "../logic/format";
import { ItemForm } from "../components/ItemForm";
import { Icon } from "../components/icons";

const parse = (s: string) => parseFloat(s.replace(",", "."));
const numStr = (n: number) => String(round(n)).replace(".", ",");

/** Unos točne kupljene količine i cijene; za g i ml može i kg/l */
function AmountFields({
  i,
  amt,
  setAmt,
  big,
  setBig,
  paid,
  setPaid,
  idp,
}: {
  i: Item;
  amt: string;
  setAmt: (v: string) => void;
  big: boolean;
  setBig: (v: boolean) => void;
  paid: string;
  setPaid: (v: string) => void;
  idp: string;
}) {
  const bigUnit = i.u === "g" ? "kg" : i.u === "ml" ? "l" : null;
  return (
    <div className="buyfields">
      <label htmlFor={`${idp}-amt`} className="amt">
        Kupio
        <span className="amtrow">
          <input
            id={`${idp}-amt`}
            type="text"
            inputMode="decimal"
            min="0"
            step="any"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
          {bigUnit ? (
            <span className="unitsw" role="group" aria-label="Jedinica">
              <button
                type="button"
                aria-pressed={!big}
                onClick={() => big && (setBig(false), setAmt(numStr(parse(amt || "0") * 1000)))}
              >
                {i.u}
              </button>
              <button
                type="button"
                aria-pressed={big}
                onClick={() => !big && (setBig(true), setAmt(numStr(parse(amt || "0") / 1000)))}
              >
                {bigUnit}
              </button>
            </span>
          ) : (
            <span className="unit">{i.u}</span>
          )}
        </span>
      </label>
      <label htmlFor={`${idp}-paid`}>
        Platio (€)
        <input
          id={`${idp}-paid`}
          type="text"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="po želji"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </label>
    </div>
  );
}

/** "0,512 kg" ili "512" → količina u jedinici namirnice (g, ml, kom) */
export function parseAmount(t: string, u: string): number {
  const m = t.trim().toLowerCase().replace(",", ".").match(/^([\d.]+)\s*(kg|g|l|ml|kom)?$/);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  if ((m[2] === "kg" && u === "g") || (m[2] === "l" && u === "ml")) return v * 1000;
  return v;
}

function ShopTr({ x }: { x: ShopRow }) {
  const { data, apply } = useApp();
  const def = x.packs * x.i.pack;
  const [amt, setAmt] = useState("");
  const [paid, setPaid] = useState("");
  const bad = amt.trim() !== "" && !(parseAmount(amt, x.i.u) > 0);
  const buyNow = () => {
    const a = amt.trim() ? parseAmount(amt, x.i.u) : def;
    if (!(a > 0)) return;
    const p = paid.trim() ? parse(paid) : null;
    const r = purchase(data, x.i.id, a, p != null && !isNaN(p) ? p : null);
    apply(r.data, r.msg);
  };
  return (
    <tr>
      <td className="c" style={{ width: 44 }}>
        <button
          type="button"
          className="tick-btn"
          aria-pressed={false}
          aria-label={`Kupljeno: ${x.i.n}`}
          onClick={buyNow}
        >
          <Icon name="check" size={16} />
        </button>
      </td>
      <td className="sticky namecell stack" style={{ minWidth: 170 }}>
        <span className="iname">{x.i.n}</span>
        <small className={x.forPlan ? "tag-plan" : "muted"}>{x.forPlan ? "za plan" : "dopuna zalihe"}</small>
      </td>
      <td className="muted">{shopName(data, x.i.src)}</td>
      <td>
        <span className={`label l-${x.i.cat}`}>{CATS[x.i.cat]}</span>
      </td>
      <td className="txt num">{fmt(x.short, x.i.u)}</td>
      <td className="txt num">
        {x.packs} × {fmt(x.i.pack, x.i.u)}
      </td>
      <td style={{ minWidth: 110 }}>
        <input
          className={"cellin num" + (bad ? " bad" : "")}
          type="text"
          inputMode="decimal"
          aria-label={`Kupljena količina: ${x.i.n}`}
          placeholder={fmt(def, x.i.u)}
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buyNow()}
        />
      </td>
      <td style={{ width: 96 }}>
        <input
          className="cellin num"
          type="text"
          inputMode="decimal"
          aria-label={`Plaćeno (€): ${x.i.n}`}
          placeholder="€"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buyNow()}
        />
      </td>
      <td className="txt num">{x.cost != null ? "≈ " + eur(x.cost) : "–"}</td>
    </tr>
  );
}

/** Kupio nešto što nije na popisu */
function Extra() {
  const { data, apply } = useApp();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [amt, setAmt] = useState("");
  const [big, setBig] = useState(false);
  const [paid, setPaid] = useState("");
  const [newItem, setNewItem] = useState(false);
  const items = allItems(data)
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const it = items.find((i) => i.id === id);

  if (!open)
    return (
      <div className="btnrow">
        <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
          + Kupio sam nešto što nije na popisu
        </button>
      </div>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!it) return;
    const v = parse(amt);
    const a = big ? v * 1000 : v;
    const p = paid.trim() ? parse(paid) : null;
    if (!(a > 0)) return;
    const r = purchase(data, it.id, a, p != null && !isNaN(p) ? p : null);
    apply(r.data, r.msg);
    setId("");
    setAmt("");
    setPaid("");
    setBig(false);
  };

  return (
    <>
      <form className="confirm" onSubmit={submit} aria-label="Kupljeno izvan popisa">
        <b>Kupio sam još</b>
        <div className="edit">
          <label htmlFor="exItem">
            Namirnica
            <select
              id="exItem"
              value={id}
              onChange={(e) => {
                if (e.target.value === "__new") return setNewItem(true);
                setId(e.target.value);
                const i = items.find((x) => x.id === e.target.value);
                if (i) setAmt(numStr(i.pack));
                setBig(false);
              }}
            >
              <option value="">Odaberi…</option>
              <option value="__new">+ Nova namirnica</option>
              {(Object.entries(CATS) as [CatId, string][]).map(([k, t]) => (
                <optgroup key={k} label={t}>
                  {items
                    .filter((i) => i.cat === k)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.n}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        {it && (
          <AmountFields
            i={it}
            amt={amt}
            setAmt={setAmt}
            big={big}
            setBig={setBig}
            paid={paid}
            setPaid={setPaid}
            idp="ex"
          />
        )}
        <div className="btnrow">
          <button type="submit" className="btn" disabled={!it}>
            Dodaj u zalihu
          </button>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            Zatvori
          </button>
        </div>
      </form>
      {newItem && (
        <ItemForm
          onDone={(i) => {
            setNewItem(false);
            if (i) {
              setId(i.id);
              setAmt(numStr(i.pack));
            }
          }}
        />
      )}
    </>
  );
}

/** Kupljeno danas: popis s poništavanjem */
function Basket() {
  const { data, apply } = useApp();
  const now = Date.now();
  const mk = monthKey(now);
  const today = (data.costs[mk] || []).filter((e) => e.est && e.item && sameDay(e.t, now));
  if (!today.length) return null;
  const sum = today.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="group">
      <div className="ghead">
        <h2>Kupljeno danas</h2>
        <span className="count">
          {stavki(today.length)}
          {sum ? ` · ${eur(sum)}` : ""}
        </span>
      </div>
      <div className="tablewrap">
        <table className="grid">
          <tbody>
            {today
              .slice()
              .reverse()
              .map((e) => {
                const i = allItems(data).find((x) => x.id === e.item);
                return (
                  <tr key={e.id} className="st-ok">
                    <td className="namecell">
                      <span className="dot ok" aria-hidden="true" />
                      {e.note}
                    </td>
                    <td className="num">{i && e.qty ? fmt(e.qty, i.u) : ""}</td>
                    <td className="muted">{shopName(data, e.shop)}</td>
                    <td className="num">{e.amount ? eur(e.amount) : "bez cijene"}</td>
                    <td className="c" style={{ width: 48 }}>
                      <button
                        type="button"
                        className="mini"
                        aria-label={`Vrati ${e.note} na popis`}
                        title="Vrati na popis"
                        onClick={() => {
                          const r = undoPurchase(data, mk, e.id);
                          apply(r.data, r.msg);
                        }}
                      >
                        ↺
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Group = "shop" | "cat" | "none";
type SK = "n" | "shop" | "cat" | "short" | "cost";

export function KupovinaTab() {
  const { data, update } = useApp();
  const [copyMsg, setCopyMsg] = useState("");
  const [sort, setSort] = useState<{ k: SK; dir: 1 | -1 }>({ k: "n", dir: 1 });
  const ta = useRef<HTMLTextAreaElement>(null);
  const group: Group = data.ui.kupGroup ?? "shop";
  const setGroup = (g: Group) =>
    update((d) => {
      const n = clone(d);
      n.ui.kupGroup = g;
      return n;
    });
  const list = shopping(data);
  const val: Record<SK, (x: ShopRow) => number | string> = {
    n: (x) => x.i.n,
    shop: (x) => shopIndex(data, x.i.src),
    cat: (x) => CAT_ORDER.indexOf(x.i.cat),
    short: (x) => x.short / x.i.pack,
    cost: (x) => x.cost ?? -1,
  };
  const cmp = (a: ShopRow, b: ShopRow) => {
    const x = val[sort.k](a);
    const y = val[sort.k](b);
    const c = typeof x === "string" ? x.localeCompare(y as string, "hr") : x - (y as number);
    return c * sort.dir || a.i.n.localeCompare(b.i.n, "hr");
  };
  const keyOf = (x: ShopRow) => (group === "shop" ? x.i.src : group === "cat" ? x.i.cat : "");
  const groups: [string, ShopRow[]][] = [];
  for (const x of list.slice().sort(cmp)) {
    const k = keyOf(x);
    const g = groups.find(([gk]) => gk === k);
    if (g) g[1].push(x);
    else groups.push([k, [x]]);
  }
  if (group === "shop") groups.sort((a, b) => shopIndex(data, a[0]) - shopIndex(data, b[0]));
  if (group === "cat") groups.sort((a, b) => CAT_ORDER.indexOf(a[0] as CatId) - CAT_ORDER.indexOf(b[0] as CatId));
  const groupName = (k: string) => (group === "shop" ? shopName(data, k) : group === "cat" ? CATS[k as CatId] : "");

  let total = 0;
  let priced = 0;
  list.forEach((x) => {
    if (x.cost != null) {
      total += x.cost;
      priced++;
    }
  });
  const byShop: [string, ShopRow[]][] = [];
  for (const x of list) {
    const g = byShop.find(([k]) => k === x.i.src);
    if (g) g[1].push(x);
    else byShop.push([x.i.src, [x]]);
  }
  const txt =
    byShop
      .sort((a, b) => shopIndex(data, a[0]) - shopIndex(data, b[0]))
      .map(
        ([s, a]) =>
          shopName(data, s).toUpperCase() +
          "\n" +
          a.map((x) => `- ${x.i.n}: ${x.packs} × ${fmt(x.i.pack, x.i.u)}`).join("\n"),
      )
      .join("\n\n") || "Ništa ne fali.";

  const copy = () => {
    const fallback = () => {
      ta.current?.closest("details")?.setAttribute("open", "");
      ta.current?.focus();
      ta.current?.select();
      setCopyMsg("Označeno, kopiraj ručno");
    };
    try {
      navigator.clipboard.writeText(txt).then(() => setCopyMsg("Kopirano"), fallback);
    } catch {
      fallback();
    }
  };

  return (
    <section id="kupovina" aria-labelledby="tab-kupovina">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Grupiraj popis">
          <span className="seglbl">Grupiraj</span>
          {(
            [
              ["shop", "Po dućanu"],
              ["cat", "Po spremanju"],
              ["none", "Bez grupa"],
            ] as [Group, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={group === k} onClick={() => setGroup(k)}>
              {l}
            </button>
          ))}
        </div>
        <span className="grow" />
        <span className="count" aria-live="polite">
          {copyMsg}
        </span>
        <button className="btn ghost" type="button" onClick={copy}>
          Kopiraj popis
        </button>
      </div>

      {list.length ? (
        <div className="group">
          <div className="tablewrap">
            <table className="grid" aria-label="Popis za kupovinu">
              <thead>
                <tr>
                  <th className="c" style={{ width: 52 }}>
                    <span className="sr-only">Kupljeno</span>
                  </th>
                  <SortTh k="n" sort={sort} setSort={setSort} className="sticky">
                    Namirnica
                  </SortTh>
                  <SortTh k="shop" sort={sort} setSort={setSort}>
                    Dućan
                  </SortTh>
                  <SortTh k="cat" sort={sort} setSort={setSort}>
                    Spremanje
                  </SortTh>
                  <SortTh k="short" sort={sort} setSort={setSort} className="num">
                    Fali
                  </SortTh>
                  <th className="num">Predloženo</th>
                  <th className="num">Kupio</th>
                  <th className="num">Platio</th>
                  <SortTh k="cost" sort={sort} setSort={setSort} className="num">
                    Procjena
                  </SortTh>
                </tr>
              </thead>
              <tbody>
                {groups.map(([k, arr]) => {
                  const sub = arr.reduce((t, x) => t + (x.cost ?? 0), 0);
                  return (
                    <Fragment key={k || "sve"}>
                      {group !== "none" && (
                        <tr className="grouprow">
                          <td />
                          <td className="sticky">{groupName(k)}</td>
                          <td colSpan={7}>
                            {stavki(arr.length)}
                            {sub ? ` · ≈ ${eur(sub)}` : ""}
                          </td>
                        </tr>
                      )}
                      {arr.map((x) => (
                        <ShopTr key={x.i.id + ":" + x.packs + ":" + (price(data, x.i.id) ?? "")} x={x} />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="tblfoot">
              <span>Kvačica sprema predloženu količinu, ili ono što upišeš u Kupio.</span>
              <span>Za meso upiši točno s etikete, npr. „512” ili „0,512 kg”.</span>
              {priced > 0 && (
                <span className="tblsum">
                  Procjena: <b>{eur(total)}</b> ({priced} od {list.length} ima cijenu)
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">
          <b>Ništa ne fali.</b>
          <span>Imaš sve za plan i minimalnu zalihu.</span>
        </div>
      )}

      <Extra />
      <Basket />

      <details className="textlist">
        <summary>Popis kao tekst</summary>
        <textarea ref={ta} readOnly value={txt} aria-label="Popis za kupovinu kao tekst" />
      </details>
    </section>
  );
}

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { CATS, SHOP_LINKS, SHOPS } from "../data";
import type { CatId, Item, ShopId } from "../data";
import { useApp } from "../state/AppContext";
import { price, shopping } from "../logic/inventory";
import type { ShopRow } from "../logic/inventory";
import { allItems } from "../logic/items";
import { addReceipt, purchase, undoPurchase } from "../logic/actions";
import { eur, fmt, monthKey, round, sameDay, stavki } from "../logic/format";
import { Note } from "../components/ui";
import { ItemForm } from "../components/ItemForm";

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

function ListRow({ x }: { x: ShopRow }) {
  const { data, apply } = useApp();
  const [open, setOpen] = useState(false);
  const def = x.packs * x.i.pack;
  const [amt, setAmt] = useState(numStr(def));
  const [big, setBig] = useState(false);
  const [paid, setPaid] = useState("");
  const amount = () => {
    const v = parse(amt);
    return big ? v * 1000 : v;
  };
  const buyNow = (a: number, p: number | null) => {
    const r = purchase(data, x.i.id, a, p);
    apply(r.data, r.msg);
  };

  return (
    <div className={"shoprow" + (open ? " open" : "")}>
      <div className="srow">
        <button
          type="button"
          className="check"
          aria-label={`Kupljeno: ${x.i.n}, ${x.packs} × ${fmt(x.i.pack, x.i.u)}`}
          onClick={() => buyNow(def, null)}
        />
        <button type="button" className="sn" onClick={() => setOpen(!open)} aria-expanded={open}>
          <b>{x.i.n}</b>
          <small>
            {x.forPlan ? "za plan" : "dopuna zalihe"} · fali {fmt(x.short, x.i.u)} · točna količina ›
          </small>
        </button>
        <div className="sq">
          {x.packs} × {fmt(x.i.pack, x.i.u)}
          {x.cost != null && (
            <>
              <br />≈ {eur(x.cost)}
            </>
          )}
        </div>
      </div>
      {open && (
        <form
          className="buyform"
          onSubmit={(e) => {
            e.preventDefault();
            const a = amount();
            const p = paid.trim() ? parse(paid) : null;
            if (!(a > 0)) return;
            buyNow(a, p != null && !isNaN(p) ? p : null);
          }}
        >
          <AmountFields
            i={x.i}
            amt={amt}
            setAmt={setAmt}
            big={big}
            setBig={setBig}
            paid={paid}
            setPaid={setPaid}
            idp={`b-${x.i.id}`}
          />
          <div className="btnrow">
            <button type="submit" className="btn">
              Kupljeno
            </button>
            <span className="count">
              {fmt(def, x.i.u)} je {x.packs} {x.packs === 1 ? "pakiranje" : "pakiranja"}. Upiši točno s etikete ili
              računa.
            </span>
          </div>
        </form>
      )}
    </div>
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

/** Kupljeno danas: popis s poništavanjem i upisom ukupnog iznosa s računa */
function Basket() {
  const { data, apply, notify } = useApp();
  const now = Date.now();
  const mk = monthKey(now);
  const today = (data.costs[mk] || []).filter((e) => e.est && e.item && sameDay(e.t, now));
  const [shop, setShop] = useState<ShopId>("K");
  const [total, setTotal] = useState("");
  if (!today.length) return null;
  const shops = Array.from(new Set(today.map((e) => e.shop))) as ShopId[];
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
      <div className="list">
        {today
          .slice()
          .reverse()
          .map((e) => {
            const i = allItems(data).find((x) => x.id === e.item);
            return (
              <div key={e.id} className="lrow">
                <span className="tick" aria-hidden="true">
                  ✓
                </span>
                <div className="ln">
                  <b>{e.note}</b>
                  <small>
                    {i && e.qty ? fmt(e.qty, i.u) : ""} · {SHOPS[e.shop as ShopId] ?? e.shop}
                    {e.amount ? ` · ${eur(e.amount)}` : " · bez cijene"}
                  </small>
                </div>
                <button
                  type="button"
                  className="del"
                  aria-label={`Vrati ${e.note} na popis`}
                  onClick={() => {
                    const r = undoPurchase(data, mk, e.id);
                    apply(r.data, r.msg);
                  }}
                >
                  ↺
                </button>
              </div>
            );
          })}
      </div>
      <form
        className="edit"
        onSubmit={(ev) => {
          ev.preventDefault();
          const t = parse(total);
          if (!(t > 0)) return notify("Upiši ukupni iznos s računa.");
          const r = addReceipt(data, { shop, amount: t, t: Date.now(), note: "Račun " + SHOPS[shop] });
          apply(r.data, `Račun ${eur(t)} spremljen${r.replaced ? `, zamijenio ${stavki(r.replaced)} s popisa` : ""}.`);
          setTotal("");
        }}
      >
        <label htmlFor="bkShop">
          Završi kupovinu: dućan
          <select
            id="bkShop"
            value={shops.includes(shop) ? shop : shops[0]}
            onChange={(e) => setShop(e.target.value as ShopId)}
          >
            {(Object.entries(SHOPS) as [ShopId, string][]).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="bkTotal">
          Ukupno na računu (€)
          <input
            id="bkTotal"
            type="text"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="npr. 47,30"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
        <button type="submit" className="btn ghost">
          Spremi račun
        </button>
      </form>
      <p className="sub">
        Ukupni iznos s računa zamjenjuje pojedinačne cijene tog dućana za danas u Troškovima. Količine u zalihi ostaju.
      </p>
    </div>
  );
}

export function KupovinaTab() {
  const { data } = useApp();
  const [copyMsg, setCopyMsg] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const list = shopping(data);
  const groups: Record<ShopId, ShopRow[]> = { K: [], BIO: [], AZ: [], O: [] };
  list.forEach((x) => groups[x.i.src].push(x));
  let total = 0;
  let priced = 0;
  list.forEach((x) => {
    if (x.cost != null) {
      total += x.cost;
      priced++;
    }
  });
  const txt =
    (Object.entries(groups) as [ShopId, ShopRow[]][])
      .filter(([, a]) => a.length)
      .map(
        ([s, a]) =>
          SHOPS[s].toUpperCase() + "\n" + a.map((x) => `- ${x.i.n}: ${x.packs} × ${fmt(x.i.pack, x.i.u)}`).join("\n"),
      )
      .join("\n\n") || "Ništa ne fali.";

  const copy = () => {
    const fallback = () => {
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
    <section id="kupovina" role="tabpanel" aria-labelledby="tab-kupovina">
      <Note>
        <strong>U dućanu:</strong> kvačicom označiš kupljeno i predložena količina ide u zalihu. Za meso, voće i sve što
        kupuješ na točnu mjeru dodirni naziv i upiši točno koliko je na etiketi (grami ili kg, komadi) i po želji koliko
        je koštalo.
      </Note>

      {list.length ? (
        <div className="group">
          {(Object.entries(groups) as [ShopId, ShopRow[]][])
            .filter(([, a]) => a.length)
            .map(([s, arr]) => {
              const sub = arr.reduce((t, x) => t + (x.cost ?? 0), 0);
              return (
                <div key={s} className="group">
                  <div className="ghead">
                    <h2>{SHOPS[s]}</h2>
                    <span className="count">
                      {stavki(arr.length)}
                      {sub ? ` · ≈ ${eur(sub)}` : ""}
                    </span>
                  </div>
                  <div className="list">
                    {arr.map((x) => (
                      <ListRow key={x.i.id + ":" + x.packs + ":" + (price(data, x.i.id) ?? "")} x={x} />
                    ))}
                  </div>
                </div>
              );
            })}
          {priced ? (
            <p className="total">
              Procjena: {eur(total)}{" "}
              <span className="count">
                ({priced} od {list.length} stavki ima cijenu)
              </span>
            </p>
          ) : (
            <p className="sub">
              Kad uz kupnju upišeš koliko je koštalo, aplikacija zapamti cijenu i ovdje računa procjenu.
            </p>
          )}
        </div>
      ) : (
        <Note>
          <strong>Ništa ne fali.</strong> Imaš sve za plan i minimalnu zalihu.
        </Note>
      )}

      <Extra />
      <Basket />

      <div className="group">
        <h2>Kopiraj popis</h2>
        <div className="btnrow">
          <button className="btn" type="button" onClick={copy}>
            Kopiraj popis
          </button>
          <span className="count" aria-live="polite">
            {copyMsg}
          </span>
        </div>
        <textarea ref={ta} readOnly value={txt} aria-label="Popis za kupovinu kao tekst" />
      </div>

      <div className="group">
        <h2>Zdravi dućani</h2>
        <div className="shops">
          {SHOP_LINKS.zdravi.map((s) => (
            <div key={s.url} className="shop">
              <a href={s.url} target="_blank" rel="noopener">
                {s.n}
              </a>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="group">
        <h2>Azijski dućani u Zagrebu</h2>
        <div className="shops">
          {SHOP_LINKS.azijski.map((s) => (
            <div key={s.url} className="shop">
              <a href={s.url} target="_blank" rel="noopener">
                {s.n}
              </a>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Više namirnica odjednom: s fotografije računa (Claude), skeniranjem barkodova jednog za drugim ili ručno.
   Sve stavke se provjere u tablici i jednim klikom idu u zalihu i troškove. */
import { useRef, useState } from "react";
import type { Item } from "../data";
import { useApp } from "../state/AppContext";
import { allItems, itemByEan, itemOf } from "../logic/items";
import { catOpts } from "../logic/lists";
import { shopOpts } from "../logic/shops";
import { bulkPurchase, editItem } from "../logic/actions";
import { learnAliases } from "../logic/importRecipe";
import { claudeReceipt, matchShop, shrinkImage } from "../logic/receipt";
import { hitPatch, offBarcode } from "../logic/foodinfo";
import type { FoodHit } from "../logic/foodinfo";
import { loadClaudeKey } from "../logic/claude";
import { eur, round } from "../logic/format";
import { fromKey, todayKey } from "../logic/dates";
import { Scanner } from "./Scanner";
import { ItemForm } from "./ItemForm";
import { Icon } from "./icons";

interface Row {
  key: number;
  sel: boolean;
  /** redak s računa ili "barkod 385…" */
  raw: string;
  /** naziv za novu namirnicu */
  name: string;
  item: string;
  amt: string;
  price: string;
  ean?: string;
  hit?: FoodHit | null;
  /** s računa (naziv se pamti kao drugi naziv namirnice) */
  fromReceipt?: boolean;
}

const parse = (s: string) => {
  const v = parseFloat(s.replace(",", "."));
  return isNaN(v) ? null : v;
};
const show = (n: number | null | undefined) => (n == null ? "" : String(round(n)).replace(".", ","));

export function BulkAdd({ onDone }: { onDone: () => void }) {
  const { data, apply } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [shop, setShop] = useState("K");
  const [date, setDate] = useState(todayKey());
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [scan, setScan] = useState(false);
  const [newFor, setNewFor] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const hasKey = !!loadClaudeKey();

  const items = allItems(data)
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const set = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const addRows = (list: Omit<Row, "key">[]) =>
    setRows((rs) => [...rs, ...list.map((r) => ({ ...r, key: nextKey.current++ }))]);

  const readReceipt = async (f: File) => {
    setErr("");
    setBusy("Claude čita račun…");
    try {
      const img = await shrinkImage(f);
      const r = await claudeReceipt(data, loadClaudeKey(), img);
      if (r.shop) setShop(matchShop(data, r.shop));
      if (r.date) setDate(r.date);
      setTotal(r.total);
      addRows(
        r.lines.map((l) => ({
          sel: true,
          raw: l.raw,
          name: l.name,
          item: l.item ?? "",
          amt: show(l.amount),
          price: show(l.price),
          fromReceipt: true,
        })),
      );
      if (!r.lines.length) setErr("Na računu nisu pronađene stavke.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Račun se ne može pročitati.");
    } finally {
      setBusy("");
    }
  };

  const onCode = async (code: string) => {
    const known = itemByEan(data, code);
    if (known) {
      // isti proizvod još jednom: povećaj količinu u postojećem retku
      const same = rows.find((r) => r.item === known.id && r.ean === code);
      if (same) set(same.key, { amt: show((parse(same.amt) ?? 0) + known.pack) });
      else
        addRows([
          {
            sel: true,
            raw: `barkod ${code}`,
            name: known.n,
            item: known.id,
            amt: show(known.pack),
            price: "",
            ean: code,
          },
        ]);
      return;
    }
    setBusy(`Tražim ${code}…`);
    let hit: FoodHit | null = null;
    try {
      hit = await offBarcode(code);
    } catch {
      /* bez baze: red ostaje za ručni unos */
    }
    setBusy("");
    addRows([
      {
        sel: true,
        raw: `barkod ${code}`,
        name: hit ? [hit.brand, hit.name].filter(Boolean).join(" ") : "",
        item: "",
        amt: show(hit?.pack ?? null),
        price: "",
        ean: code,
        hit,
      },
    ]);
  };

  const chosen = rows.filter((r) => r.sel && r.item && (parse(r.amt) ?? 0) > 0);
  const sum = chosen.reduce((s, r) => s + (parse(r.price) ?? 0), 0);

  const save = () => {
    const t = fromKey(date).getTime() + 12 * 3600 * 1000;
    let d = data;
    // barkod se pamti na namirnici, a naziv s računa kao drugi naziv
    for (const r of chosen) if (r.ean && !itemOf(d, r.item)?.ean) d = editItem(d, r.item, { ean: r.ean });
    d = learnAliases(
      d,
      chosen.filter((r) => r.fromReceipt && r.raw).map((r): [string, string] => [r.item, r.raw]),
    ).data;
    const res = bulkPurchase(
      d,
      chosen.map((r) => ({ id: r.item, amount: parse(r.amt)!, price: parse(r.price) })),
      shop,
      t,
    );
    apply(res.data, res.msg);
    onDone();
  };

  const newRow = rows.find((r) => r.key === newFor);

  return (
    <section className="confirm bulkadd" aria-label="Više namirnica odjednom">
      <div className="rowspread">
        <b>Račun i više namirnica odjednom</b>
        <button type="button" className="btn ghost small" onClick={onDone}>
          Zatvori
        </button>
      </div>

      <div className="btnrow">
        <button
          type="button"
          className="btn"
          disabled={!hasKey || !!busy}
          onClick={() => file.current?.click()}
          title={hasKey ? "" : "Upiši Claude API ključ u Postavkama"}
        >
          <Icon name="receipt" size={18} /> Fotografiraj račun
        </button>
        <button type="button" className="btn ghost" onClick={() => setScan((s) => !s)}>
          <Icon name="barcode" size={18} /> {scan ? "Zatvori kameru" : "Skeniraj barkodove"}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => addRows([{ sel: true, raw: "", name: "", item: "", amt: "", price: "" }])}
        >
          <Icon name="plus" size={18} /> Red ručno
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readReceipt(f);
            e.target.value = "";
          }}
        />
      </div>
      {!hasKey && (
        <p className="sub">
          Za čitanje računa upiši Claude API ključ u Postavke → Claude. Barkodovi i ručni unos rade i bez njega.
        </p>
      )}
      {scan && <Scanner key={rows.length} onCode={onCode} />}
      {scan && <p className="sub">Skeniraj proizvode jedan za drugim, svaki dođe kao red u tablicu.</p>}
      {busy && <p className="sub">{busy}</p>}
      {err && <p className="miss">{err}</p>}

      {rows.length > 0 && (
        <>
          <div className="edit">
            <label htmlFor="baShop">
              Dućan
              <select id="baShop" value={shop} onChange={(e) => setShop(e.target.value)}>
                {shopOpts(data).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="baDate">
              Datum
              <input id="baDate" type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} />
            </label>
          </div>
          <div className="tablewrap">
            <table className="grid compact bulktable" aria-label="Stavke">
              <thead>
                <tr>
                  <th />
                  <th>S računa</th>
                  <th>Namirnica</th>
                  <th className="num">Količina</th>
                  <th className="num">€</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const it = r.item ? itemOf(data, r.item) : undefined;
                  return (
                    <tr key={r.key} className={r.sel ? "" : "off"}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="Dodaj ovu stavku"
                          checked={r.sel}
                          onChange={(e) => set(r.key, { sel: e.target.checked })}
                        />
                      </td>
                      <td className="muted rawcell">{r.raw || r.name || "–"}</td>
                      <td>
                        <select
                          aria-label="Namirnica"
                          value={r.item}
                          onChange={(e) =>
                            e.target.value === "__new"
                              ? setNewFor(r.key)
                              : set(r.key, {
                                  item: e.target.value,
                                  amt: r.amt || show(itemOf(data, e.target.value)?.pack),
                                })
                          }
                        >
                          <option value="">{r.name ? `? ${r.name}` : "Odaberi…"}</option>
                          <option value="__new">+ Nova namirnica{r.name ? `: ${r.name}` : ""}</option>
                          {catOpts(data).map(([c, t]) => (
                            <optgroup key={c} label={t}>
                              {items
                                .filter((i) => i.cat === c)
                                .map((i: Item) => (
                                  <option key={i.id} value={i.id}>
                                    {i.n}
                                    {data.items.hidden.includes(i.id) ? " (skrivena)" : ""}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        <span className="amtrow">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label="Količina"
                            value={r.amt}
                            onChange={(e) => set(r.key, { amt: e.target.value })}
                          />
                          <span className="unit">{it?.u ?? ""}</span>
                        </span>
                      </td>
                      <td className="num">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="Cijena (€)"
                          value={r.price}
                          onChange={(e) => set(r.key, { price: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="tblfoot">
              <span>
                {chosen.length} od {rows.length} stavki ide u zalihu
                {rows.some((r) => r.sel && !r.item) && " · stavke bez namirnice se preskaču"}
              </span>
              <span className="tblsum">
                Zbroj <b>{eur(sum)}</b>
                {total != null && Math.abs(total - sum) > 0.05 && <> · na računu {eur(total)}</>}
              </span>
            </div>
          </div>
          <div className="btnrow">
            <button type="button" className="btn" disabled={!chosen.length} onClick={save}>
              Dodaj u zalihu ({chosen.length})
            </button>
          </div>
          <p className="sub">
            Skrivene namirnice se vraćaju u zalihu. Cijena se pamti kao cijena pakiranja, a nazivi s računa kao drugi
            nazivi, pa se idući račun prepozna bolje.
          </p>
        </>
      )}

      {newRow && (
        <ItemForm
          key={newRow.key}
          initial={{
            n: newRow.hit?.name ?? newRow.name,
            u: newRow.hit?.unit ?? "g",
            pack: newRow.hit?.pack ?? parse(newRow.amt) ?? undefined,
            info: {
              ...(newRow.ean ? { ean: newRow.ean } : {}),
              ...(newRow.hit ? hitPatch({ n: newRow.hit.name, u: newRow.hit.unit ?? "g" }, newRow.hit) : {}),
            },
          }}
          onDone={(item) => {
            if (item) set(newRow.key, { item: item.id, amt: newRow.amt || show(item.pack) });
            setNewFor(null);
          }}
        />
      )}
    </section>
  );
}

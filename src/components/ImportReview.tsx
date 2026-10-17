/* Provjera uvezenog recepta: za svaki sastojak odaberi namirnicu i količinu, pa nastavi na obrazac recepta */
import { useState } from "react";
import { useApp } from "../state/AppContext";
import { allItems, itemOf } from "../logic/items";
import { catOpts } from "../logic/lists";
import { toDraft } from "../logic/importRecipe";
import type { IngLine, ParsedRecipe } from "../logic/importRecipe";
import { round } from "../logic/format";
import { ItemForm } from "./ItemForm";
import { RecipeForm } from "./RecipeForm";
import { Icon } from "./icons";

interface Row {
  raw: string;
  /** id namirnice ili "" = samo bilješka (ne prati se u zalihi) */
  item: string;
  /** količina za cijeli recept, u jedinici namirnice */
  amt: string;
}

const num = (s: string) => parseFloat(s.replace(",", "."));
const show = (n: number | null) => (n == null ? "" : String(round(n)).replace(".", ","));

/** Naziv sastojka bez količine i jedinice, za novu namirnicu */
function cleanName(raw: string) {
  return raw
    .replace(/\(.*?\)/g, "")
    .replace(/^[\d\s.,/½¼¾⅓⅔-]+/, "")
    .replace(/^(g|kg|ml|l|dl|kom|tbsp|tsp|cups?|oz|lb|žlic\w*|žličic\w*|šalic\w*)\b\.?\s*/i, "")
    .split(/,| or | ili /i)[0]
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function ImportReview({
  parsed,
  lines,
  method,
  carb,
  onDone,
}: {
  parsed: ParsedRecipe;
  lines: IngLine[];
  method?: string;
  carb?: string;
  onDone: () => void;
}) {
  const { data } = useApp();
  const [rows, setRows] = useState<Row[]>(() =>
    lines.map((l) => ({ raw: l.raw, item: l.item?.id ?? "", amt: show(l.amount) })),
  );
  const [serv, setServ] = useState(show(parsed.servings ?? 2));
  const [step, setStep] = useState<"check" | "form">("check");
  const [newFor, setNewFor] = useState<number | null>(null);

  const items = allItems(data)
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const set = (k: number, p: Partial<Row>) => setRows((rs) => rs.map((r, i) => (i === k ? { ...r, ...p } : r)));
  const matched = rows.filter((r) => r.item && num(r.amt) > 0).length;

  if (step === "form") {
    const s = num(serv);
    const p = { ...parsed, servings: s > 0 ? s : parsed.servings };
    const edited: IngLine[] = rows.map((r) => {
      const it = r.item ? (itemOf(data, r.item) ?? null) : null;
      const a = num(r.amt);
      return { raw: r.raw, name: r.raw, item: it, unit: it?.u ?? "", amount: it && a > 0 ? a : null };
    });
    const { draft } = toDraft(data, p, { lines: edited, method, carb });
    return (
      <>
        <div className="btnrow">
          <button type="button" className="linkbtn" onClick={() => setStep("check")}>
            ← Natrag na sastojke
          </button>
        </div>
        <RecipeForm draft={draft} onDone={onDone} />
      </>
    );
  }

  return (
    <div className="importsum">
      <div className="rowspread">
        <b>
          Sastojci: povezano {matched} od {rows.length}
        </b>
        <label className="inline-label">
          Recept je za
          <input
            className="servin"
            type="text"
            inputMode="decimal"
            value={serv}
            onChange={(e) => setServ(e.target.value)}
            aria-label="Broj porcija u izvornom receptu"
          />
          porcija
        </label>
      </div>
      <p className="sub">
        Za svaki sastojak odaberi namirnicu iz zalihe i količinu za cijeli recept. „Samo bilješka” ide u recept kao
        tekst (sol, začini) i ne skida se sa zalihe.
      </p>
      <div className="tablewrap">
        <table className="grid importtable">
          <thead>
            <tr>
              <th>Sastojak s web stranice</th>
              <th>Namirnica</th>
              <th className="num">Količina (cijeli recept)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => {
              const it = r.item ? itemOf(data, r.item) : undefined;
              const ok = !!it && num(r.amt) > 0;
              return (
                <tr key={k} className={r.item ? (ok ? "" : "st-low") : "st-none"}>
                  <td className="rawcell">
                    <span className={"dot " + (ok ? "ok" : r.item ? "low" : "none")} aria-hidden="true" />
                    {r.raw}
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <select
                      className="cellsel"
                      aria-label={`Namirnica za: ${r.raw}`}
                      value={r.item}
                      onChange={(e) => {
                        if (e.target.value === "__new") return setNewFor(k);
                        set(k, { item: e.target.value });
                      }}
                    >
                      <option value="">— samo bilješka —</option>
                      <option value="__new">+ Nova namirnica…</option>
                      {catOpts(data).map(([c, t]) => (
                        <optgroup key={c} label={t}>
                          {items
                            .filter((i) => i.cat === c)
                            .map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.n}
                                {data.items.hidden.includes(i.id) ? " (skrivena)" : ""}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td style={{ width: 150 }}>
                    <span className="amtcell">
                      <input
                        className="cellin num"
                        type="text"
                        inputMode="decimal"
                        disabled={!r.item}
                        aria-label={`Količina za: ${r.raw}`}
                        placeholder={r.item ? "koliko" : ""}
                        value={r.item ? r.amt : ""}
                        onChange={(e) => set(k, { amt: e.target.value })}
                      />
                      <span className="unit">{it?.u ?? ""}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {newFor != null && (
        <ItemForm
          initialName={cleanName(rows[newFor].raw)}
          onDone={(i) => {
            if (i) set(newFor, { item: i.id });
            setNewFor(null);
          }}
        />
      )}
      <div className="btnrow">
        <button type="button" className="btn" onClick={() => setStep("form")}>
          Dalje: provjeri recept <Icon name="chev" size={16} />
        </button>
        <span className="count">
          {rows.length - matched > 0 ? `${rows.length - matched} ide kao bilješka` : "sve je povezano sa zalihom"}
        </span>
      </div>
    </div>
  );
}

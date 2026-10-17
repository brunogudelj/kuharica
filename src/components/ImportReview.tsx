/* Provjera uvezenog recepta: za svaki sastojak odaberi namirnicu ili prep i količinu,
   skupinu sastojaka (npr. umak) spremi kao novi prep, pa nastavi na obrazac recepta */
import { useState } from "react";
import { PREP_K } from "../data";
import type { CustomPrep, PrepCat } from "../data";
import { useApp } from "../state/AppContext";
import { allItems, itemOf } from "../logic/items";
import { catOpts } from "../logic/lists";
import { toDraft } from "../logic/importRecipe";
import type { IngLine, ParsedRecipe } from "../logic/importRecipe";
import { allPreps, newPrepId, prepInv, saveCustomPrep } from "../logic/preps";
import { plural, round } from "../logic/format";
import { ItemForm } from "./ItemForm";
import { RecipeForm } from "./RecipeForm";
import { Icon } from "./icons";

interface Row {
  raw: string;
  /** id namirnice, "p:<id>" za prep ili "" = samo bilješka (ne prati se u zalihi) */
  item: string;
  /** količina za cijeli recept, u jedinici namirnice ili prepa */
  amt: string;
  group?: string;
  sel: boolean;
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

/** Vrsta prepa prema nazivu skupine */
const kindOf = (g: string): PrepCat =>
  /marinad/i.test(g) ? "Marinade" : /umak|sauce|dresing|dressing|preljev|glaz/i.test(g) ? "Umaci" : "Baze";

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
  const { data, apply } = useApp();
  const [rows, setRows] = useState<Row[]>(() =>
    lines.map((l) => ({
      raw: l.raw,
      item: l.prep ? "p:" + l.prep : (l.item?.id ?? ""),
      amt: show(l.amount),
      group: l.group,
      sel: false,
    })),
  );
  const [serv, setServ] = useState(show(parsed.servings ?? 2));
  const [step, setStep] = useState<"check" | "form">("check");
  const [newFor, setNewFor] = useState<number | null>(null);
  const [mkPrep, setMkPrep] = useState<{ n: string; k: PrepCat; make: string } | null>(null);

  const items = allItems(data)
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const preps = allPreps(data);
  const set = (k: number, p: Partial<Row>) => setRows((rs) => rs.map((r, i) => (i === k ? { ...r, ...p } : r)));
  const matched = rows.filter((r) => r.item && num(r.amt) > 0).length;
  const groups = [...new Set(rows.map((r) => r.group).filter((g): g is string => !!g))];
  const selected = rows.filter((r) => r.sel);
  const unitOf = (id: string) =>
    id.startsWith("p:") ? plural(2, prepInv(data, id.slice(2))?.unit ?? "porcija") : (itemOf(data, id)?.u ?? "");

  const selectGroup = (g: string) => {
    setRows((rs) => rs.map((r) => ({ ...r, sel: r.group === g })));
    setMkPrep({ n: `${g} (${parsed.n})`, k: kindOf(g), make: "1" });
  };

  /** Označeni retci postaju jedan novi prep; u receptu ostaje 1 jedinica tog prepa */
  const createPrep = () => {
    if (!mkPrep || !mkPrep.n.trim() || !selected.length) return;
    const use: Record<string, number> = {};
    const extra: string[] = [];
    for (const r of selected) {
      const a = num(r.amt);
      if (r.item && !r.item.startsWith("p:") && a > 0) use[r.item] = round((use[r.item] || 0) + a);
      else extra.push(r.raw);
    }
    const make = num(mkPrep.make) > 0 ? num(mkPrep.make) : 1;
    const p: CustomPrep = {
      id: newPrepId(mkPrep.n),
      n: mkPrep.n.trim(),
      k: mkPrep.k,
      time: "",
      keep: mkPrep.k === "Marinade" ? "Zamrzivač 3 mjeseca" : "Hladnjak 1 tjedan",
      make,
      unit: "porcija",
      use,
      extra,
      st: [],
    };
    const r = saveCustomPrep(data, p);
    apply(r.data, `${p.n} je spremljen u Prep. Korake mu možeš dopisati u Prepu.`);
    setRows((rs) => {
      const first = rs.findIndex((x) => x.sel);
      const out = rs.filter((x) => !x.sel);
      out.splice(first, 0, { raw: `${p.n} (prep)`, item: "p:" + p.id, amt: show(make), sel: false });
      return out;
    });
    setMkPrep(null);
  };

  if (step === "form") {
    const s = num(serv);
    const p = { ...parsed, servings: s > 0 ? s : parsed.servings };
    const edited: IngLine[] = rows.map((r) => {
      const a = num(r.amt);
      if (r.item.startsWith("p:"))
        return { raw: r.raw, name: r.raw, item: null, unit: "", prep: r.item.slice(2), amount: a > 0 ? a : null };
      const it = r.item ? (itemOf(data, r.item) ?? null) : null;
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
        Za svaki sastojak odaberi namirnicu ili prep i količinu za cijeli recept. „Samo bilješka” ide u recept kao tekst
        (sol, začini). Umak ili marinadu označi kvačicom i spremi kao prep: u receptu ostaje kao jedan sastojak.
      </p>
      {groups.length > 0 && (
        <div className="chips">
          {groups.map((g) => (
            <button key={g} type="button" className="chip removable" onClick={() => selectGroup(g)}>
              Spremi „{g}” kao prep
            </button>
          ))}
        </div>
      )}
      <div className="tablewrap">
        <table className="grid importtable">
          <thead>
            <tr>
              <th className="c" style={{ width: 36 }}>
                <span className="sr-only">Označi za prep</span>
              </th>
              <th>Sastojak s web stranice</th>
              <th>Namirnica ili prep</th>
              <th className="num">Količina (cijeli recept)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => {
              const ok = !!r.item && num(r.amt) > 0;
              const showGroup = r.group && (k === 0 || rows[k - 1].group !== r.group);
              return (
                <tr key={k + r.raw} className={(r.item ? (ok ? "" : "st-low") : "st-none") + (r.sel ? " selrow" : "")}>
                  <td className="c">
                    <input
                      type="checkbox"
                      checked={r.sel}
                      aria-label={`Označi za prep: ${r.raw}`}
                      onChange={() => {
                        set(k, { sel: !r.sel });
                        if (!mkPrep)
                          setMkPrep({
                            n: `${r.group ?? "Umak"} (${parsed.n})`,
                            k: kindOf(r.group ?? "umak"),
                            make: "1",
                          });
                      }}
                    />
                  </td>
                  <td className="rawcell">
                    {showGroup && <span className="chip grpchip">{r.group}</span>}
                    <span className={"dot " + (ok ? "ok" : r.item ? "low" : "none")} aria-hidden="true" />
                    {r.raw}
                  </td>
                  <td style={{ minWidth: 170 }}>
                    <select
                      className="cellsel"
                      aria-label={`Namirnica ili prep za: ${r.raw}`}
                      value={r.item}
                      onChange={(e) => {
                        if (e.target.value === "__new") return setNewFor(k);
                        const v = e.target.value;
                        set(k, { item: v, ...(v.startsWith("p:") && !r.item.startsWith("p:") ? { amt: "1" } : {}) });
                      }}
                    >
                      <option value="">— samo bilješka —</option>
                      <option value="__new">+ Nova namirnica…</option>
                      <optgroup label="Pripremljeno (prep)">
                        {preps.map((p) => (
                          <option key={p.id} value={"p:" + p.id}>
                            {p.n}
                          </option>
                        ))}
                      </optgroup>
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
                  <td style={{ width: 160 }}>
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
                      <span className="unit">{r.item ? unitOf(r.item) : ""}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.length > 0 && mkPrep && (
        <div className="confirm mkprep">
          <b>Novi prep od {selected.length} označenih sastojaka</b>
          <div className="edit">
            <label>
              Naziv
              <input
                value={mkPrep.n}
                onChange={(e) => setMkPrep({ ...mkPrep, n: e.target.value })}
                placeholder="npr. Teriyaki umak"
              />
            </label>
            <label>
              Vrsta
              <select value={mkPrep.k} onChange={(e) => setMkPrep({ ...mkPrep, k: e.target.value as PrepCat })}>
                {(Object.entries(PREP_K) as [PrepCat, string][]).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ova količina daje porcija
              <input
                inputMode="decimal"
                value={mkPrep.make}
                onChange={(e) => setMkPrep({ ...mkPrep, make: e.target.value })}
              />
            </label>
          </div>
          <p className="sub">
            Označeni sastojci postaju jedna tura prepa, a recept troši cijelu turu. Ako radiš duplu turu za tjedan,
            poslije u Prepu promijeni količinu.
          </p>
          <div className="btnrow">
            <button type="button" className="btn" disabled={!mkPrep.n.trim()} onClick={createPrep}>
              <Icon name="plus" size={16} /> Spremi kao prep
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setMkPrep(null);
                setRows((rs) => rs.map((r) => ({ ...r, sel: false })));
              }}
            >
              Odustani
            </button>
          </div>
        </div>
      )}

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

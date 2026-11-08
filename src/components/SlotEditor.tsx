/* Obrok u planu kao tanjur: bilo koja kombinacija recepata, prepa i namirnica (npr. čufte + riža + gyoza,
   ili 3 jaja + sir + marinirana puretina) bez pravljenja posebnog recepta. Sve ide na popis za kupovinu. */
import { useState } from "react";
import { useApp } from "../state/AppContext";
import { daySlots, slotComps } from "../state/model";
import type { Comp } from "../state/model";
import { compLabel, removeSlot, setSlotComps, toggleSlot } from "../logic/actions";
import { allRecipes, recipeOf } from "../logic/recipes";
import { allPreps, prepInv } from "../logic/preps";
import { allItems, itemOf } from "../logic/items";
import { catOpts } from "../logic/lists";
import { pc, qty, slotUse } from "../logic/inventory";
import { macrosOf } from "../logic/feed";
import { dayLabel } from "../logic/dates";
import { fmt, pfmt, round } from "../logic/format";
import { usePanel } from "./Panel";
import { Icon } from "./icons";

const parse = (s: string) => parseFloat(s.replace(",", "."));
const show = (n: number) => String(round(n)).replace(".", ",");

export function SlotEditor({ day, id }: { day: string; id: string }) {
  const { data, apply, update } = useApp();
  const { open, close } = usePanel();
  const x = daySlots(data.plan, day).find((y) => y.id === id);
  const [name, setName] = useState(x?.n ?? "");
  if (!x) return <p className="sub">Obrok više ne postoji.</p>;
  const comps = slotComps(x);
  const save = (list: Comp[]) => update((d) => setSlotComps(d, day, id, list));

  const add = (v: string) => {
    if (!v) return;
    const c: Comp | null = v.startsWith("r:")
      ? { r: v.slice(2) }
      : v.startsWith("p:")
        ? { p: v.slice(2) }
        : (() => {
            const i = itemOf(data, v.slice(2));
            if (!i) return null;
            return { item: i.id, qty: i.u === "g" || i.u === "ml" ? 100 : 1 };
          })();
    if (c) save([...comps, c]);
  };
  const setAmt = (ix: number, raw: string) => {
    const a = parse(raw);
    if (!(a > 0)) return;
    save(comps.map((c, i) => (i !== ix ? c : c.item ? { ...c, qty: a } : { ...c, s: a })));
  };

  const full = slotUse(data, x, {});
  const mac = macrosOf(data, full.use);
  const real = slotUse(data, x, { ...data.prepStock });
  const missing = Object.entries(real.use).filter(([iid, a]) => qty(data, iid) + 1e-9 < a);

  const unitOf = (c: Comp) =>
    c.item ? (itemOf(data, c.item)?.u ?? "") : c.p ? (prepInv(data, c.p)?.unit ?? "porcija") : "porc.";

  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">Obrok · {dayLabel(day)}</p>
        <h2 className="pname">{x.n || comps.map((c) => compLabel(data, c)).join(" + ") || "Prazan obrok"}</h2>
        <p className="sub">
          Složi tanjur od bilo čega: recepti, prep i namirnice. Ne treba poseban recept za svaku kombinaciju.
        </p>
      </header>

      <div className="edit one">
        <label htmlFor="slotName">
          Naziv obroka (po želji)
          <input
            id="slotName"
            type="text"
            placeholder="npr. Čufte s rižom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== (x.n ?? "") && update((d) => setSlotComps(d, day, id, comps, name))}
          />
        </label>
      </div>

      <section className="psec">
        <h3>Na tanjuru</h3>
        <div className="tablewrap">
          <table className="grid compact" aria-label="Dijelovi obroka">
            <thead>
              <tr>
                <th>Što</th>
                <th className="num">Koliko</th>
                <th>Stanje</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {comps.map((c, i) => {
                const have = c.item ? qty(data, c.item) : c.p ? pc(data, c.p) : null;
                const need = c.item ? (c.qty ?? 1) : (c.s ?? 1);
                return (
                  <tr key={i}>
                    <td>
                      {c.r || c.p ? (
                        <button
                          type="button"
                          className="linkbtn"
                          onClick={() => (c.r ? open({ t: "meal", id: c.r, day }) : open({ t: "prep", id: c.p! }))}
                        >
                          {compLabel(data, c)}
                        </button>
                      ) : (
                        compLabel(data, c)
                      )}
                      <small className="muted"> {c.r ? "recept" : c.p ? "prep" : "namirnica"}</small>
                    </td>
                    <td className="num">
                      <span className="amtrow">
                        <input
                          key={`${i}-${need}`}
                          type="text"
                          inputMode="decimal"
                          aria-label={`Koliko: ${compLabel(data, c)}`}
                          defaultValue={show(need)}
                          onBlur={(e) => setAmt(i, e.target.value)}
                        />
                        <span className="unit">{unitOf(c)}</span>
                      </span>
                    </td>
                    <td className="muted">
                      {c.r
                        ? recipeOf(data, c.r)
                          ? ""
                          : "obrisan"
                        : have == null
                          ? ""
                          : have + 1e-9 >= need
                            ? c.p
                              ? "pripremljeno"
                              : "imaš"
                            : c.p
                              ? "napravi"
                              : `imaš ${fmt(have, unitOf(c))}`}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mini"
                        aria-label={`Makni: ${compLabel(data, c)}`}
                        onClick={() => save(comps.filter((_, j) => j !== i))}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <label className="addpart">
          <span className="sr-only">Dodaj na tanjur</span>
          <select aria-label="Dodaj na tanjur" value="" onChange={(e) => add(e.target.value)}>
            <option value="">+ Dodaj recept, prep ili namirnicu…</option>
            <optgroup label="Recepti">
              {allRecipes(data)
                .slice()
                .sort((a, b) => a.n.localeCompare(b.n, "hr"))
                .map((r) => (
                  <option key={r.id} value={"r:" + r.id}>
                    {r.n}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Prep (pripremljeno)">
              {allPreps(data).map((p) => (
                <option key={p.id} value={"p:" + p.id}>
                  {p.n}
                  {pc(data, p.id) > 0 ? ` (imaš ${pfmt(pc(data, p.id), prepInv(data, p.id)?.unit ?? "porcija")})` : ""}
                </option>
              ))}
            </optgroup>
            {catOpts(data).map(([k, t]) => {
              const list = allItems(data)
                .filter((i) => i.cat === k && !data.items.hidden.includes(i.id))
                .sort((a, b) => a.n.localeCompare(b.n, "hr"));
              return list.length ? (
                <optgroup key={k} label={`Namirnice: ${t}`}>
                  {list.map((i) => (
                    <option key={i.id} value={"i:" + i.id}>
                      {i.n}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
      </section>

      <section className="psec">
        <dl className="kv">
          <div>
            <dt>Obrok ukupno</dt>
            <dd>
              {mac.known ? (
                <>
                  <b>{Math.round(mac.k)} kcal</b> · {Math.round(mac.p)} g proteina
                  {mac.known < mac.total && <small> (bez {mac.total - mac.known} namirnica bez kalorija)</small>}
                </>
              ) : (
                "–"
              )}
            </dd>
          </div>
          <div>
            <dt>Fali za ovaj obrok</dt>
            <dd>
              {missing.length
                ? missing.map(([iid, a]) => {
                    const i = itemOf(data, iid);
                    return (
                      <span key={iid} className="chip">
                        {i?.n ?? iid} {i ? fmt(Math.max(0, a - qty(data, iid)), i.u) : ""}
                      </span>
                    );
                  })
                : "ništa, imaš sve"}
            </dd>
          </div>
        </dl>
        <p className="sub">
          Što fali ide samo na popis za kupovinu. Za prep koji nemaš pripremljen kupuje se za cijelu turu.
        </p>
      </section>

      <div className="pactions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const r = toggleSlot(data, day, id);
            apply(r.data, r.msg);
          }}
        >
          <Icon name="check" size={18} /> {x.done ? "Makni kvačicu" : "Pojeo sam"}
        </button>
        <button
          type="button"
          className="btn ghost danger"
          onClick={() => {
            apply(removeSlot(data, day, id), "Obrok je maknut.");
            close();
          }}
        >
          <Icon name="trash" size={16} /> Makni obrok
        </button>
      </div>
    </div>
  );
}

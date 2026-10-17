import { Fragment, useState } from "react";
import { CYCLE, DAYS, DEFAULT_OM, OM_PRESETS } from "../data";
import { useApp } from "../state/AppContext";
import { SLOT_KEYS, clone } from "../state/model";
import type { AppData, SlotKey } from "../state/model";
import { costOf, dayCost, missingFor, qty, shopping, slotUse, weekNeeds } from "../logic/inventory";
import type { NeedRow } from "../logic/inventory";
import {
  autoFillPlan,
  cook,
  defaultFruitQty,
  eatOmlet,
  newWeek,
  setBreakfastRecipe,
  setOmDay,
  setPlanDay,
  setSlot,
  slotLabel,
  toggleSlot,
} from "../logic/actions";
import { allRecipes, recipeName, recipeOf } from "../logic/recipes";
import { allItems, itemOf } from "../logic/items";
import { omMacros, omMissing, omName, omUse } from "../logic/omlet";
import { mealEntry } from "../logic/feed";
import { eur, fmt, stavki, todayIx } from "../logic/format";
import { shopIndex, shopName } from "../logic/shops";
import { Icon } from "../components/icons";
import { usePanel } from "../components/Panel";
import { dateOf } from "../components/RecipeViews";
import { SortTh } from "../components/Cells";
import { FGroup, Page } from "../components/Page";

type NK = "n" | "shop" | "need" | "have" | "short" | "cost";

/** Namirnice koje traži plan za ovaj tjedan */
function WeekNeeds({ data }: { data: AppData }) {
  const [sort, setSort] = useState<{ k: NK; dir: 1 | -1 }>({ k: "shop", dir: 1 });
  const rows = weekNeeds(data);
  const short = rows.filter((r) => r.short > 0.0001);
  const total = short.reduce((s, r) => s + (r.cost ?? 0), 0);
  const val: Record<NK, (r: NeedRow) => number | string> = {
    n: (r) => r.i.n,
    shop: (r) => shopIndex(data, r.i.src) * 1000 + (r.short > 0 ? 0 : 500),
    need: (r) => r.need,
    have: (r) => r.have,
    short: (r) => r.short,
    cost: (r) => r.cost ?? -1,
  };
  const sorted = rows.slice().sort((a, b) => {
    const x = val[sort.k](a);
    const y = val[sort.k](b);
    const c = typeof x === "string" ? x.localeCompare(y as string, "hr") : x - (y as number);
    return c * sort.dir || a.i.n.localeCompare(b.i.n, "hr");
  });
  const grouped = sort.k === "shop";
  if (!rows.length)
    return (
      <div className="empty">
        <b>Plan je prazan.</b>
        <span>Dodaj recepte i omlete u kalendar pa ćeš ovdje vidjeti sve namirnice za tjedan.</span>
      </div>
    );

  return (
    <div>
      {(
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <SortTh k="n" sort={sort} setSort={setSort} className="sticky">
                  Namirnica
                </SortTh>
                <SortTh k="shop" sort={sort} setSort={setSort}>
                  Dućan
                </SortTh>
                <SortTh k="need" sort={sort} setSort={setSort} className="num">
                  Treba
                </SortTh>
                <SortTh k="have" sort={sort} setSort={setSort} className="num">
                  Imaš
                </SortTh>
                <SortTh k="short" sort={sort} setSort={setSort} className="num">
                  Fali
                </SortTh>
                <th className="num">€/pak.</th>
                <SortTh k="cost" sort={sort} setSort={setSort} className="num">
                  Procjena
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, ix) => {
                const head = grouped && (ix === 0 || sorted[ix - 1].i.src !== r.i.src);
                return (
                  <Fragment key={r.i.id}>
                    {head && (
                      <tr className="grouprow">
                        <td className="sticky" colSpan={7}>
                          {shopName(data, r.i.src)}
                        </td>
                      </tr>
                    )}
                    <tr className={r.short > 0.0001 ? "st-out" : "st-ok"}>
                      <td className="sticky namecell">
                        <span className={"dot " + (r.short > 0.0001 ? "out" : "ok")} aria-hidden="true" />
                        {r.i.n}
                      </td>
                      <td className="muted">{shopName(data, r.i.src)}</td>
                      <td className="num">{fmt(r.need, r.i.u)}</td>
                      <td className="num">{fmt(r.have, r.i.u)}</td>
                      <td className="num strong">{r.short > 0.0001 ? fmt(r.short, r.i.u) : "–"}</td>
                      <td className="num muted">{r.price != null ? eur(r.price) : "–"}</td>
                      <td className="num">{r.cost != null && r.packs ? eur(r.cost) : "–"}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="tblfoot">
            <span>
              {rows.length} namirnica · fali <b className={short.length ? "t-out" : "t-ok"}>{short.length}</b>
            </span>
            {total > 0 && (
              <span className="tblsum">
                Za dokupiti ≈ <b>{eur(total)}</b>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Opt = [value: string, label: string];
type OptGroup = [label: string, opts: Opt[]];

/** Padajući izbornik: prazan slot ("+ Dodaj …") ili ikona za zamjenu preko popunjenog */
function PickSelect({
  groups,
  onPick,
  label,
  swap,
  hint,
}: {
  groups: OptGroup[];
  onPick: (v: string) => void;
  label: string;
  swap?: boolean;
  hint?: string;
}) {
  const sel = (
    <select
      aria-label={label}
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="">{swap ? "Zamijeni…" : label}</option>
      {groups
        .filter(([, o]) => o.length)
        .map(([g, o]) => (
          <optgroup key={g} label={g}>
            {o.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </optgroup>
        ))}
    </select>
  );
  if (swap)
    return (
      <span className="mini swapsel" title={label}>
        <Icon name="swap" size={16} />
        {sel}
      </span>
    );
  return (
    <label className="cell addcell selcell">
      <span className="addtxt">
        <Icon name="plus" size={16} /> {label}
      </span>
      {hint && <small>{hint}</small>}
      {sel}
    </label>
  );
}

export function PlanTab() {
  const { data, apply, update } = useApp();
  const { open } = usePanel();
  const { plan } = data;
  const tix = todayIx();
  const next = ((plan.start || 0) + 7) % 5;

  const toggleCook = (ix: number) => {
    const day = plan.days[ix];
    if (day.done)
      return update((d) => {
        const n = clone(d);
        n.plan.days[ix] = { r: day.r, done: false };
        return n;
      });
    const res = cook(data, day.r, ix);
    apply(res.data, res.msg);
  };
  const toggleOm = (ix: number) => {
    const o = plan.om[ix];
    if (o.done)
      return update((d) => {
        const n = clone(d);
        n.plan.om[ix] = { ...o, done: false };
        return n;
      });
    const r = eatOmlet(data, ix);
    apply(r.data, r.msg);
  };

  const recipes = allRecipes(data);
  const mains = recipes.filter((r) => !r.side);
  const byCarb = (list: typeof recipes): OptGroup[] =>
    (["Riža", "Krumpir", "Tjestenina", "Ostalo"] as const).map((c) => [c, list.filter((r) => r.c === c).map((r): Opt => [r.id, r.n])]);
  const breakfastGroups: OptGroup[] = [
    ["Omleti", OM_PRESETS.map((p, i): Opt => ["om:" + i, p.n])],
    ["Recepti (1 porcija)", mains.map((r): Opt => ["r:" + r.id, r.n])],
    ["Složi sam", [["build", "Složi svoj omlet…"]]],
  ];
  const sideGroups = (k: "juha" | "salata"): OptGroup[] => [
    [k === "juha" ? "Juhe" : "Salate", recipes.filter((r) => r.side === k).map((r): Opt => [r.id, r.n])],
    [k === "juha" ? "Salate" : "Juhe", recipes.filter((r) => r.side && r.side !== k).map((r): Opt => [r.id, r.n])],
    ["Ostali recepti (1 porcija)", mains.map((r): Opt => [r.id, r.n])],
  ];
  const fruits = allItems(data)
    .filter((i) => i.grp === "voce")
    .sort((x, y) => x.n.localeCompare(y.n, "hr"));
  const fruitGroups: OptGroup[] = [
    ["Imaš doma", fruits.filter((i) => qty(data, i.id) > 0).map((i): Opt => [i.id, `${i.n} (${fmt(qty(data, i.id), i.u)})`])],
    ["Ostalo voće", fruits.filter((i) => !(qty(data, i.id) > 0)).map((i): Opt => [i.id, i.n])],
  ];
  const pickBreakfast = (ix: number, v: string) => {
    if (v === "build") return open({ t: "om", sel: DEFAULT_OM, day: ix });
    if (v.startsWith("om:")) return apply(setOmDay(data, ix, OM_PRESETS[Number(v.slice(3))].sel), `Doručak za ${DAYS[ix].toLowerCase()}: ${OM_PRESETS[Number(v.slice(3))].n}.`);
    const id = v.slice(2);
    apply(setBreakfastRecipe(data, ix, id), `Doručak za ${DAYS[ix].toLowerCase()}: ${recipeName(data, id)}.`);
  };
  const pickFruit = (k: SlotKey, ix: number, id: string) => {
    const i = itemOf(data, id);
    if (i) apply(setSlot(data, k, ix, { item: id, qty: defaultFruitQty(i) }), `${i.n} za ${DAYS[ix].toLowerCase()}.`);
  };

  const planned = plan.days.filter((d) => d.r).length;
  const cooked = plan.days.filter((d) => d.r && d.done).length;
  const bfPlanned = plan.om.filter((o) => o.sel || o.r);
  const eaten = bfPlanned.filter((o) => o.done).length;
  const omPlanned = plan.om.filter((o) => o.sel && !o.r);
  const avgProt = omPlanned.length
    ? Math.round(omPlanned.reduce((s, o) => s + omMacros(data, o.sel!, 1).p, 0) / omPlanned.length)
    : 0;
  const pc0 = {};
  const weekCost =
    plan.days.reduce((s, d) => s + (d.r ? dayCost(data, d.r).meals : 0), 0) +
    plan.om.reduce(
      (s, o) => s + (o.r ? costOf(data, slotUse(data, { r: o.r, done: false }, { ...pc0 }).use).c : o.sel ? costOf(data, omUse(data, o.sel, 1)).c : 0),
      0,
    ) +
    SLOT_KEYS.reduce((s, k) => s + plan.extra[k].reduce((t, x) => t + (x.item ? costOf(data, slotUse(data, x, {}).use).c : 0), 0), 0);
  const extraDone = SLOT_KEYS.reduce((s, k) => s + plan.extra[k].filter((x) => x.done).length, 0);
  const extraPlanned = SLOT_KEYS.reduce((s, k) => s + plan.extra[k].filter((x) => x.r || x.item).length, 0);
  const shop = shopping(data).length;

  const tab = data.ui.planView ?? "cal";
  const setView = (v: "cal" | "needs") =>
    update((d) => {
      const n = clone(d);
      n.ui.planView = v;
      return n;
    });
  const needs = weekNeeds(data);
  const needShort = needs.filter((r) => r.short > 0.0001).length;
  const goShop = () =>
    update((d) => {
      const n = clone(d);
      n.ui.tab = "kupovina";
      return n;
    });

  const side = (
    <>
      <div className="fblock">
        <label htmlFor="cycleStart" className="flabel">
          Ciklus kreće od
        </label>
        <select
          id="cycleStart"
          value={String(plan.start || 0)}
          onChange={(e) =>
            update((d) => {
              const n = clone(d);
              n.plan.start = Number(e.target.value);
              return n;
            })
          }
        >
          {CYCLE.map((c, i) => (
            <option key={i} value={i}>
              {i + 1}. {c}
            </option>
          ))}
        </select>
        <button className="btn wide" type="button" onClick={() => apply(autoFillPlan(data), "Prazni dani su popunjeni.")}>
          Popuni prazne dane
        </button>
        <button className="btn ghost wide" type="button" onClick={() => apply(newWeek(data), "Novi tjedan, ciklus pomaknut.")}>
          Novi tjedan
        </button>
        <p className="fhint">
          Sljedeći tjedan kreće od {next + 1}. dana ciklusa ({CYCLE[next].toLowerCase()}).
        </p>
      </div>

      <FGroup title="Ovaj tjedan">
        <dl className="kv">
          <div>
            <dt>Ručak i večera</dt>
            <dd>
              <b>{cooked}</b>/{planned} skuhano
              {planned < 7 && <small> · {7 - planned} prazno</small>}
            </dd>
          </div>
          <div>
            <dt>Doručak</dt>
            <dd>
              <b>{eaten}</b>/{bfPlanned.length} pojedeno
              {bfPlanned.length < 7 && <small> · {7 - bfPlanned.length} prazno</small>}
            </dd>
          </div>
          <div>
            <dt>Juha, salata i voće</dt>
            <dd>
              <b>{extraDone}</b>/{extraPlanned} pojedeno
            </dd>
          </div>
          <div>
            <dt>Protein u omletu</dt>
            <dd>{omPlanned.length ? <b>{avgProt} g</b> : "–"}</dd>
          </div>
          <div>
            <dt>Tjedan košta</dt>
            <dd>{weekCost > 0 ? <b>{eur(weekCost)}</b> : <small>upiši cijene u Zalihi</small>}</dd>
          </div>
          <div>
            <dt>Za kupiti</dt>
            <dd>
              <button type="button" className="linkbtn" onClick={goShop}>
                {shop ? `${stavki(shop)} →` : "ništa ne fali"}
              </button>
            </dd>
          </div>
        </dl>
      </FGroup>

      <FGroup title="Zadnje skuhano" open={false}>
        {data.hist.length ? (
          <ul className="hist">
            {data.hist.slice(0, 8).map((h, i) => (
              <li key={i}>
                <b>{recipeName(data, h.r)}</b>
                <span>{new Date(h.t).toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fhint">Još ništa. Kad skuhaš, pojavit će se ovdje.</p>
        )}
      </FGroup>
    </>
  );

  return (
    <Page
      id="plan"
      title="Plan"
      count={
        <>
          {dateOf(0)} – {dateOf(6)}
        </>
      }
      filters={side}
      filterTitle="Tjedan"
      tabs={
        <div className="seg" role="tablist" aria-label="Prikaz plana">
          <button type="button" role="tab" aria-selected={tab === "cal"} aria-pressed={tab === "cal"} onClick={() => setView("cal")}>
            Kalendar
          </button>
          <button type="button" role="tab" aria-selected={tab === "needs"} aria-pressed={tab === "needs"} onClick={() => setView("needs")}>
            Namirnice za tjedan <small>{needs.length}</small>
            {needShort > 0 && <span className="badge">{needShort}</span>}
          </button>
        </div>
      }
    >
      {tab === "needs" ? (
        <WeekNeeds data={data} />
      ) : (
        <>
      <div className="calwrap">
        <div className="cal" role="grid" aria-label="Tjedni kalendar obroka">
          <div className="corner" />
          {DAYS.map((d, ix) => (
            <div key={d} className={"ch" + (ix === tix ? " today" : "")} role="columnheader">
              <b>{d}</b>
              <small>{ix === tix ? "danas" : dateOf(ix)}</small>
            </div>
          ))}

          <div className="rh" role="rowheader">
            Doručak<small>bilo koji recept</small>
          </div>
          {plan.om.map((o, ix) => {
            if (!o.sel && !o.r)
              return (
                <div key={"o" + ix} role="gridcell">
                  <PickSelect label="Dodaj doručak" groups={breakfastGroups} onPick={(v) => pickBreakfast(ix, v)} />
                </div>
              );
            const isOm = !!o.sel && !o.r;
            const name = isOm ? omName(data, o.sel!) : recipeName(data, o.r!);
            const m = isOm ? omMacros(data, o.sel!, 1) : null;
            const e = !isOm ? mealEntry(data, o.r!) : null;
            const miss = o.done ? [] : isOm ? omMissing(data, o.sel!) : missingFor(data, o.r!, 1 / 1.5);
            return (
              <div key={"o" + ix} role="gridcell">
                <div className={"cell " + (isOm ? "cc-Omlet" : `cc-${recipeOf(data, o.r!)?.c ?? "Ostalo"}`) + (o.done ? " done" : "")}>
                  <div className="ctop">
                    {isOm && <span className="ctag">omlet</span>}
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Recept: ${name}`}
                      onClick={() => (isOm ? open({ t: "om", day: ix }) : open({ t: "meal", id: o.r! }))}
                    >
                      <Icon name="info" size={16} />
                    </button>
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Makni doručak: ${DAYS[ix]}`}
                      onClick={() => apply(setOmDay(data, ix, null), `Doručak maknut s dana ${DAYS[ix].toLowerCase()}.`)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <span className="cname">{name}</span>
                  <span className="cmeta">
                    {m ? `${m.p} g proteina · ${m.k} kcal` : e && e.kcal != null ? `${Math.round((e.kcal * 2) / 1.5)} kcal · 1 porcija` : "1 porcija"}
                  </span>
                  <div className="crow">
                    <span className={"flag " + (o.done ? "done" : miss.length ? "miss" : "ready")}>
                      {o.done ? "" : miss.length ? `fali ${miss.length}` : "imaš sve"}
                    </span>
                    {!o.done && <PickSelect swap label={`Zamijeni doručak: ${DAYS[ix]}`} groups={breakfastGroups} onPick={(v) => pickBreakfast(ix, v)} />}
                    <button
                      type="button"
                      className="tick-btn"
                      aria-pressed={o.done}
                      aria-label={`${o.done ? "Pojedeno" : "Pojeo sam"}: ${DAYS[ix]}, ${name}`}
                      onClick={() => toggleOm(ix)}
                    >
                      <Icon name="check" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {(["juha", "lunch", "salata", "voce1", "voce2"] as const).map((row) => {
            if (row === "lunch")
              return (
                <Fragment key="lunch">
                  <div className="rh" role="rowheader">
                    Ručak i večera<small>1,5 porcija</small>
                  </div>
                  {plan.days.map((d, ix) => {
                    const cyc = CYCLE[((plan.start || 0) + ix) % 5];
                    const r = d.r ? recipeOf(data, d.r) : undefined;
                    const groups = byCarb(mains).sort(([a], [b]) => (a === cyc ? -1 : b === cyc ? 1 : 0));
                    const pick = (id: string) => apply(setPlanDay(data, ix, id), `${recipeName(data, id)} za ${DAYS[ix].toLowerCase()}.`);
                    if (!r)
                      return (
                        <div key={"r" + ix} role="gridcell">
                          <PickSelect label="Dodaj recept" hint={`ciklus: ${cyc.toLowerCase()}`} groups={groups} onPick={pick} />
                        </div>
                      );
                    const m = !d.done ? missingFor(data, d.r) : [];
                    const e = mealEntry(data, d.r);
                    return (
                      <div key={"r" + ix} role="gridcell">
                        <div className={`cell cc-${r.c}` + (d.done ? " done" : "")}>
                          <div className="ctop">
                            <button type="button" className="mini" aria-label={`Recept: ${r.n}`} onClick={() => open({ t: "meal", id: r.id, day: ix })}>
                              <Icon name="info" size={16} />
                            </button>
                            <button
                              type="button"
                              className="mini"
                              aria-label={`Makni recept: ${DAYS[ix]}`}
                              onClick={() => apply(setPlanDay(data, ix, ""), `${r.n} maknut s dana ${DAYS[ix].toLowerCase()}.`)}
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </div>
                          <span className="cname">{r.n}</span>
                          {e && (e.kcal != null || e.time != null) && (
                            <span className="cmeta">
                              {e.kcal != null ? `${e.kcal} kcal · ${e.p} g prot.` : ""}
                              {e.kcal != null && e.time != null ? " · " : ""}
                              {e.time != null ? `${e.time} min` : ""}
                            </span>
                          )}
                          <div className="crow">
                            <span className={"flag " + (d.done ? "done" : m.length ? "miss" : "ready")}>
                              {d.done ? "" : m.length ? `fali ${m.length}` : "imaš sve"}
                            </span>
                            {!d.done && <PickSelect swap label={`Zamijeni recept: ${DAYS[ix]}`} groups={groups} onPick={pick} />}
                            <button
                              type="button"
                              className="tick-btn"
                              aria-pressed={d.done}
                              aria-label={`${d.done ? "Skuhano" : "Skuhaj"}: ${DAYS[ix]}, ${r.n}`}
                              onClick={() => toggleCook(ix)}
                            >
                              <Icon name="check" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              );
            const k: SlotKey = row;
            const isFruit = k === "voce1" || k === "voce2";
            const groups = isFruit ? fruitGroups : sideGroups(k as "juha" | "salata");
            const title = k === "juha" ? "Juha" : k === "salata" ? "Salata" : "Voće";
            const sub = k === "juha" ? "prije ručka" : k === "salata" ? "uz ručak i večeru" : k === "voce1" ? "1. komad" : "2. komad";
            return (
              <Fragment key={k}>
                <div className="rh small" role="rowheader">
                  {title}
                  <small>{sub}</small>
                </div>
                {plan.extra[k].map((x, ix) => {
                  const pick = (v: string) =>
                    isFruit ? pickFruit(k, ix, v) : apply(setSlot(data, k, ix, { r: v }), `${recipeName(data, v)} za ${DAYS[ix].toLowerCase()}.`);
                  if (!x.r && !x.item)
                    return (
                      <div key={k + ix} role="gridcell">
                        <PickSelect label={`Dodaj ${title.toLowerCase()}`} groups={groups} onPick={pick} />
                      </div>
                    );
                  const name = slotLabel(data, x);
                  const it = x.item ? itemOf(data, x.item) : undefined;
                  const miss = x.done ? 0 : Object.entries(slotUse(data, x, { ...data.prepStock }).use).filter(([id, a]) => qty(data, id) + 1e-9 < a).length;
                  return (
                    <div key={k + ix} role="gridcell">
                      <div className={"cell slot " + (isFruit ? "s-voce" : `s-${k}`) + (x.done ? " done" : "")}>
                        {x.r ? (
                          <button type="button" className="cname linkname" title="Otvori recept" onClick={() => open({ t: "meal", id: x.r! })}>
                            {name}
                          </button>
                        ) : (
                          <span className="cname">{name}</span>
                        )}
                        <div className="crow">
                          <span className={"flag " + (x.done ? "done" : miss ? "miss" : "muted")}>
                            {x.done ? "" : it ? `${fmt(x.qty ?? 1, it.u)}${miss ? " · nema" : ""}` : miss ? `fali ${miss}` : ""}
                          </span>
                          {!x.done && <PickSelect swap label={`Zamijeni: ${title}, ${DAYS[ix]}`} groups={groups} onPick={pick} />}
                          {!x.done && (
                            <button
                              type="button"
                              className="mini"
                              aria-label={`Makni: ${title}, ${DAYS[ix]}`}
                              onClick={() => apply(setSlot(data, k, ix, null), `${name} maknut s dana ${DAYS[ix].toLowerCase()}.`)}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="tick-btn small"
                            aria-pressed={x.done}
                            aria-label={`${x.done ? "Pojedeno" : "Pojeo sam"}: ${DAYS[ix]}, ${name}`}
                            onClick={() => {
                              const r = toggleSlot(data, k, ix);
                              apply(r.data, r.msg);
                            }}
                          >
                            <Icon name="check" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
      <p className="sub">
        Kvačica znači skuhano ili pojedeno i skida sastojke sa zalihe. <Icon name="info" size={14} /> otvara recept,{" "}
        <Icon name="swap" size={14} /> mijenja jelo, <Icon name="close" size={14} /> ga miče s dana. Uz ručak se skida i posni
        sir za užinu.
      </p>
        </>
      )}
    </Page>
  );
}

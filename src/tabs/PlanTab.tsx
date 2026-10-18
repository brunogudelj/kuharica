import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { CYCLE, DEFAULT_OM } from "../data";
import { useApp } from "../state/AppContext";
import { SLOT_KEYS, clone, cycleIx, getDay, getOm, getSlot } from "../state/model";
import { dayDate, dayLabel, dayName, todayKey, windowKeys } from "../logic/dates";
import type { AppData, SlotKey } from "../state/model";
import { costOf, dayCost, missingFor, qty, shopping, slotUse, weekNeeds } from "../logic/inventory";
import type { NeedRow } from "../logic/inventory";
import {
  autoFillPlan,
  clearAhead,
  cook,
  defaultFruitQty,
  eatOmlet,
  setCycleToday,
  setBreakfastRecipe,
  setOmDay,
  setPlanDay,
  setSlot,
  slotLabel,
  toggleSlot,
} from "../logic/actions";
import { allRecipes, recipeName, recipeOf } from "../logic/recipes";
import { allItems, itemOf } from "../logic/items";
import { omMacros, omMissing, omName, omPresets, omUse } from "../logic/omlet";
import { mealEntry } from "../logic/feed";
import { eur, fmt, stavki } from "../logic/format";
import { shopIndex, shopName } from "../logic/shops";
import { Icon } from "../components/icons";
import { usePanel } from "../components/Panel";
import { SortTh } from "../components/Cells";
import { FGroup, Page } from "../components/Page";

type NK = "n" | "shop" | "need" | "have" | "short" | "cost";

/** Namirnice koje traži plan za ovaj tjedan */
function WeekNeeds({ data }: { data: AppData }) {
  const { update } = useApp();
  const toShop = () =>
    update((d) => {
      const n = clone(d);
      n.ui.tab = "kupovina";
      n.ui.kupFocus = "plan";
      return n;
    });
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
      {
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
      }
      {short.length > 0 ? (
        <div className="needsbar">
          <span>
            {short.length === 1
              ? "Namirnica koja fali već je"
              : short.length <= 4
                ? `Sve ${short.length} namirnice koje fale već su`
                : `Svih ${short.length} namirnica koje fale već su`}{" "}
            na popisu za kupovinu, s količinom zaokruženom na cijela pakiranja.
          </span>
          <button type="button" className="btn" onClick={toShop}>
            <Icon name="kupovina" size={18} /> Otvori popis za kupovinu ({short.length})
          </button>
        </div>
      ) : (
        <p className="ready">Imaš sve za ovaj tjedan.</p>
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

/** Popunjen slot u kalendaru: naziv (klik otvara recept), opis, oznaka stanja, zamjena, brisanje, kvačica */
function Cell({
  cls,
  name,
  tag,
  meta,
  flag,
  flagCls,
  onOpen,
  swap,
  onRemove,
  done,
  onTick,
  tickLabel,
}: {
  cls: string;
  name: string;
  tag?: string;
  meta?: string;
  flag: string;
  flagCls: string;
  onOpen?: () => void;
  swap: ReactNode;
  onRemove: () => void;
  done: boolean;
  onTick: () => void;
  tickLabel: string;
}) {
  return (
    <div className={"cell slot " + cls + (done ? " done" : "")}>
      {tag && <span className="ctag">{tag}</span>}
      {onOpen ? (
        <button type="button" className="cname linkname" title="Otvori recept" onClick={onOpen}>
          {name}
        </button>
      ) : (
        <span className="cname">{name}</span>
      )}
      {meta && <span className="cmeta">{meta}</span>}
      {flag && <span className={"flag " + flagCls}>{flag}</span>}
      <div className="crow">
        {!done && swap}
        {!done && (
          <button type="button" className="mini" aria-label={`Makni: ${name}`} onClick={onRemove}>
            <Icon name="close" size={14} />
          </button>
        )}
        <button type="button" className="tick-btn small" aria-pressed={done} aria-label={tickLabel} onClick={onTick}>
          <Icon name="check" size={14} />
        </button>
      </div>
    </div>
  );
}

export function PlanTab() {
  const { data, apply, update } = useApp();
  const { open } = usePanel();
  const { plan } = data;
  const now = Date.now();
  const keys = windowKeys(now);
  const today = todayKey(now);
  const ahead = keys.filter((k) => k >= today);
  const shopDays = data.settings.shopDays || 7;

  const toggleCook = (k: string) => {
    const day = getDay(plan, k);
    if (day.done)
      return update((d) => {
        const n = clone(d);
        n.plan.days[k] = { r: day.r, done: false };
        return n;
      });
    const res = cook(data, day.r, k);
    apply(res.data, res.msg);
  };
  const toggleOm = (k: string) => {
    const o = getOm(plan, k);
    if (o.done)
      return update((d) => {
        const n = clone(d);
        n.plan.om[k] = { ...o, done: false };
        return n;
      });
    const r = eatOmlet(data, k);
    apply(r.data, r.msg);
  };

  const recipes = allRecipes(data);
  const mains = recipes.filter((r) => !r.side);
  const byCarb = (list: typeof recipes): OptGroup[] =>
    (["Riža", "Krumpir", "Tjestenina", "Ostalo"] as const).map((c) => [
      c,
      list.filter((r) => r.c === c).map((r): Opt => [r.id, r.n]),
    ]);
  const presets = omPresets(data);
  const breakfastGroups: OptGroup[] = [
    ["Omleti", presets.map((p, i): Opt => ["om:" + i, p.n])],
    ["Recepti (1 porcija)", mains.map((r): Opt => ["r:" + r.id, r.n])],
    ...(presets.length ? [["Složi sam", [["build", "Složi svoj omlet…"]]] as OptGroup] : []),
  ];
  const isSide = (r: (typeof recipes)[number], k: "juha" | "salata") => r.side === k || !!r.kinds?.includes(k);
  const sideGroups = (k: "juha" | "salata"): OptGroup[] => {
    const o: "juha" | "salata" = k === "juha" ? "salata" : "juha";
    return [
      [k === "juha" ? "Juhe" : "Salate", recipes.filter((r) => isSide(r, k)).map((r): Opt => [r.id, r.n])],
      [
        k === "juha" ? "Salate" : "Juhe",
        recipes.filter((r) => isSide(r, o) && !isSide(r, k)).map((r): Opt => [r.id, r.n]),
      ],
      [
        "Ostali recepti (1 porcija)",
        mains.filter((r) => !isSide(r, "juha") && !isSide(r, "salata")).map((r): Opt => [r.id, r.n]),
      ],
    ];
  };
  const fruits = allItems(data)
    .filter((i) => i.grp === "voce")
    .sort((x, y) => x.n.localeCompare(y.n, "hr"));
  const fruitGroups: OptGroup[] = [
    [
      "Imaš doma",
      fruits.filter((i) => qty(data, i.id) > 0).map((i): Opt => [i.id, `${i.n} (${fmt(qty(data, i.id), i.u)})`]),
    ],
    ["Ostalo voće", fruits.filter((i) => !(qty(data, i.id) > 0)).map((i): Opt => [i.id, i.n])],
  ];
  const pickBreakfast = (k: string, v: string) => {
    if (v === "build") return open({ t: "om", sel: DEFAULT_OM, day: k });
    if (v.startsWith("om:")) {
      const p = presets[Number(v.slice(3))];
      return apply(setOmDay(data, k, p.sel), `Doručak za ${dayLabel(k)}: ${p.n}.`);
    }
    const id = v.slice(2);
    apply(setBreakfastRecipe(data, k, id), `Doručak za ${dayLabel(k)}: ${recipeName(data, id)}.`);
  };
  const pickFruit = (s: SlotKey, k: string, id: string) => {
    const i = itemOf(data, id);
    if (i) apply(setSlot(data, s, k, { item: id, qty: defaultFruitQty(i) }), `${i.n} za ${dayLabel(k)}.`);
  };

  // brojke za razdoblje popisa za kupovinu (od danas)
  const horizon = ahead.slice(0, shopDays);
  const lunches = horizon.map((k) => getDay(plan, k)).filter((d) => d.r);
  const cooked = lunches.filter((d) => d.done).length;
  const bfs = horizon.map((k) => getOm(plan, k)).filter((o) => o.sel || o.r);
  const eaten = bfs.filter((o) => o.done).length;
  const oms = bfs.filter((o) => o.sel && !o.r);
  const avgProt = oms.length ? Math.round(oms.reduce((s, o) => s + omMacros(data, o.sel!, 1).p, 0) / oms.length) : 0;
  const extras = horizon.flatMap((k) => SLOT_KEYS.map((s) => getSlot(plan, s, k))).filter((x) => x.r || x.item);
  const weekCost =
    lunches.reduce((s, d) => s + dayCost(data, d.r).meals, 0) +
    bfs.reduce(
      (s, o) =>
        s +
        (o.r ? costOf(data, slotUse(data, { r: o.r, done: false }, {}).use).c : costOf(data, omUse(data, o.sel!, 1)).c),
      0,
    ) +
    extras.reduce((s, x) => s + (x.item ? costOf(data, slotUse(data, x, {}).use).c : 0), 0);
  const shop = shopping(data).length;
  const cyc = cycleIx(plan, today);

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
          Danas je u ciklusu
        </label>
        <select
          id="cycleStart"
          value={String(cyc)}
          onChange={(e) => apply(setCycleToday(data, Number(e.target.value)), "Ciklus je pomaknut.")}
        >
          {CYCLE.map((c, i) => (
            <option key={i} value={i}>
              {i + 1}. dan: {c}
            </option>
          ))}
        </select>
        <button
          className="btn wide"
          type="button"
          onClick={() => apply(autoFillPlan(data), "Prazni dani su popunjeni.")}
        >
          Popuni prazne dane
        </button>
        <button
          className="btn ghost wide"
          type="button"
          onClick={() => apply(clearAhead(data), "Plan od danas je očišćen.")}
        >
          Očisti plan od danas
        </button>
        <label htmlFor="shopDays" className="flabel">
          Popis za kupovinu pokriva
        </label>
        <select
          id="shopDays"
          value={String(shopDays)}
          onChange={(e) =>
            update((d) => {
              const n = clone(d);
              n.settings.shopDays = Number(e.target.value);
              return n;
            })
          }
        >
          {[3, 5, 7, 10, 13].map((n) => (
            <option key={n} value={n}>
              {n} dana od danas
            </option>
          ))}
        </select>
        <p className="fhint">Plan ide 14 dana: jučer, danas i 12 dana unaprijed. Sutra se pomakne za jedan dan.</p>
      </div>

      <FGroup title={`Sljedećih ${shopDays} dana`} open>
        <dl className="kv">
          <div>
            <dt>Ručak i večera</dt>
            <dd>
              <b>{cooked}</b>/{lunches.length} skuhano
              {lunches.length < shopDays && <small> · {shopDays - lunches.length} prazno</small>}
            </dd>
          </div>
          <div>
            <dt>Doručak</dt>
            <dd>
              <b>{eaten}</b>/{bfs.length} pojedeno
              {bfs.length < shopDays && <small> · {shopDays - bfs.length} prazno</small>}
            </dd>
          </div>
          <div>
            <dt>Juha, salata i voće</dt>
            <dd>
              <b>{extras.filter((x) => x.done).length}</b>/{extras.length} pojedeno
            </dd>
          </div>
          <div>
            <dt>Protein u omletu</dt>
            <dd>{oms.length ? <b>{avgProt} g</b> : "–"}</dd>
          </div>
          <div>
            <dt>Plan košta</dt>
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
                <span>
                  {new Date(h.t).toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fhint">Još ništa. Kad skuhaš, pojavit će se ovdje.</p>
        )}
      </FGroup>
    </>
  );

  const rowHead = (title: string, sub: string, small = false) => (
    <div className={"rh" + (small ? " small" : "")} role="rowheader">
      {title}
      <small>{sub}</small>
    </div>
  );
  const colCls = (k: string) => (k === today ? " today" : k < today ? " past" : "");

  return (
    <Page
      id="plan"
      title="Plan"
      count={
        <>
          {dayDate(keys[0])} – {dayDate(keys[keys.length - 1])}
        </>
      }
      filters={side}
      filterTitle="Plan"
      tabs={
        <div className="seg" role="tablist" aria-label="Prikaz plana">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cal"}
            aria-pressed={tab === "cal"}
            onClick={() => setView("cal")}
          >
            Kalendar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "needs"}
            aria-pressed={tab === "needs"}
            onClick={() => setView("needs")}
          >
            Namirnice za {shopDays} dana <small>{needs.length}</small>
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
            <div className="cal cal14" role="grid" aria-label="Kalendar obroka, 14 dana">
              <div className="corner" />
              {keys.map((k) => (
                <div key={k} className={"ch" + colCls(k)} role="columnheader">
                  <b>{k === today ? "Danas" : k < today ? "Jučer" : dayName(k)}</b>
                  <small>{dayDate(k)}</small>
                </div>
              ))}

              {rowHead("Doručak", "bilo koji recept")}
              {keys.map((k) => {
                const o = getOm(plan, k);
                if (!o.sel && !o.r)
                  return (
                    <div key={"o" + k} role="gridcell" className={colCls(k)}>
                      <PickSelect label="Dodaj doručak" groups={breakfastGroups} onPick={(v) => pickBreakfast(k, v)} />
                    </div>
                  );
                const isOm = !!o.sel && !o.r;
                const name = isOm ? omName(data, o.sel!) : recipeName(data, o.r!);
                const m = isOm ? omMacros(data, o.sel!, 1) : null;
                const e = !isOm ? mealEntry(data, o.r!) : null;
                const miss = o.done ? [] : isOm ? omMissing(data, o.sel!) : missingFor(data, o.r!, 1 / 1.5);
                return (
                  <div key={"o" + k} role="gridcell" className={colCls(k)}>
                    <Cell
                      cls={isOm ? "s-om" : `s-${recipeOf(data, o.r!)?.c ?? "Ostalo"}`}
                      name={name}
                      tag={isOm ? "omlet" : undefined}
                      meta={
                        m
                          ? `${m.p} g prot. · ${m.k} kcal`
                          : e?.kcal != null
                            ? `${Math.round((e.kcal * 2) / 1.5)} kcal · 1 porcija`
                            : "1 porcija"
                      }
                      flag={o.done ? "" : miss.length ? `fali ${miss.length}` : "imaš sve"}
                      flagCls={o.done ? "done" : miss.length ? "miss" : "ready"}
                      onOpen={() => (isOm ? open({ t: "om", day: k }) : open({ t: "meal", id: o.r! }))}
                      swap={
                        <PickSelect
                          swap
                          label={`Zamijeni doručak: ${dayLabel(k)}`}
                          groups={breakfastGroups}
                          onPick={(v) => pickBreakfast(k, v)}
                        />
                      }
                      onRemove={() => apply(setOmDay(data, k, null), `Doručak maknut (${dayLabel(k)}).`)}
                      done={o.done}
                      onTick={() => toggleOm(k)}
                      tickLabel={`${o.done ? "Pojedeno" : "Pojeo sam"}: ${dayLabel(k)}, ${name}`}
                    />
                  </div>
                );
              })}

              {(["juha", "lunch", "salata", "voce1", "voce2"] as const).map((row) => {
                if (row === "lunch")
                  return (
                    <Fragment key="lunch">
                      {rowHead("Ručak i večera", "1,5 porcija")}
                      {keys.map((k) => {
                        const cy = CYCLE[cycleIx(plan, k)];
                        const d = getDay(plan, k);
                        const r = d.r ? recipeOf(data, d.r) : undefined;
                        const groups = byCarb(mains).sort(([a], [b]) => (a === cy ? -1 : b === cy ? 1 : 0));
                        const pick = (id: string) =>
                          apply(setPlanDay(data, k, id), `${recipeName(data, id)} za ${dayLabel(k)}.`);
                        if (!r)
                          return (
                            <div key={"r" + k} role="gridcell" className={colCls(k)}>
                              <PickSelect
                                label="Dodaj recept"
                                hint={`ciklus: ${cy.toLowerCase()}`}
                                groups={groups}
                                onPick={pick}
                              />
                            </div>
                          );
                        const m = !d.done ? missingFor(data, d.r) : [];
                        const e = mealEntry(data, d.r);
                        return (
                          <div key={"r" + k} role="gridcell" className={colCls(k)}>
                            <Cell
                              cls={`s-${r.c}`}
                              name={r.n}
                              meta={
                                e && e.kcal != null
                                  ? `${e.kcal} kcal · ${e.p} g prot.${e.time != null ? ` · ${e.time} min` : ""}`
                                  : e?.time != null
                                    ? `${e.time} min`
                                    : undefined
                              }
                              flag={d.done ? "" : m.length ? `fali ${m.length}` : "imaš sve"}
                              flagCls={d.done ? "done" : m.length ? "miss" : "ready"}
                              onOpen={() => open({ t: "meal", id: r.id, day: k })}
                              swap={
                                <PickSelect
                                  swap
                                  label={`Zamijeni recept: ${dayLabel(k)}`}
                                  groups={groups}
                                  onPick={pick}
                                />
                              }
                              onRemove={() => apply(setPlanDay(data, k, ""), `${r.n} maknut (${dayLabel(k)}).`)}
                              done={d.done}
                              onTick={() => toggleCook(k)}
                              tickLabel={`${d.done ? "Skuhano" : "Skuhaj"}: ${dayLabel(k)}, ${r.n}`}
                            />
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                const s: SlotKey = row;
                const isFruit = s === "voce1" || s === "voce2";
                const groups = isFruit ? fruitGroups : sideGroups(s as "juha" | "salata");
                const title = s === "juha" ? "Juha" : s === "salata" ? "Salata" : "Voće";
                const sub =
                  s === "juha"
                    ? "prije ručka"
                    : s === "salata"
                      ? "uz ručak i večeru"
                      : s === "voce1"
                        ? "1. komad"
                        : "2. komad";
                return (
                  <Fragment key={s}>
                    {rowHead(title, sub, true)}
                    {keys.map((k) => {
                      const x = getSlot(plan, s, k);
                      const pick = (v: string) =>
                        isFruit
                          ? pickFruit(s, k, v)
                          : apply(setSlot(data, s, k, { r: v }), `${recipeName(data, v)} za ${dayLabel(k)}.`);
                      if (!x.r && !x.item)
                        return (
                          <div key={s + k} role="gridcell" className={colCls(k)}>
                            <PickSelect label={`Dodaj ${title.toLowerCase()}`} groups={groups} onPick={pick} />
                          </div>
                        );
                      const name = slotLabel(data, x);
                      const it = x.item ? itemOf(data, x.item) : undefined;
                      const miss = x.done
                        ? 0
                        : Object.entries(slotUse(data, x, { ...data.prepStock }).use).filter(
                            ([id, a]) => qty(data, id) + 1e-9 < a,
                          ).length;
                      return (
                        <div key={s + k} role="gridcell" className={colCls(k)}>
                          <Cell
                            cls={isFruit ? "s-voce" : `s-${s}`}
                            name={name}
                            flag={
                              x.done
                                ? ""
                                : it
                                  ? `${fmt(x.qty ?? 1, it.u)}${miss ? " · nema" : ""}`
                                  : miss
                                    ? `fali ${miss}`
                                    : ""
                            }
                            flagCls={x.done ? "done" : miss ? "miss" : "muted"}
                            onOpen={x.r ? () => open({ t: "meal", id: x.r! }) : undefined}
                            swap={
                              <PickSelect
                                swap
                                label={`Zamijeni: ${title}, ${dayLabel(k)}`}
                                groups={groups}
                                onPick={pick}
                              />
                            }
                            onRemove={() => apply(setSlot(data, s, k, null), `${name} maknut (${dayLabel(k)}).`)}
                            done={x.done}
                            onTick={() => {
                              const r = toggleSlot(data, s, k);
                              apply(r.data, r.msg);
                            }}
                            tickLabel={`${x.done ? "Pojedeno" : "Pojeo sam"}: ${dayLabel(k)}, ${name}`}
                          />
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
          <p className="sub">
            Klik na naziv otvara recept. Kvačica znači skuhano ili pojedeno i skida sastojke sa zalihe.{" "}
            <Icon name="swap" size={14} /> mijenja jelo, <Icon name="close" size={14} /> ga miče s dana.
            {data.settings.builtin !== false && " Uz ručak se skida i posni sir za užinu."}
          </p>
        </>
      )}
    </Page>
  );
}

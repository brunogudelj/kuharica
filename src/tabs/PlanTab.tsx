import { Fragment, useState } from "react";
import { CYCLE, DAYS } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { costOf, dayCost, missingFor, shopping, weekNeeds } from "../logic/inventory";
import type { NeedRow } from "../logic/inventory";
import { autoFillPlan, cook, eatOmlet, newWeek, setOmDay, setPlanDay } from "../logic/actions";
import { recipeName, recipeOf } from "../logic/recipes";
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
        n.plan.om[ix] = { sel: o.sel, done: false };
        return n;
      });
    const r = eatOmlet(data, ix);
    apply(r.data, r.msg);
  };

  const planned = plan.days.filter((d) => d.r).length;
  const cooked = plan.days.filter((d) => d.r && d.done).length;
  const omPlanned = plan.om.filter((o) => o.sel);
  const eaten = omPlanned.filter((o) => o.done).length;
  const avgProt = omPlanned.length
    ? Math.round(omPlanned.reduce((s, o) => s + omMacros(data, o.sel!, 1).p, 0) / omPlanned.length)
    : 0;
  const weekCost =
    plan.days.reduce((s, d) => s + (d.r ? dayCost(data, d.r).meals : 0), 0) +
    omPlanned.reduce((s, o) => s + costOf(data, omUse(data, o.sel!, 1)).c, 0);
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
            <dt>Omleti</dt>
            <dd>
              <b>{eaten}</b>/{omPlanned.length} pojedeno
              {omPlanned.length < 7 && <small> · {7 - omPlanned.length} prazno</small>}
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
      actions={
        <button className="btn" type="button" onClick={() => open({ t: "newRecipe" })}>
          <Icon name="plus" size={18} /> Novi recept
        </button>
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
            Doručak<small>omlet</small>
          </div>
          {plan.om.map((o, ix) => {
            if (!o.sel)
              return (
                <div key={"o" + ix} role="gridcell">
                  <button type="button" className="cell addcell" onClick={() => open({ t: "pickOm", day: ix })}>
                    <Icon name="plus" size={18} />
                    <span>Dodaj omlet</span>
                  </button>
                </div>
              );
            const m = omMacros(data, o.sel, 1);
            const miss = o.done ? [] : omMissing(data, o.sel);
            const name = omName(data, o.sel);
            return (
              <div key={"o" + ix} role="gridcell">
                <div className={"cell cc-Omlet" + (o.done ? " done" : "")}>
                  <div className="ctop">
                    <button type="button" className="mini" aria-label={`Recept: ${name}`} onClick={() => open({ t: "om", day: ix })}>
                      <Icon name="info" size={16} />
                    </button>
                    <button
                      type="button"
                      className="mini"
                      aria-label={`Makni omlet: ${DAYS[ix]}`}
                      onClick={() => apply(setOmDay(data, ix, null), `Omlet maknut s dana ${DAYS[ix].toLowerCase()}.`)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <span className="cname">{name}</span>
                  <span className="cmeta">
                    {m.p} g proteina · {m.k} kcal
                  </span>
                  <div className="crow">
                    <span className={"flag " + (o.done ? "done" : miss.length ? "miss" : "ready")}>
                      {o.done ? "" : miss.length ? `fali ${miss.length}` : "imaš sve"}
                    </span>
                    {!o.done && (
                      <button type="button" className="mini" aria-label={`Zamijeni omlet: ${DAYS[ix]}`} onClick={() => open({ t: "pickOm", day: ix })}>
                        <Icon name="swap" size={16} />
                      </button>
                    )}
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

          <div className="rh" role="rowheader">
            Ručak i večera<small>1,5 porcija</small>
          </div>
          {plan.days.map((d, ix) => {
            const cyc = CYCLE[((plan.start || 0) + ix) % 5];
            const r = d.r ? recipeOf(data, d.r) : undefined;
            if (!r)
              return (
                <div key={"r" + ix} role="gridcell">
                  <button type="button" className={`cell addcell cc-${cyc}`} onClick={() => open({ t: "pickMeal", day: ix })}>
                    <Icon name="plus" size={18} />
                    <span>Dodaj recept</span>
                    <small>dan ciklusa: {cyc.toLowerCase()}</small>
                  </button>
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
                      {e.kcal != null ? `${e.kcal} kcal · ${e.p} g proteina` : ""}
                      {e.kcal != null && e.time != null ? " · " : ""}
                      {e.time != null ? `${e.time} min` : ""}
                    </span>
                  )}
                  <div className="crow">
                    <span className={"flag " + (d.done ? "done" : m.length ? "miss" : "ready")}>
                      {d.done ? "" : m.length ? `fali ${m.length}` : "imaš sve"}
                    </span>
                    {!d.done && (
                      <button type="button" className="mini" aria-label={`Zamijeni recept: ${DAYS[ix]}`} onClick={() => open({ t: "pickMeal", day: ix })}>
                        <Icon name="swap" size={16} />
                      </button>
                    )}
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
        </div>
      </div>
      <p className="sub">
        Kvačica znači skuhano ili pojedeno i skida sastojke sa zalihe. <Icon name="info" size={14} /> otvara recept,{" "}
        <Icon name="swap" size={14} /> mijenja jelo, <Icon name="close" size={14} /> ga miče s dana.
      </p>
        </>
      )}
    </Page>
  );
}

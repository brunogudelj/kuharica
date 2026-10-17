import { CYCLE, DAYS } from "../data";
import type { Carb } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import { missingFor, shopping } from "../logic/inventory";
import { autoFillPlan, cook, eatOmlet, newWeek } from "../logic/actions";
import { allRecipes, recipeName, recipeOf } from "../logic/recipes";
import { omMacros, omMissing, omName } from "../logic/omlet";
import { stavki, todayIx } from "../logic/format";
import { Icon } from "../components/icons";

const CARBS: Carb[] = ["Riža", "Krumpir", "Tjestenina", "Ostalo"];
const LEGEND: [string, string][] = [
  ["Riža", "var(--dry-ink)"],
  ["Krumpir", "var(--fre-ink)"],
  ["Tjestenina", "var(--frz-ink)"],
  ["Omlet", "var(--accent)"],
];

/** Datum za dan u tjednu (0 = ponedjeljak ovog tjedna) */
function dateOf(ix: number) {
  const d = new Date();
  d.setDate(d.getDate() - todayIx() + ix);
  return d.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" });
}

export function PlanTab() {
  const { data, apply, update } = useApp();
  const { plan } = data;
  const tix = todayIx();
  const next = ((plan.start || 0) + 7) % 5;
  const recipes = allRecipes(data);

  const setDay = (ix: number, r: string) =>
    update((d) => {
      const n = clone(d);
      n.plan.days[ix] = { r, done: false };
      return n;
    });
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
  const openOmlet = (ix: number) =>
    update((d) => {
      const n = clone(d);
      n.ui.omDay = ix;
      n.ui.tab = "omlet";
      return n;
    });

  const cooked = plan.days.filter((d) => d.done).length;
  const planned = plan.days.filter((d) => d.r).length;
  const eaten = plan.om.filter((o) => o.done).length;
  const avgProt = Math.round(plan.om.reduce((s, o) => s + omMacros(data, o.sel, 1).p, 0) / 7);
  const shop = shopping(data).length;

  return (
    <section id="plan" aria-labelledby="tab-plan">
      <div className="toolbar">
        <label htmlFor="cycleStart" className="inline-label">
          Ciklus kreće od
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
        </label>
        <button className="btn" type="button" onClick={() => apply(autoFillPlan(data), "Tjedan je popunjen.")}>
          Popuni tjedan
        </button>
        <button className="btn ghost" type="button" onClick={() => apply(newWeek(data), "Novi tjedan, ciklus pomaknut.")}>
          Novi tjedan
        </button>
      </div>

      <div className="weekstats">
        <div>
          <b>
            {cooked}/{planned || 7}
          </b>
          <span>skuhano ovaj tjedan</span>
        </div>
        <div>
          <b>{eaten}/7</b>
          <span>omleta pojedeno</span>
        </div>
        <div>
          <b>{avgProt} g</b>
          <span>proteina u omletu, prosjek</span>
        </div>
        <div>
          <b>{shop}</b>
          <span>{shop ? `${stavki(shop).replace(/^\d+ /, "")} za kupiti` : "ništa ne fali"}</span>
        </div>
      </div>

      <div className="legend" aria-label="Legenda">
        {LEGEND.map(([l, c]) => (
          <span key={l}>
            <i style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>

      <div className="calwrap">
        <div className="cal" role="grid" aria-label="Tjedni kalendar obroka">
          <div className="corner" />
          {DAYS.map((d, ix) => (
            <div key={d} className={"ch" + (ix === tix ? " today" : "")} role="columnheader">
              {d} <small>{ix === tix ? "danas" : dateOf(ix)}</small>
            </div>
          ))}

          <div className="rh" role="rowheader">
            Doručak<small>omlet</small>
          </div>
          {plan.om.map((o, ix) => {
            const m = omMacros(data, o.sel, 1);
            const miss = o.done ? [] : omMissing(data, o.sel);
            return (
              <div key={"o" + ix} role="gridcell">
                <div className={"cell om" + (o.done ? " done" : "")}>
                  <button type="button" className="cbtn" onClick={() => openOmlet(ix)} title="Otvori omlet">
                    <span className="cname">{omName(data, o.sel)}</span>
                    <span className="cmeta">
                      {m.p} g prot · {m.k} kcal
                    </span>
                  </button>
                  <div className="crow">
                    <span className={"flag " + (o.done ? "ready" : miss.length ? "miss" : "ready")}>
                      {o.done ? "pojedeno" : miss.length ? `fali ${miss.length}` : "imaš sve"}
                    </span>
                    <button
                      type="button"
                      className="tick-btn"
                      aria-pressed={o.done}
                      aria-label={`${o.done ? "Pojedeno" : "Pojeo sam"}: ${DAYS[ix]}, ${omName(data, o.sel)}`}
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
            const m = r && !d.done ? missingFor(data, d.r) : [];
            return (
              <div key={"r" + ix} role="gridcell">
                <div className={`cell c-${r ? r.c : cyc}` + (r ? "" : " empty") + (d.done ? " done" : "")}>
                  <select
                    id={`day-${ix}`}
                    value={d.r}
                    onChange={(e) => setDay(ix, e.target.value)}
                    aria-label={`Recept za ${DAYS[ix]}`}
                  >
                    <option value="">+ {cyc}</option>
                    {CARBS.filter((c) => recipes.some((x) => x.c === c)).map((c) => (
                      <optgroup key={c} label={c}>
                        {recipes
                          .filter((x) => x.c === c)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.n}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  {r ? (
                    <>
                      <span className="cname">{r.n}</span>
                      <div className="crow">
                        <span className={"flag " + (d.done ? "ready" : m.length ? "miss" : "ready")}>
                          {d.done ? "skuhano" : m.length ? `fali ${m.length}` : "imaš sve"}
                        </span>
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
                    </>
                  ) : (
                    <span className="cmeta">dan ciklusa: {cyc.toLowerCase()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="sub">
        Kvačica u kalendaru znači skuhano ili pojedeno i skida sastojke sa zalihe. Dodir na omlet otvara njegov recept.
        Uz ručak i večeru idu velika salata i miso juha, a posni sir je užina. Sljedeći tjedan kreće od {next + 1}. dana
        ciklusa ({CYCLE[next].toLowerCase()}).
      </p>

      <div className="group">
        <h2>Zadnje skuhano</h2>
        <ul className="hist">
          {data.hist.length ? (
            data.hist.slice(0, 8).map((h, i) => (
              <li key={i}>
                {recipeName(data, h.r)} ·{" "}
                {new Date(h.t).toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" })}
              </li>
            ))
          ) : (
            <li>Još ništa. Kad skuhaš, pojavit će se ovdje.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

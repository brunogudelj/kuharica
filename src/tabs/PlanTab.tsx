import { CYCLE, DAYS, RBY, RECIPES } from "../data";
import type { Carb } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import { missingFor } from "../logic/inventory";
import { autoFillPlan, cook, newWeek } from "../logic/actions";
import { Note } from "../components/ui";

const CARBS: Carb[] = ["Riža", "Krumpir", "Tjestenina"];

export function PlanTab() {
  const { data, apply, update } = useApp();
  const { plan } = data;
  const next = ((plan.start || 0) + 7) % 5;

  const setDay = (ix: number, r: string) =>
    update((d) => {
      const n = clone(d);
      n.plan.days[ix] = { r, done: false };
      return n;
    });

  const toggleDone = (ix: number) => {
    const day = plan.days[ix];
    if (day.done) {
      update((d) => {
        const n = clone(d);
        n.plan.days[ix] = { r: day.r, done: false };
        return n;
      });
    } else {
      const res = cook(data, day.r, ix);
      apply(res.data, res.msg);
    }
  };

  return (
    <section id="plan" role="tabpanel" aria-labelledby="tab-plan">
      <Note>
        <strong>Isplaniraj tjedan</strong>, a kupovina sama zbroji što ti treba za planirane dane (uz miso, posni sir i
        salate). Kad skuhaš, stisni <strong>Skuhano</strong> i sastojci se skinu sa zalihe.
      </Note>
      <div className="ctrl">
        <label htmlFor="cycleStart">
          Prvi dan tjedna u ciklusu
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
        <button
          className="btn ghost"
          type="button"
          onClick={() => apply(newWeek(data), "Novi tjedan, ciklus pomaknut.")}
        >
          Novi tjedan
        </button>
      </div>

      <div className="list plan">
        {plan.days.map((d, ix) => {
          const cyc = CYCLE[((plan.start || 0) + ix) % 5];
          const m = d.r && RBY[d.r] && !d.done ? missingFor(data, d.r) : [];
          return (
            <div key={ix} className={"prow" + (d.done ? " done" : "")}>
              <div className="dname">
                {DAYS[ix]}
                <small>{cyc}</small>
              </div>
              <div className="pmid">
                <select
                  id={`day-${ix}`}
                  value={d.r}
                  onChange={(e) => setDay(ix, e.target.value)}
                  aria-label={`Recept za ${DAYS[ix]}`}
                >
                  <option value="">Nije planirano</option>
                  {CARBS.map((c) => (
                    <optgroup key={c} label={c}>
                      {RECIPES.filter((x) => x.c === c).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.n}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {d.r && RBY[d.r] ? (
                  d.done ? (
                    <span className="ready">Skuhano</span>
                  ) : m.length ? (
                    <span className="miss">Fali: {m.join(", ")}</span>
                  ) : (
                    <span className="ready">Sve imaš</span>
                  )
                ) : null}
              </div>
              {d.r ? (
                <button type="button" className={"cookbtn" + (d.done ? " on" : "")} onClick={() => toggleDone(ix)}>
                  {d.done ? "Skuhano ✓" : "Skuhano"}
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
      <p className="sub">
        Sljedeći tjedan kreće od {next + 1}. dana ciklusa ({CYCLE[next].toLowerCase()}).
      </p>

      <div className="group">
        <h2>Zadnje skuhano</h2>
        <ul className="hist">
          {data.hist.length ? (
            data.hist.slice(0, 8).map((h, i) => (
              <li key={i}>
                {RBY[h.r] ? RBY[h.r].n : h.r} ·{" "}
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

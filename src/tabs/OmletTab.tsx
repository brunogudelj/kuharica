import { useRef, useState } from "react";
import { BY, DAYS, OFBY, OM_BASE, OM_CARB, OM_PRESETS, OM_PROT, OM_VEG, PBY, PREP_INV } from "../data";
import type { OmSel } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import { costOf, pc, qty } from "../logic/inventory";
import {
  autoOmWeek,
  omEff,
  omIngredients,
  omMacros,
  omMissing,
  omName,
  omNorm,
  omSteps,
  omUse,
  surpriseSel,
  validOm,
} from "../logic/omlet";
import { eatMuffins, eatOmlet } from "../logic/actions";
import { eur, pfmt, porcTxt, scaleText, todayIx } from "../logic/format";
import { Html, Note } from "../components/ui";

export function OmletTab() {
  const { data, apply, update } = useApp();
  const tix = todayIx();
  const [omDay, setOmDay] = useState(tix);
  const [serv, setServ] = useState(1);
  const [method, setMethod] = useState<"wok" | "af">("wok");
  const titleRef = useRef<HTMLHeadingElement>(null);

  const week = data.plan.om;
  const day = week[omDay];
  const sel = day.sel;

  const setSel = (s: OmSel) =>
    update((d) => {
      const n = clone(d);
      n.plan.om[omDay] = { sel: validOm(s), done: n.plan.om[omDay].done };
      return n;
    });

  const pickDay = (ix: number) => {
    setOmDay(ix);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    titleRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };

  const mac = omMacros(sel, serv);
  const per = mac.p / serv;
  const eff = omEff(sel, serv, { ...data.prepStock });
  const miss = Object.entries(eff.use)
    .filter(([id, a]) => qty(data, id) + 1e-9 < a)
    .map(([id]) => BY[id].n);
  const cost = costOf(data, omUse(sel, serv));
  const pu = eff.consumed.map(([p, k]) => `${pfmt(k, PREP_INV[p].unit)} ${PBY[p].n.toLowerCase()}`);
  const mf = pc(data, "egg-muffini");

  const chip = (x: string) => (
    <button
      key={x}
      type="button"
      aria-pressed={sel.fill.includes(x)}
      onClick={() =>
        setSel({ ...sel, fill: sel.fill.includes(x) ? sel.fill.filter((y) => y !== x) : [...sel.fill, x] })
      }
    >
      {OFBY[x].n}
    </button>
  );

  return (
    <section id="omlet" role="tabpanel" aria-labelledby="tab-omlet">
      <Note>
        <strong>Omlet za doručak, svaki dan drugi.</strong> Tjedan se puni s 7 različitih kombinacija, a prednost imaju
        one za koje imaš sastojke. Dodirni dan da ga promijeniš. Kupovina računa sa svim omletima koje još nisi pojeo.
      </Note>

      <div className="group">
        <div className="ghead">
          <h2>Omleti ovaj tjedan</h2>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              apply({ ...clone(data), plan: { ...data.plan, om: autoOmWeek(data, true) } }, "Novi omleti za tjedan.")
            }
          >
            Novi omleti za tjedan
          </button>
        </div>
        <div className="list plan">
          {week.map((o, ix) => {
            const m = omMacros(o.sel, 1);
            const ms = o.done ? [] : omMissing(data, o.sel);
            return (
              <div key={ix} className={"prow omrow" + (o.done ? " done" : "") + (ix === omDay ? " sel" : "")}>
                <div className="dname">
                  {DAYS[ix]}
                  <small>{ix === tix ? "danas" : ""}</small>
                </div>
                <button type="button" className="pmid ompick" aria-pressed={ix === omDay} onClick={() => pickDay(ix)}>
                  <b>{omName(o.sel)}</b>
                  <span className="num">
                    {m.p} g proteina · {m.k} kcal
                  </span>
                  {o.done ? (
                    <span className="ready">Pojedeno</span>
                  ) : ms.length ? (
                    <span className="miss">Fali: {ms.join(", ")}</span>
                  ) : (
                    <span className="ready">Sve imaš</span>
                  )}
                </button>
                <span className="chev" aria-hidden="true">
                  {ix === omDay ? "●" : "›"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ghead">
        <h2 ref={titleRef}>
          Omlet za {DAYS[omDay].toLowerCase()}
          {omDay === tix ? " (danas)" : ""}
        </h2>
        <button type="button" className="btn ghost" onClick={() => setSel(surpriseSel(data))}>
          Iznenadi me
        </button>
      </div>

      <div className="group">
        <h4 className="omh">Gotove kombinacije</h4>
        <div className="presets">
          {OM_PRESETS.map((p, ix) => {
            const m = omMacros(p.sel, 1);
            const on = omNorm(p.sel) === omNorm(sel);
            const inWeek = week.some((o, j) => j !== omDay && omNorm(o.sel) === omNorm(p.sel));
            return (
              <button
                key={ix}
                type="button"
                className={"preset" + (on ? " on" : "")}
                aria-pressed={on}
                onClick={() => setSel(clone(p.sel))}
              >
                <b>{p.n}</b>
                <small>{p.d}</small>
                <span className="num">
                  {m.p} g proteina · {m.k} kcal{inWeek ? " · već u tjednu" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="group">
        <h4 className="omh">Ili složi svoj: baza</h4>
        <div className="filters">
          {Object.entries(OM_BASE).map(([k, b]) => (
            <button key={k} type="button" aria-pressed={sel.base === k} onClick={() => setSel({ ...sel, base: k })}>
              {b.n} <small>{b.d}</small>
            </button>
          ))}
        </div>
        <h4 className="omh">Protein</h4>
        <div className="filters">{OM_PROT.map(chip)}</div>
        <h4 className="omh">Povrće</h4>
        <div className="filters">{OM_VEG.map(chip)}</div>
        <h4 className="omh">Prilog</h4>
        <div className="filters">
          {Object.entries(OM_CARB).map(([k, c]) => (
            <button key={k} type="button" aria-pressed={sel.carb === k} onClick={() => setSel({ ...sel, carb: k })}>
              {c.n}
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <h2>{omName(sel)}</h2>
        <div className="summary four">
          <div>
            <b>{mac.p} g</b>
            <span>proteina</span>
            <small>
              {per >= 30 && per <= 45 ? (
                <span className="pill p-ok">cilj 30–40 g ✓</span>
              ) : per < 30 ? (
                <span className="pill p-low">ispod 30 g, dodaj protein</span>
              ) : (
                <span className="pill p-ok">jako proteinski</span>
              )}
            </small>
          </div>
          <div>
            <b>{mac.k}</b>
            <span>kcal (≈)</span>
          </div>
          <div>
            <b>{cost.known ? eur(cost.c) : "–"}</b>
            <span>cijena</span>
            <small>{cost.known ? `${cost.known}/${cost.total} ima cijenu` : "upiši cijene u Zalihi"}</small>
          </div>
          <div>
            <b>{porcTxt(serv)}</b>
            <span>porcije</span>
            <small>
              <span className="stepper inline">
                <button type="button" aria-label="Manje porcija" onClick={() => setServ(Math.max(0.5, serv - 0.5))}>
                  −
                </button>
                <button type="button" aria-label="Više porcija" onClick={() => setServ(Math.min(4, serv + 0.5))}>
                  +
                </button>
              </span>
            </small>
          </div>
        </div>
        {day.done ? (
          <p className="ready">Ovaj omlet je pojeden.</p>
        ) : miss.length ? (
          <p className="miss">Fali na zalihi: {miss.join(", ")}</p>
        ) : (
          <p className="ready">Imaš sve sastojke.</p>
        )}
        {pu.length > 0 && <p className="ready">Iz pripremljenog koristi: {pu.join(", ")}</p>}
        <div className="list omlist">
          <div className="rbody">
            <div>
              <h4>Sastojci za {porcTxt(serv)}</h4>
              <ul className="ing">
                {omIngredients(sel).map((i, k) => (
                  <Html key={k} as="li" html={scaleText(i, serv)} />
                ))}
              </ul>
            </div>
            <div className="filters" role="group" aria-label="Način pripreme">
              <button type="button" aria-pressed={method === "wok"} onClick={() => setMethod("wok")}>
                U woku · 8 min
              </button>
              <button type="button" aria-pressed={method === "af"} onClick={() => setMethod("af")}>
                Air fryer · 15 min
              </button>
            </div>
            <div>
              <h4>Priprema</h4>
              <ol>
                {omSteps(sel, method).map((x, k) => (
                  <li key={k}>{x}</li>
                ))}
              </ol>
            </div>
            {serv !== 1 && (
              <p className="prepline">Za {porcTxt(serv)} koristi veći wok ili kalup, ili peci jedan po jedan.</p>
            )}
            <div className="tip">
              Bjelanjci daju proteine skoro bez masti, pa su proteinska i lagana baza najbolji izbor za mršavljenje.
              Špek i kobasice koristi u malim količinama, za okus.
            </div>
            <div className="btnrow">
              {day.done ? (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      update((d) => {
                        const n = clone(d);
                        n.plan.om[omDay] = { sel, done: false };
                        return n;
                      })
                    }
                  >
                    Označi kao nepojeden
                  </button>
                  <span className="count">sastojci se ne vraćaju</span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const r = eatOmlet(data, omDay, serv);
                      apply(r.data, r.msg);
                    }}
                  >
                    Pojeo sam
                  </button>
                  <span className="count">skida sastojke sa zalihe</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {mf >= 4 && !day.done ? (
        <Note>
          <strong>Imaš {pfmt(mf, "muffin")}.</strong> Kad nemaš vremena, umjesto ovog omleta pojedi 4 egg muffina (oko
          28 g proteina).{" "}
          <button
            type="button"
            className="cookbtn"
            onClick={() => {
              const r = eatMuffins(data, omDay);
              apply(r.data, r.msg);
            }}
          >
            Pojeo 4 muffina
          </button>
        </Note>
      ) : mf < 4 ? (
        <p className="sub">
          Za jutra bez vremena napravi <strong>Egg muffine</strong> iz Prepa: 12 komada za 3 obroka.
        </p>
      ) : null}
    </section>
  );
}

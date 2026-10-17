/* Sadržaj panela: recept, omlet, prep, odabir recepta ili omleta za dan */
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { fetchPage, parseRecipeHtml, parseRecipeText, toDraft } from "../logic/importRecipe";
import { CLAUDE_MODEL, claudeRecipe, loadClaudeKey } from "../logic/claude";
import type { ParsedRecipe } from "../logic/importRecipe";
import { CYCLE, DAYS, DEFAULT_OM, OM_BASE, OM_CARB, OM_PRESETS, PBY, PREP, PREP_INV, REC_PREP } from "../data";
import type { OmSel } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { BASE_SERVINGS, effUse, pc, qty } from "../logic/inventory";
import { cook, eatMuffins, eatOmlet, removeRecipe, setOmDay, setPlanDay } from "../logic/actions";
import { allRecipes, recipeOf } from "../logic/recipes";
import { itemOf } from "../logic/items";
import {
  fillOf,
  omEff,
  omIngredients,
  omName,
  omNorm,
  omProt,
  omSteps,
  omVeg,
  surpriseSel,
  validOm,
} from "../logic/omlet";
import { KIND_LABEL, mealEntry, omEntry, prepEntry, sortFeed } from "../logic/feed";
import type { FeedEntry } from "../logic/feed";
import { eur, fmt, pfmt, porcTxt, scaleText, todayIx } from "../logic/format";
import { shopName } from "../logic/shops";
import { Html, Stepper } from "./ui";
import { Icon } from "./icons";
import { RecipeForm } from "./RecipeForm";
import { PrepBody } from "../tabs/PrepTab";
import { usePanel } from "./Panel";
import type { View } from "./Panel";

/** Datum za dan u tjednu (0 = ponedjeljak ovog tjedna) */
export function dateOf(ix: number) {
  const d = new Date();
  d.setDate(d.getDate() - todayIx() + ix);
  return d.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" });
}

const num = (v: number | null, suf = "") => (v == null ? "–" : v.toLocaleString("hr-HR") + suf);

/** Četiri broja recepta: kcal, proteini, cijena, vrijeme */
export function Stats({ e, per = true }: { e: FeedEntry; per?: boolean }) {
  const approx = e.macKnown > 0 && e.macKnown < e.items.length ? "≈ " : "";
  return (
    <dl className="stats">
      <div>
        <dt>
          <Icon name="flame" size={14} /> kcal
        </dt>
        <dd>{e.kcal == null ? "–" : approx + num(e.kcal)}</dd>
      </div>
      <div>
        <dt>
          <Icon name="muscle" size={14} /> protein
        </dt>
        <dd>{num(e.p, " g")}</dd>
      </div>
      <div>
        <dt>
          <Icon name="euro" size={14} /> cijena
        </dt>
        <dd>{e.cost == null ? "–" : eur(e.cost)}</dd>
      </div>
      <div>
        <dt>
          <Icon name="clock" size={14} /> vrijeme
        </dt>
        <dd>{e.time == null ? "–" : e.time + " min"}</dd>
      </div>
      {per && (
        <p className="stats-note">{e.kind === "meal" ? "po obroku" : e.kind === "om" ? "po omletu" : "cijela tura"}</p>
      )}
    </dl>
  );
}

/** Traka dostupnosti sastojaka */
export function Avail({ e }: { e: FeedEntry }) {
  const all = e.total > 0 && e.have >= e.total;
  return (
    <div className={"avail" + (all ? " full" : "")}>
      <span className="avail-bar" aria-hidden="true">
        <i style={{ width: `${e.total ? (e.have / e.total) * 100 : 0}%` }} />
      </span>
      <span>{all ? "Imaš sve" : `Imaš ${e.have} od ${e.total}`}</span>
    </div>
  );
}

export function Chips({ e }: { e: FeedEntry }) {
  return (
    <div className="chips">
      {e.carb && <span className={`chip carb-chip cc-${e.carb.replace(/\s/g, "")}`}>{e.carb}</span>}
      {e.prot.slice(0, 3).map((p) => (
        <span key={p} className="chip">
          {p}
        </span>
      ))}
      {e.two && <span className="chip">2 u 1</span>}
      {e.custom && <span className="chip mine">moj</span>}
    </div>
  );
}

/** Kartica recepta u feedu */
export function FeedCard({ e, onOpen }: { e: FeedEntry; onOpen: () => void }) {
  return (
    <button type="button" className={`rcard k-${e.kind} cc-${e.carb.replace(/\s/g, "") || "none"}`} onClick={onOpen}>
      <span className="rcard-band">
        <span>{KIND_LABEL[e.kind]}</span>
        <span>{e.method}</span>
      </span>
      <span className="rcard-name">{e.n}</span>
      <span className="rcard-desc">{e.d}</span>
      <Stats e={e} />
      <Chips e={e} />
      <Avail e={e} />
    </button>
  );
}

/** Odabir dana u tjednu */
function DayPicker({
  on,
  onPick,
  label,
}: {
  on: (ix: number) => boolean;
  onPick: (ix: number) => void;
  label: string;
}) {
  const t = todayIx();
  return (
    <div className="daypick" role="group" aria-label={label}>
      {DAYS.map((d, ix) => (
        <button
          key={d}
          type="button"
          aria-pressed={on(ix)}
          className={ix === t ? "today" : ""}
          onClick={() => onPick(ix)}
        >
          <b>{d}</b>
          <small>{dateOf(ix)}</small>
        </button>
      ))}
    </div>
  );
}

/** Popis namirnica iz zalihe: treba, imaš, status */
function StockList({ data, use }: { data: AppData; use: Record<string, number> }) {
  return (
    <table className="grid compact stocklist">
      <thead>
        <tr>
          <th>Namirnica</th>
          <th className="num">Treba</th>
          <th className="num">Imaš</th>
          <th>Dućan</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(use).map(([id, a]) => {
          const i = itemOf(data, id);
          if (!i) return null;
          const ok = qty(data, id) + 1e-9 >= a;
          return (
            <tr key={id} className={ok ? "" : "st-out"}>
              <td className="namecell">
                <span className={"dot " + (ok ? "ok" : "out")} aria-hidden="true" />
                {i.n}
                <span className="sr-only">{ok ? " (imaš)" : " (fali)"}</span>
              </td>
              <td className="num">{fmt(a, i.u)}</td>
              <td className="num">{fmt(qty(data, id), i.u)}</td>
              <td className="muted">{shopName(data, i.src)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Head({ e, kicker }: { e: FeedEntry; kicker?: string }) {
  return (
    <header className="phead">
      <p className="kicker">
        {KIND_LABEL[e.kind]}
        {e.method ? ` · ${e.method}` : ""}
        {kicker ? ` · ${kicker}` : ""}
      </p>
      <h2 className="pname">{e.n}</h2>
      {e.d && <p className="sub">{e.d}</p>}
      <Chips e={e} />
    </header>
  );
}

export function MealView({ id, day }: { id: string; day?: number }) {
  const { data, apply, update } = useApp();
  const { open, close } = usePanel();
  const [confirmDel, setConfirmDel] = useState(false);
  const r = recipeOf(data, id);
  const e = mealEntry(data, id);
  if (!r || !e) return <p className="sub">Recept više ne postoji.</p>;
  const s = data.ui.servings[r.id] ?? BASE_SERVINGS;
  const f = s / BASE_SERVINGS;
  const eff = effUse(r, { ...data.prepStock }, false, f);
  const pu = eff.consumed.map(([p, k]) => `${pfmt(k, PREP_INV[p].unit)} ${PBY[p].n.toLowerCase()}`);
  const own = r.custom ? data.recipes.find((x) => x.id === r.id) : undefined;
  const setS = (v: number) =>
    update((d) => {
      const n = clone(d);
      n.ui.servings[r.id] = Math.min(6, Math.max(0.5, v));
      return n;
    });
  const planIx = day != null && data.plan.days[day]?.r === id ? day : null;

  return (
    <div className="pbody">
      <Head e={e} kicker={day != null ? DAYS[day] : undefined} />
      <Stats e={e} />
      <section className="psec">
        <h3>U planu</h3>
        <DayPicker
          label="Stavi recept na dan"
          on={(ix) => data.plan.days[ix].r === id}
          onPick={(ix) =>
            data.plan.days[ix].r === id
              ? update((d) => setPlanDay(d, ix, ""))
              : apply(setPlanDay(data, ix, id), `${r.n} je na planu za ${DAYS[ix].toLowerCase()}.`)
          }
        />
      </section>
      <section className="psec">
        <div className="rowspread">
          <h3>Porcije</h3>
          <Stepper label="porcije" value={porcTxt(s)} onDec={() => setS(s - 0.5)} onInc={() => setS(s + 0.5)} />
        </div>
        <p className="sub">1,5 porcija je ručak i večera iz jednog kuhanja. Uz to idu salata, miso juha i posni sir.</p>
      </section>
      {r.split && (
        <div className="split">
          {r.split.map((x, i) => (
            <Html key={i} as="div" html={x} />
          ))}
        </div>
      )}
      <section className="psec">
        <h3>Iz zalihe</h3>
        <StockList data={data} use={eff.use} />
        {pu.length > 0 && <p className="ready">Iz pripremljenog koristi: {pu.join(", ")}</p>}
        {REC_PREP[r.id] && (
          <p className="prepline">
            Brže uz prep:{" "}
            {REC_PREP[r.id].map((p, i) => (
              <span key={p}>
                {i > 0 && ", "}
                <button type="button" className="linkbtn" onClick={() => open({ t: "prep", id: p })}>
                  {PBY[p].n}
                </button>
              </span>
            ))}
          </p>
        )}
      </section>
      <section className="psec">
        <h3>Sastojci za {porcTxt(s)}</h3>
        <ul className="ing">
          {r.ing.map((i, k) => (
            <Html key={k} as="li" html={scaleText(i, f)} />
          ))}
        </ul>
      </section>
      <section className="psec">
        <h3>Priprema</h3>
        {r.st.length ? (
          <ol className="steps">
            {r.st.map((x, k) => (
              <li key={k}>{x}</li>
            ))}
          </ol>
        ) : (
          <p className="sub">Koraci nisu upisani.</p>
        )}
      </section>
      <div className="pactions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const res = cook(data, r.id, planIx, f);
            apply(res.data, res.msg);
            close();
          }}
        >
          <Icon name="check" size={18} /> Skuhao sam
        </button>
        <span className="count">skida {porcTxt(s)} i dnevne dodatke sa zalihe</span>
      </div>
      {own && (
        <div className="btnrow">
          <button type="button" className="btn ghost" onClick={() => open({ t: "editRecipe", id: r.id })}>
            <Icon name="edit" size={16} /> Uredi recept
          </button>
          {confirmDel ? (
            <>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const res = removeRecipe(data, r.id);
                  apply(res.data, res.msg);
                  close();
                }}
              >
                Da, obriši
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>
                Odustani
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={16} /> Obriši
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function OmView({ sel: initSel, day, n }: { sel?: OmSel; day?: number; n?: string }) {
  const { data, apply, update } = useApp();
  const { close } = usePanel();
  const [local, setLocal] = useState<OmSel>(() => clone(initSel ?? DEFAULT_OM));
  const [serv, setServ] = useState(1);
  const [method, setMethod] = useState<"wok" | "af">("wok");
  const planDay = day != null ? data.plan.om[day] : undefined;
  const sel = planDay?.sel ?? local;
  const setSel = (s: OmSel) => {
    const v = validOm(s);
    if (day != null && planDay?.sel)
      update((d) => {
        const x = clone(d);
        x.plan.om[day] = { sel: v, done: x.plan.om[day].done };
        return x;
      });
    else setLocal(v);
  };
  const preset = OM_PRESETS.find((p) => omNorm(p.sel) === omNorm(sel));
  const e = omEntry(data, sel, "om", n && preset ? preset.n : omName(data, sel), preset?.d ?? "vlastita kombinacija");
  const eff = omEff(data, sel, serv, { ...data.prepStock });
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
      {fillOf(data, x)?.n}
    </button>
  );

  return (
    <div className="pbody">
      <Head e={e} kicker={day != null ? `doručak, ${DAYS[day].toLowerCase()}` : undefined} />
      <Stats e={e} />
      <section className="psec">
        <h3>U planu</h3>
        <DayPicker
          label="Stavi omlet na dan"
          on={(ix) => !!data.plan.om[ix].sel && omNorm(data.plan.om[ix].sel!) === omNorm(sel)}
          onPick={(ix) => apply(setOmDay(data, ix, sel), `${e.n} je doručak za ${DAYS[ix].toLowerCase()}.`)}
        />
      </section>
      <details className="psec builder" open={day != null && !planDay?.sel}>
        <summary>
          <h3>Prilagodi sastojke</h3>
          <Icon name="chev" size={18} />
        </summary>
        <h4>Baza</h4>
        <div className="filters">
          {Object.entries(OM_BASE).map(([k, b]) => (
            <button key={k} type="button" aria-pressed={sel.base === k} onClick={() => setSel({ ...sel, base: k })}>
              {b.n}
            </button>
          ))}
        </div>
        <h4>Protein</h4>
        <div className="filters">{omProt(data).map(chip)}</div>
        <h4>Povrće</h4>
        <div className="filters">{omVeg(data).map(chip)}</div>
        <h4>Prilog</h4>
        <div className="filters">
          {Object.entries(OM_CARB).map(([k, c]) => (
            <button key={k} type="button" aria-pressed={sel.carb === k} onClick={() => setSel({ ...sel, carb: k })}>
              {c.n}
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={() => setSel(surpriseSel(data))}>
          Iznenadi me
        </button>
      </details>
      <section className="psec">
        <div className="rowspread">
          <h3>Porcije</h3>
          <Stepper
            label="porcije"
            value={porcTxt(serv)}
            onDec={() => setServ(Math.max(0.5, serv - 0.5))}
            onInc={() => setServ(Math.min(4, serv + 0.5))}
          />
        </div>
      </section>
      <section className="psec">
        <h3>Iz zalihe</h3>
        <StockList data={data} use={eff.use} />
      </section>
      <section className="psec">
        <h3>Sastojci za {porcTxt(serv)}</h3>
        <ul className="ing">
          {omIngredients(data, sel).map((i, k) => (
            <Html key={k} as="li" html={scaleText(i, serv)} />
          ))}
        </ul>
      </section>
      <section className="psec">
        <div className="rowspread">
          <h3>Priprema</h3>
          <div className="seg" role="group" aria-label="Način pripreme">
            <button type="button" aria-pressed={method === "wok"} onClick={() => setMethod("wok")}>
              Wok · 8 min
            </button>
            <button type="button" aria-pressed={method === "af"} onClick={() => setMethod("af")}>
              Air fryer · 15 min
            </button>
          </div>
        </div>
        <ol className="steps">
          {omSteps(data, sel, method).map((x, k) => (
            <li key={k}>{x}</li>
          ))}
        </ol>
        <div className="tip">
          Bjelanjci daju proteine skoro bez masti, pa su proteinska i lagana baza najbolji izbor za mršavljenje. Špek i
          kobasice koristi u malim količinama, za okus.
        </div>
      </section>
      {day != null && planDay?.sel && (
        <div className="pactions">
          {planDay.done ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                update((d) => {
                  const x = clone(d);
                  x.plan.om[day] = { sel, done: false };
                  return x;
                })
              }
            >
              Označi kao nepojeden
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const r = eatOmlet(data, day, serv);
                  apply(r.data, r.msg);
                  close();
                }}
              >
                <Icon name="check" size={18} /> Pojeo sam
              </button>
              {mf >= 4 && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const r = eatMuffins(data, day);
                    apply(r.data, r.msg);
                    close();
                  }}
                >
                  Umjesto toga 4 egg muffina
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PrepView({ id }: { id: string }) {
  const { data } = useApp();
  const p = PREP.find((x) => x.id === id);
  const e = prepEntry(data, id);
  if (!p || !e) return null;
  return (
    <div className="pbody">
      <Head e={e} />
      <Stats e={e} />
      <PrepBody p={p} />
    </div>
  );
}

/** Odabir recepta za dan u planu */
export function PickMeal({ day }: { day: number }) {
  const { data, apply, update } = useApp();
  const { open, close } = usePanel();
  const [q, setQ] = useState("");
  const cyc = CYCLE[((data.plan.start || 0) + day) % 5];
  const cur = data.plan.days[day];
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = sortFeed(
      allRecipes(data)
        .map((r) => mealEntry(data, r.id))
        .filter((e): e is FeedEntry => !!e && (!t || e.n.toLowerCase().includes(t))),
      "pre",
    );
    return [...all.filter((e) => e.carb === cyc), ...all.filter((e) => e.carb !== cyc)];
  }, [data, q, cyc]);

  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">
          Ručak i večera · {DAYS[day]} {dateOf(day)}
        </p>
        <h2 className="pname">Odaberi recept</h2>
        <p className="sub">Dan ciklusa: {cyc.toLowerCase()}. Recepti s tim prilogom su prvi.</p>
      </header>
      <div className="searchbox">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Traži recept"
          aria-label="Traži recept"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <div className="picklist">
        {list.map((e) => (
          <button
            key={e.key}
            type="button"
            className={"pickrow" + (cur.r === e.id ? " on" : "")}
            onClick={() => {
              apply(setPlanDay(data, day, e.id), `${e.n} je na planu za ${DAYS[day].toLowerCase()}.`);
              close();
            }}
          >
            <span className="pickname">{e.n}</span>
            <span className="pickmeta">
              {e.carb} · {e.kcal != null ? `${e.kcal} kcal · ` : ""}
              {e.p != null ? `${e.p} g proteina · ` : ""}
              {e.d}
            </span>
            <Avail e={e} />
          </button>
        ))}
      </div>
      <div className="pactions">
        <button type="button" className="btn ghost" onClick={() => open({ t: "newRecipe", day })}>
          <Icon name="plus" size={18} /> Novi recept za ovaj dan
        </button>
        {cur.r && (
          <button
            type="button"
            className="btn ghost danger"
            onClick={() => {
              update((d) => setPlanDay(d, day, ""));
              close();
            }}
          >
            Makni s dana
          </button>
        )}
      </div>
    </div>
  );
}

/** Odabir omleta za dan */
export function PickOm({ day }: { day: number }) {
  const { data, apply, update } = useApp();
  const { open, close } = usePanel();
  const cur = data.plan.om[day];
  const list = OM_PRESETS.map((p, i) => omEntry(data, p.sel, "o:" + i, p.n, p.d, String(i)));
  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">
          Doručak · {DAYS[day]} {dateOf(day)}
        </p>
        <h2 className="pname">Odaberi omlet</h2>
      </header>
      <div className="picklist">
        {sortFeed(list, "pre").map((e) => (
          <button
            key={e.key}
            type="button"
            className={"pickrow" + (cur.sel && omNorm(cur.sel) === omNorm(e.sel!) ? " on" : "")}
            onClick={() => {
              apply(setOmDay(data, day, e.sel!), `${e.n} je doručak za ${DAYS[day].toLowerCase()}.`);
              close();
            }}
          >
            <span className="pickname">{e.n}</span>
            <span className="pickmeta">
              {e.kcal} kcal · {e.p} g proteina · {e.d}
            </span>
            <Avail e={e} />
          </button>
        ))}
      </div>
      <div className="pactions">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const s = surpriseSel(data);
            update((d) => setOmDay(d, day, s));
            open({ t: "om", day });
          }}
        >
          <Icon name="plus" size={18} /> Složi svoj omlet
        </button>
        {cur.sel && (
          <button
            type="button"
            className="btn ghost danger"
            onClick={() => {
              update((d) => setOmDay(d, day, null));
              close();
            }}
          >
            Makni s dana
          </button>
        )}
      </div>
    </div>
  );
}

/** Što panel prikazuje */
export function renderView(v: View) {
  switch (v.t) {
    case "meal":
      return <MealView key={v.id} id={v.id} day={v.day} />;
    case "om":
      return <OmView key={(v.day ?? "x") + (v.sel ? omNorm(v.sel) : "")} sel={v.sel} day={v.day} n={v.n} />;
    case "prep":
      return <PrepView key={v.id} id={v.id} />;
    case "pickMeal":
      return <PickMeal key={v.day} day={v.day} />;
    case "pickOm":
      return <PickOm key={v.day} day={v.day} />;
    case "newRecipe":
      return <NewRecipe day={v.day} />;
    case "editRecipe":
      return <EditRecipe id={v.id} />;
    case "importRecipe":
      return <ImportRecipe />;
  }
}

/** Recept iz linka (ili zalijepljenog teksta): povuci podatke pa ih provjeri u obrascu */
function ImportRecipe() {
  const { data, update } = useApp();
  const { close } = usePanel();
  const key = loadClaudeKey();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<ReturnType<typeof toDraft> | null>(null);

  const fromParsed = (p: ParsedRecipe | null) => {
    if (!p || !p.ingredients.length) {
      setErr("Na stranici nisam našao recept. Kopiraj tekst recepta i zalijepi ga ispod.");
      setShowText(true);
      return;
    }
    setErr("");
    setRes(toDraft(data, p));
  };

  const viaClaude = async (src: { url?: string; text?: string }) => {
    setBusy(true);
    setErr("");
    try {
      const r = await claudeRecipe(data, key, src);
      setRes(toDraft(data, r.parsed, r));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Claude nije uspio pročitati recept.");
      if (src.url) setShowText(true);
    } finally {
      setBusy(false);
    }
  };

  const pull = async (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return setErr("Upiši cijeli link, npr. https://www.coolinarika.com/recept/…");
    if (key) return viaClaude({ url: u });
    setBusy(true);
    setErr("");
    try {
      const html = await fetchPage(u);
      fromParsed(parseRecipeHtml(html, u));
    } catch {
      setErr(
        "Stranicu nije bilo moguće dohvatiti bez Claudea. Dodaj Claude API ključ u Postavkama ili zalijepi tekst recepta ispod.",
      );
      setShowText(true);
    } finally {
      setBusy(false);
    }
  };

  const goSettings = () => {
    close();
    update((d) => {
      const n = clone(d);
      n.ui.tab = "postavke";
      n.ui.psTab = "claude";
      return n;
    });
  };

  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">Recepti</p>
        <h2 className="pname">Recept iz linka</h2>
        <p className="sub">
          Zalijepi link na recept. {key ? "Claude dohvati stranicu i složi recept" : "Povuku se"} naziv, sastojci,
          koraci, vrijeme i porcije, a sastojci se spoje s namirnicama iz zalihe. Sve provjeriš prije spremanja.
        </p>
      </header>
      {!res && (
        <>
          <form className="importform" onSubmit={pull}>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…"
              aria-label="Link na recept"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn" disabled={busy}>
              {busy ? (key ? "Claude čita recept…" : "Povlačim…") : "Povuci recept"}
            </button>
          </form>
          {busy && key && <p className="fhint">Obično traje 10 do 30 sekundi.</p>}
          {err && <p className="miss">{err}</p>}
          {showText ? (
            <div className="edit one">
              <label htmlFor="impText">
                Tekst recepta (naziv u prvom retku, pa sastojci i priprema)
                <textarea id="impText" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <div className="btnrow">
                <button
                  type="button"
                  className="btn"
                  disabled={!text.trim() || busy}
                  onClick={() => (key ? viaClaude({ text }) : fromParsed(parseRecipeText(text)))}
                >
                  Pročitaj tekst
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="linkbtn" onClick={() => setShowText(true)}>
              ili zalijepi tekst recepta
            </button>
          )}
          {key ? (
            <p className="fhint">
              Ide preko tvog Claude API ključa ({CLAUDE_MODEL}). Jedan recept košta oko 1 do 5 centi.
            </p>
          ) : (
            <div className="note">
              <b>Za pouzdano povlačenje s bilo koje stranice</b> dodaj Claude API ključ. Claude tada sam dohvati
              stranicu, prevede recept na hrvatski i spoji sastojke s tvojim namirnicama.{" "}
              <button type="button" className="linkbtn" onClick={goSettings}>
                Postavke → Claude
              </button>
            </div>
          )}
        </>
      )}
      {res && (
        <>
          <div className="importsum">
            <b>
              Prepoznato {res.matched} od {res.lines.length} sastojaka
            </b>
            <span className="sub">
              Neprepoznati su u polju „Ostalo”. Za njih odaberi namirnicu ili ih ostavi kao bilješku.
            </span>
            <table className="grid compact">
              <tbody>
                {res.lines.map((l, k) => (
                  <tr key={k} className={l.item ? "" : "st-out"}>
                    <td className="namecell">
                      <span className={"dot " + (l.item ? "ok" : "out")} aria-hidden="true" />
                      {l.raw}
                    </td>
                    <td className="muted">
                      {l.item ? `→ ${l.item.n}${l.amount ? ` · ${fmt(l.amount, l.item.u)}` : ""}` : "nije prepoznato"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RecipeForm draft={res.draft} onDone={close} />
        </>
      )}
    </div>
  );
}

function NewRecipe({ day }: { day?: number }) {
  const { close } = usePanel();
  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">{day != null ? `Ručak i večera · ${DAYS[day]}` : "Recepti"}</p>
        <h2 className="pname">Novi recept</h2>
        <p className="sub">Namirnice biraš iz zalihe, pa recept zna što skinuti kad ga skuhaš.</p>
      </header>
      <RecipeForm planDay={day} onDone={close} />
    </div>
  );
}

function EditRecipe({ id }: { id: string }) {
  const { data } = useApp();
  const { open } = usePanel();
  const own = data.recipes.find((x) => x.id === id);
  if (!own) return <p className="sub">Recept više ne postoji.</p>;
  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">Uredi recept</p>
        <h2 className="pname">{own.n}</h2>
      </header>
      <RecipeForm existing={own} onDone={() => open({ t: "meal", id })} />
    </div>
  );
}

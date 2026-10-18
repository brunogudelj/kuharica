/* Jedan obrazac za recept i prep: naziv, vrsta jela, dijelovi (drugi recepti i prep), namirnice, ostalo, koraci.
   Prep je recept koji se radi unaprijed, pa ima još: vrstu prepa, koliko daje jedna tura i kako se čuva. */
import { useState } from "react";
import type { FormEvent } from "react";
import { PREP_K, UNITS } from "../data";
import type { Carb, CustomPrep, CustomRecipe, PrepCat, UnitId } from "../data";
import { dayLabel } from "../logic/dates";
import { allPreps, newPrepId, prepName, prepUnit, saveCustomPrep } from "../logic/preps";
import { plural, round } from "../logic/format";
import { useApp } from "../state/AppContext";
import { allItems, itemOf } from "../logic/items";
import { catOpts, kindOpts } from "../logic/lists";
import { allRecipes, newRecipeId, recipeName } from "../logic/recipes";
import { saveRecipe, setPlanDay } from "../logic/actions";
import { BASE_SERVINGS } from "../logic/inventory";
import { ItemForm } from "./ItemForm";

const CARBS: [Carb, string][] = [
  ["Riža", "Riža"],
  ["Krumpir", "Krumpir"],
  ["Tjestenina", "Tjestenina"],
  ["Ostalo", "Ostalo (ne ulazi u ciklus)"],
];
const parse = (s: string) => parseFloat(s.replace(",", "."));
const show = (n: number) => String(round(n)).replace(".", ",");
const lines = (t: string) =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

interface Row {
  key: number;
  /** namirnica; u dijelovima: id recepta, "p:<id>" prep ili "pi:<id>" prep čiji su sirovi sastojci već u namirnicama */
  id: string;
  amt: string;
}

type Props =
  | {
      mode?: "meal";
      existing?: CustomRecipe;
      /** nacrt (npr. iz linka): popunjava obrazac, ali se sprema kao novi recept */
      draft?: CustomRecipe;
      onDone: (id?: string) => void;
      /** novi recept odmah ide na taj dan u planu */
      planDay?: string;
    }
  | {
      mode: "prep";
      existing?: CustomPrep;
      draft?: CustomPrep;
      onDone: (id?: string) => void;
      planDay?: undefined;
    };

export function RecipeForm(props: Props) {
  const { existing, draft, onDone, planDay } = props;
  const isPrep = props.mode === "prep";
  const { data, apply } = useApp();
  const init = existing ?? draft;
  const meal = (isPrep ? undefined : init) as CustomRecipe | undefined;
  const prepInit = (isPrep ? init : undefined) as CustomPrep | undefined;
  // recept: količine za 1 porciju (sprema se za 1,5); prep: za jednu turu
  const f = isPrep ? 1 : BASE_SERVINGS;

  const [n, setN] = useState(init?.n ?? "");
  const [c, setC] = useState<Carb>(meal?.c ?? "Riža");
  const [dtext, setD] = useState(meal?.d ?? "");
  const [k, setK] = useState<PrepCat>(prepInit?.k ?? "Umaci");
  const [time, setTime] = useState(prepInit?.time ?? "");
  const [keep, setKeep] = useState(prepInit?.keep ?? "Hladnjak 1 tjedan");
  const [make, setMake] = useState(show(prepInit?.make ?? 1));
  const [unit, setUnit] = useState<UnitId>(prepInit?.unit ?? "porcija");
  const [rows, setRows] = useState<Row[]>(() =>
    init && Object.keys(init.use).length
      ? Object.entries(init.use).map(([id, a], i) => ({ key: i, id, amt: show(a / f) }))
      : [{ key: 0, id: "", amt: "" }],
  );
  const [kinds, setKinds] = useState<string[]>(init?.kinds ?? []);
  const [parts, setParts] = useState<Row[]>(() =>
    [
      ...Object.entries(meal?.parts ?? {}).map(([id, x]): [string, string] => [id, show(x)]),
      ...Object.entries(init?.prep ?? {}).map(([id, x]): [string, string] => ["p:" + id, show(x / f)]),
      ...Object.entries(meal?.prepIn ?? {}).map(([id, x]): [string, string] => ["pi:" + id, show(x / f)]),
    ].map(([id, amt], i) => ({ key: i, id, amt })),
  );
  const [extra, setExtra] = useState(init?.extra.join("\n") ?? "");
  const [steps, setSteps] = useState(init?.st.join("\n") ?? "");
  const [err, setErr] = useState("");
  const [newItemFor, setNewItemFor] = useState<number | null>(null);

  // vidljive namirnice + skrivene koje su već u receptu (npr. prepoznate iz linka)
  const items = allItems(data)
    .filter((i) => !data.items.hidden.includes(i.id) || rows.some((r) => r.id === i.id))
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  // dio ne može biti sam recept ni recept koji već koristi ovaj (petlja)
  const selfId = init?.id;
  const recipeParts = isPrep
    ? []
    : allRecipes(data)
        .filter((r) => r.id !== selfId && !(selfId && r.parts?.some(([p]) => p === selfId)))
        .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const prepParts = allPreps(data)
    .filter((p) => p.id !== selfId && !(selfId && p.prep?.some(([x]) => x === selfId)))
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setPart = (key: number, patch: Partial<Row>) =>
    setParts((ps) => ps.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const nextKey = () => Math.max(0, ...rows.map((r) => r.key)) + 1;
  const partUnit = (id: string) =>
    id.startsWith("p:") || id.startsWith("pi:") ? plural(2, prepUnit(data, id.replace(/^pi?:/, ""))) : "porc.";
  const partName = (id: string) =>
    id.startsWith("p:") || id.startsWith("pi:") ? prepName(data, id.replace(/^pi?:/, "")) : recipeName(data, id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!n.trim()) return setErr(isPrep ? "Upiši naziv prepa." : "Upiši naziv recepta.");
    const use: Record<string, number> = {};
    for (const r of rows) {
      if (!r.id) continue;
      const a = parse(r.amt);
      if (isNaN(a) || a <= 0) return setErr(`Upiši količinu za ${itemOf(data, r.id)?.n ?? "namirnicu"}.`);
      use[r.id] = round((use[r.id] || 0) + a * f);
    }
    const partMap: Record<string, number> = {};
    const prep: Record<string, number> = {};
    const prepIn: Record<string, number> = {};
    for (const p of parts) {
      if (!p.id) continue;
      const a = parse(p.amt);
      if (isNaN(a) || a <= 0) return setErr(`Upiši koliko ide ${partName(p.id)}.`);
      if (p.id.startsWith("pi:")) prepIn[p.id.slice(3)] = round((prepIn[p.id.slice(3)] || 0) + a * f);
      else if (p.id.startsWith("p:")) prep[p.id.slice(2)] = round((prep[p.id.slice(2)] || 0) + a * f);
      else partMap[p.id] = (partMap[p.id] || 0) + a;
    }
    if (![use, prep, prepIn, partMap].some((x) => Object.keys(x).length))
      return setErr("Dodaj barem jednu namirnicu ili dio.");

    if (isPrep) {
      const m = parse(make);
      if (!(m > 0)) return setErr("Upiši koliko jedinica daje jedna tura.");
      const p: CustomPrep = {
        id: init?.id ?? newPrepId(n),
        n: n.trim(),
        k,
        time: time.trim(),
        keep: keep.trim(),
        make: m,
        unit,
        use,
        extra: lines(extra),
        st: lines(steps),
        ...(kinds.length ? { kinds } : {}),
        ...(Object.keys(prep).length ? { prep } : {}),
        ...(prepInit?.tip ? { tip: prepInit.tip } : {}),
      };
      const r = saveCustomPrep(data, p);
      apply(r.data, r.msg);
      return onDone(p.id);
    }

    const r: CustomRecipe = {
      id: init?.id ?? newRecipeId(n),
      n: n.trim(),
      c,
      d: dtext.trim() || "Vlastiti recept",
      use,
      ...(Object.keys(prep).length ? { prep } : {}),
      ...(Object.keys(prepIn).length ? { prepIn } : {}),
      extra: lines(extra),
      st: lines(steps),
      ...(kinds.length ? { kinds } : {}),
      ...(Object.keys(partMap).length ? { parts: partMap } : {}),
      ...(meal?.side ? { side: meal.side } : {}),
      ...(meal?.two ? { two: true } : {}),
    };
    const res = saveRecipe(data, r);
    if (planDay != null && !existing)
      apply(setPlanDay(res.data, planDay, r.id), `${r.n} je dodan i stavljen na ${dayLabel(planDay)}.`);
    else apply(res.data, res.msg);
    onDone(r.id);
  };

  const what = isPrep ? "prep" : "recept";
  return (
    <>
      <form className="confirm" onSubmit={submit} aria-label={existing ? `Uredi ${what}` : `Novi ${what}`}>
        <b>{existing ? `Uredi ${what}` : `Novi ${what}`}</b>
        <div className="edit">
          <label htmlFor="rfName">
            Naziv
            <input
              id="rfName"
              type="text"
              placeholder={isPrep ? "npr. Teriyaki umak" : "npr. Piletina s kobasicama i rižom"}
              value={n}
              onChange={(e) => setN(e.target.value)}
            />
          </label>
          {isPrep ? (
            <>
              <label htmlFor="rfK">
                Vrsta prepa
                <select id="rfK" value={k} onChange={(e) => setK(e.target.value as PrepCat)}>
                  {(Object.entries(PREP_K) as [PrepCat, string][]).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="rfMake">
                Jedna tura daje
                <span className="amtrow">
                  <input
                    id="rfMake"
                    inputMode="decimal"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    aria-label="Koliko jedinica"
                  />
                  <select value={unit} onChange={(e) => setUnit(e.target.value as UnitId)} aria-label="Jedinica">
                    {(Object.entries(UNITS) as [UnitId, [string, string, string]][]).map(([v, x]) => (
                      <option key={v} value={v}>
                        {x[2]}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label htmlFor="rfTime">
                Vrijeme
                <input id="rfTime" value={time} onChange={(e) => setTime(e.target.value)} placeholder="npr. 10 min" />
              </label>
              <label htmlFor="rfKeep">
                Čuvanje
                <input
                  id="rfKeep"
                  value={keep}
                  onChange={(e) => setKeep(e.target.value)}
                  placeholder="npr. Hladnjak 2 tjedna"
                />
              </label>
            </>
          ) : (
            <>
              <label htmlFor="rfCarb">
                Ugljikohidrat
                <select id="rfCarb" value={c} onChange={(e) => setC(e.target.value as Carb)}>
                  {CARBS.map(([x, t]) => (
                    <option key={x} value={x}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="rfD">
                Način i vrijeme
                <input
                  id="rfD"
                  type="text"
                  placeholder="npr. Wok · 20 min"
                  value={dtext}
                  onChange={(e) => setD(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <fieldset className="kindpick">
          <legend>Vrsta jela</legend>
          <div className="chips">
            {kindOpts(data).map(([x, t]) => (
              <button
                key={x}
                type="button"
                className={"chip" + (kinds.includes(x) ? " on" : "")}
                aria-pressed={kinds.includes(x)}
                onClick={() => setKinds((ks) => (ks.includes(x) ? ks.filter((y) => y !== x) : [...ks, x]))}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <h4 className="omh">Dijelovi: {isPrep ? "drugi prep" : "drugi recepti i prep"}</h4>
        <p className="sub">
          {isPrep
            ? "Npr. marinada koja koristi teriyaki umak. Ako dio nemaš pripremljen, troše se njegove namirnice."
            : "Npr. tuna steak s krumpirom = tuna steak na tavi + hrskavi krumpir + miso juha, ili piletina + teriyaki umak (prep). Namirnice dijelova se same zbrajaju."}
        </p>
        {parts.length > 0 && (
          <div className="rfrows">
            {parts.map((p) => (
              <div key={p.key} className="rfrow">
                <select aria-label="Dio" value={p.id} onChange={(e) => setPart(p.key, { id: e.target.value })}>
                  <option value="">Odaberi {isPrep ? "prep" : "recept ili prep"}…</option>
                  {recipeParts.length > 0 && (
                    <optgroup label="Recepti">
                      {recipeParts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.n}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Prep">
                    {prepParts.map((x) => (
                      <option
                        key={x.id}
                        value={(p.id.startsWith("pi:") && p.id.slice(3) === x.id ? "pi:" : "p:") + x.id}
                      >
                        {x.n}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  aria-label={isPrep ? "Koliko za jednu turu" : "Koliko za 1 porciju"}
                  type="text"
                  inputMode="decimal"
                  placeholder="1"
                  value={p.amt}
                  onChange={(e) => setPart(p.key, { amt: e.target.value })}
                />
                <span className="unit">{p.id ? partUnit(p.id) : ""}</span>
                <button
                  type="button"
                  className="del"
                  aria-label="Makni dio"
                  onClick={() => setParts((ps) => ps.filter((x) => x.key !== p.key))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              setParts((ps) => [...ps, { key: Math.max(0, ...ps.map((x) => x.key)) + 1, id: "", amt: "1" }])
            }
          >
            + Dodaj dio
          </button>
        </div>

        <h4 className="omh">{isPrep ? "Namirnice za jednu turu" : "Namirnice za 1 porciju"}</h4>
        <p className="sub">Ono što dio već ima ne upisuj ponovno.</p>
        <div className="rfrows">
          {rows.map((r) => {
            const it = r.id ? itemOf(data, r.id) : undefined;
            return (
              <div key={r.key} className="rfrow">
                <select
                  aria-label="Namirnica"
                  value={r.id}
                  onChange={(e) => {
                    if (e.target.value === "__new") setNewItemFor(r.key);
                    else setRow(r.key, { id: e.target.value });
                  }}
                >
                  <option value="">Odaberi namirnicu…</option>
                  <option value="__new">+ Nova namirnica</option>
                  {catOpts(data).map(([x, t]) => (
                    <optgroup key={x} label={t}>
                      {items
                        .filter((i) => i.cat === x)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.n}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  aria-label="Količina"
                  type="text"
                  inputMode="decimal"
                  placeholder="koliko"
                  value={r.amt}
                  onChange={(e) => setRow(r.key, { amt: e.target.value })}
                />
                <span className="unit">{it?.u ?? ""}</span>
                <button
                  type="button"
                  className="del"
                  aria-label="Makni namirnicu"
                  onClick={() =>
                    setRows((rs) =>
                      rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [{ key: nextKey(), id: "", amt: "" }],
                    )
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <div className="btnrow">
          <button
            type="button"
            className="btn ghost"
            onClick={() => setRows((rs) => [...rs, { key: nextKey(), id: "", amt: "" }])}
          >
            + Još jedna namirnica
          </button>
        </div>

        <div className="edit one">
          <label htmlFor="rfExtra">
            Ostalo što ne pratiš (jedno po retku)
            <textarea
              id="rfExtra"
              rows={3}
              placeholder={"sol, papar\n1 žličica dimljene paprike"}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </label>
          <label htmlFor="rfSteps">
            Priprema (jedan korak po retku)
            <textarea
              id="rfSteps"
              rows={5}
              placeholder={
                isPrep
                  ? "Sve sastojke stavi u mali lonac.\nKuhaj 5 min dok se ne zgusne.\nOhladi i pospremi u staklenku."
                  : "Rižu stavi kuhati.\nKobasice nareži i zapeci 3 min.\nDodaj povrće…"
              }
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
        </div>
        <p className="sub">
          {isPrep
            ? "Prep radiš unaprijed: „Napravio sam” skida namirnice i dodaje pripremljeno. Recepti koji ga imaju kao dio troše pripremljeno, a kad ga nema, njegove namirnice."
            : "Količine upisuješ za 1 porciju, a brojač porcija na receptu ih poslije mijenja. U tjednom planu recept se računa za 1,5 porcija, kao i ostali."}
        </p>
        {err && <p className="miss">{err}</p>}
        <div className="btnrow">
          <button type="submit" className="btn">
            {existing ? "Spremi" : isPrep ? "Dodaj prep" : "Dodaj recept"}
          </button>
          <button type="button" className="btn ghost" onClick={() => onDone()}>
            Odustani
          </button>
        </div>
      </form>
      {newItemFor != null && (
        <ItemForm
          onDone={(item) => {
            if (item) setRow(newItemFor, { id: item.id });
            setNewItemFor(null);
          }}
        />
      )}
    </>
  );
}

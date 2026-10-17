import { useState } from "react";
import type { FormEvent } from "react";
import { CATS, DAYS } from "../data";
import type { Carb, CatId, CustomRecipe } from "../data";
import { useApp } from "../state/AppContext";
import { itemOf, visibleItems } from "../logic/items";
import { newRecipeId } from "../logic/recipes";
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

interface Row {
  key: number;
  id: string;
  amt: string;
}

/** Obrazac za vlastiti recept. Količine se upisuju za 1 porciju. */
export function RecipeForm({
  existing,
  onDone,
  planDay,
}: {
  existing?: CustomRecipe;
  onDone: () => void;
  /** novi recept odmah ide na taj dan u planu */
  planDay?: number;
}) {
  const { data, apply } = useApp();
  const [n, setN] = useState(existing?.n ?? "");
  const [c, setC] = useState<Carb>(existing?.c ?? "Riža");
  const [dtext, setD] = useState(existing?.d ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    existing
      ? Object.entries(existing.use).map(([id, a], k) => ({
          key: k,
          id,
          amt: String(Math.round((a / BASE_SERVINGS) * 10) / 10).replace(".", ","),
        }))
      : [{ key: 0, id: "", amt: "" }],
  );
  const [extra, setExtra] = useState(existing?.extra.join("\n") ?? "");
  const [steps, setSteps] = useState(existing?.st.join("\n") ?? "");
  const [err, setErr] = useState("");
  const [newItemFor, setNewItemFor] = useState<number | null>(null);

  const items = visibleItems(data)
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const nextKey = () => Math.max(0, ...rows.map((r) => r.key)) + 1;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!n.trim()) return setErr("Upiši naziv recepta.");
    const use: Record<string, number> = {};
    for (const r of rows) {
      if (!r.id) continue;
      const a = parse(r.amt);
      if (isNaN(a) || a <= 0) return setErr(`Upiši količinu za ${itemOf(data, r.id)?.n ?? "namirnicu"}.`);
      use[r.id] = (use[r.id] || 0) + a * BASE_SERVINGS;
    }
    if (!Object.keys(use).length) return setErr("Dodaj barem jednu namirnicu iz zalihe.");
    const lines = (t: string) =>
      t
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
    const r: CustomRecipe = {
      id: existing?.id ?? newRecipeId(n),
      n: n.trim(),
      c,
      d: dtext.trim() || "Vlastiti recept",
      use,
      extra: lines(extra),
      st: lines(steps),
    };
    const res = saveRecipe(data, r);
    if (planDay != null && !existing)
      apply(setPlanDay(res.data, planDay, r.id), `${r.n} je dodan i stavljen na ${DAYS[planDay].toLowerCase()}.`);
    else apply(res.data, res.msg);
    onDone();
  };

  return (
    <>
      <form className="confirm" onSubmit={submit} aria-label={existing ? "Uredi recept" : "Novi recept"}>
        <b>{existing ? "Uredi recept" : "Novi recept"}</b>
        <div className="edit">
          <label htmlFor="rfName">
            Naziv
            <input
              id="rfName"
              type="text"
              placeholder="npr. Piletina s kobasicama i rižom"
              value={n}
              onChange={(e) => setN(e.target.value)}
            />
          </label>
          <label htmlFor="rfCarb">
            Ugljikohidrat
            <select id="rfCarb" value={c} onChange={(e) => setC(e.target.value as Carb)}>
              {CARBS.map(([k, t]) => (
                <option key={k} value={k}>
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
        </div>

        <h4 className="omh">Namirnice za 1 porciju</h4>
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
                  {(Object.entries(CATS) as [CatId, string][]).map(([k, t]) => (
                    <optgroup key={k} label={t}>
                      {items
                        .filter((i) => i.cat === k)
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
                  min="0"
                  step="any"
                  placeholder="koliko"
                  value={r.amt}
                  onChange={(e) => setRow(r.key, { amt: e.target.value })}
                />
                <span className="unit">{it ? it.u : ""}</span>
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
              placeholder={"Rižu stavi kuhati.\nKobasice nareži i zapeci 3 min.\nDodaj povrće…"}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </label>
        </div>
        <p className="sub">
          Količine upisuješ za 1 porciju, a brojač porcija na receptu ih poslije mijenja. U tjednom planu recept se
          računa za 1,5 porcija, kao i ostali.
        </p>
        {err && <p className="miss">{err}</p>}
        <div className="btnrow">
          <button type="submit" className="btn">
            {existing ? "Spremi" : "Dodaj recept"}
          </button>
          <button type="button" className="btn ghost" onClick={onDone}>
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

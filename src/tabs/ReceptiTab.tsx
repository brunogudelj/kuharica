import { useState } from "react";
import { PBY, PREP_INV, REC_PREP } from "../data";
import type { Recipe } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import { BASE_SERVINGS, dayCost, missingFor, prepUsed } from "../logic/inventory";
import { cook, removeRecipe } from "../logic/actions";
import { allRecipes } from "../logic/recipes";
import { RecipeForm } from "../components/RecipeForm";
import { eur, pfmt, porcTxt, scaleText } from "../logic/format";
import { Card, Filters, Html, Note, Stepper } from "../components/ui";

type F = "sve" | "spremno" | "moji" | "Riža" | "Krumpir" | "Tjestenina" | "2u1";

function RecipeCard({ r }: { r: Recipe }) {
  const { data, apply, update } = useApp();
  const s = data.ui.servings[r.id] ?? 1;
  const f = s / BASE_SERVINGS;
  const m = missingFor(data, r.id, f);
  const pu = prepUsed(data, r.id, f).map(([p, k]) => `${pfmt(k, PREP_INV[p].unit)} ${PBY[p].n.toLowerCase()}`);
  const dc = dayCost(data, r.id);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const own = r.custom ? data.recipes.find((x) => x.id === r.id) : undefined;
  const setS = (v: number) =>
    update((d) => {
      const n = clone(d);
      n.ui.servings[r.id] = Math.min(6, Math.max(0.5, v));
      return n;
    });

  return (
    <Card
      title={r.n}
      meta={
        <>
          <span className="carb">{r.c}</span>
          {r.two && <span className="carb">2 u 1</span>}
          {r.custom && <span className="carb">moj</span>}
          <span>{r.d}</span>
          {m.length ? (
            <span className="pill p-out">fali {m.length}</span>
          ) : (
            <span className="pill p-ok">mogu skuhati</span>
          )}
          {dc.known > 0 && <span>{eur(dc.perMeal)} / obrok</span>}
        </>
      }
    >
      <div className="rtop servrow">
        <div className="rname">
          <b>Porcije</b>
          <small>1,5 porcija = ručak i večera iz jednog kuhanja</small>
        </div>
        <Stepper label="porcije" value={porcTxt(s)} onDec={() => setS(s - 0.5)} onInc={() => setS(s + 0.5)} />
      </div>
      {r.split && (
        <div className="split">
          {r.split.map((x, i) => (
            <Html key={i} as="div" html={x} />
          ))}
        </div>
      )}
      {m.length > 0 && <p className="miss">Fali na zalihi: {m.join(", ")}</p>}
      {pu.length > 0 && <p className="ready">Iz pripremljenog koristi: {pu.join(", ")}</p>}
      {REC_PREP[r.id] && (
        <p className="prepline">
          Brže uz prep:{" "}
          {REC_PREP[r.id].map((p, i) => (
            <span key={p}>
              {i > 0 && ", "}
              <b>{PBY[p].n}</b>
            </span>
          ))}
        </p>
      )}
      <div>
        <h4>Sastojci za {porcTxt(s)}</h4>
        <ul className="ing">
          {r.ing.map((i, k) => (
            <Html key={k} as="li" html={scaleText(i, f)} />
          ))}
        </ul>
      </div>
      <div>
        <h4>Priprema</h4>
        <ol>
          {r.st.map((x, k) => (
            <li key={k}>{x}</li>
          ))}
        </ol>
        {!r.st.length && <p className="sub">Koraci nisu upisani.</p>}
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const res = cook(data, r.id, null, f);
            apply(res.data, res.msg);
          }}
        >
          Skuhao sam
        </button>
        <span className="count">skida {porcTxt(s)} i dnevne dodatke sa zalihe</span>
      </div>
      {own && !editing && (
        <div className="btnrow">
          <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
            Uredi recept
          </button>
          {confirmDel ? (
            <>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => {
                  const res = removeRecipe(data, r.id);
                  apply(res.data, res.msg);
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
              Obriši recept
            </button>
          )}
        </div>
      )}
      {own && editing && <RecipeForm existing={own} onDone={() => setEditing(false)} />}
    </Card>
  );
}

export function ReceptiTab() {
  const { data } = useApp();
  const [f, setF] = useState<F>("sve");
  const [adding, setAdding] = useState(false);
  const list = allRecipes(data).filter((r) => {
    if (f === "sve") return true;
    if (f === "moji") return r.custom;
    if (f === "2u1") return r.two;
    if (f === "spremno") return !missingFor(data, r.id, (data.ui.servings[r.id] ?? 1) / BASE_SERVINGS).length;
    return r.c === f;
  });
  return (
    <section id="recepti" role="tabpanel" aria-labelledby="tab-recepti">
      <Filters<F>
        label="Filtriraj po ugljikohidratu"
        value={f}
        onChange={setF}
        options={[
          ["sve", "Sve"],
          ["spremno", "Mogu skuhati"],
          ["moji", "Moji"],
          ["Riža", "Riža"],
          ["Krumpir", "Krumpir"],
          ["Tjestenina", "Tjestenina"],
          ["2u1", "2 u 1"],
        ]}
      />
      {adding ? (
        <RecipeForm onDone={() => setAdding(false)} />
      ) : (
        <div className="btnrow">
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Novi recept
          </button>
          <span className="count">sa svojim namirnicama iz zalihe</span>
        </div>
      )}
      <Note>
        Svaki recept ima <strong>brojač porcija</strong> koji kreće od 1 porcije za jednu osobu i mijenja sve količine.
        Za ručak i večeru iz jednog kuhanja stavi 1,5 porcija, a s tom količinom računa i tjedni plan. Ulje najviše 1
        žlica po receptu, u air fryeru sprej.
      </Note>
      <div className="group">
        {list.length ? (
          list.map((r) => <RecipeCard key={r.id} r={r} />)
        ) : (
          <Note>
            {f === "moji"
              ? "Još nemaš svojih recepata. Stisni + Novi recept."
              : 'Nijedan recept ne odgovara filteru. Za "Mogu skuhati" dopuni zalihu.'}
          </Note>
        )}
      </div>
    </section>
  );
}

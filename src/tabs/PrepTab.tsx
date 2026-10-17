import { useState } from "react";
import { PREP, PREP_INV, PREP_K, PREP_TIMELINE } from "../data";
import type { PrepCat, PrepRecipe } from "../data";
import { useApp } from "../state/AppContext";
import { itemName } from "../logic/items";
import { clone } from "../state/model";
import { pc, qty } from "../logic/inventory";
import { makePrep } from "../logic/actions";
import { pfmt, scaleText } from "../logic/format";
import { Card, Filters, Html, Note, Stepper } from "../components/ui";

type F = "sve" | PrepCat;

function PrepCard({ p }: { p: PrepRecipe }) {
  const { data, apply, update } = useApp();
  const t = data.ui.ture[p.id] ?? 1;
  const inv = PREP_INV[p.id];
  const miss = Object.entries(p.use)
    .filter(([id, a]) => qty(data, id) + 1e-9 < a * t)
    .map(([id]) => itemName(data, id));
  const have = pc(data, p.id);
  const change = (fn: (n: typeof data) => void) =>
    update((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });

  return (
    <Card
      title={p.n}
      meta={
        <>
          <span className="carb">{PREP_K[p.k]}</span>
          <span>{p.time}</span>
          {have > 0 && <span className="pill p-ok">{pfmt(have, inv.unit)}</span>}
          {miss.length ? (
            <span className="pill p-out">fali {miss.length}</span>
          ) : (
            <span className="pill p-low">imaš sastojke</span>
          )}
        </>
      }
    >
      <div className="facts">
        <div>
          <b>Količina</b>
          <span>{scaleText(p.yieldTxt, t)}</span>
        </div>
        <div>
          <b>Vrijeme</b>
          <span>{p.time}</span>
        </div>
        <div>
          <b>Čuvanje</b>
          <span>{p.keep}</span>
        </div>
      </div>
      <div className="rtop servrow">
        <div className="rname">
          <b>Količina pripreme</b>
          <small>{t === 1 ? "osnovni recept" : `${t.toLocaleString("hr-HR")} × osnovni recept`}</small>
        </div>
        <Stepper
          label="količina pripreme"
          value={`× ${t.toLocaleString("hr-HR")}`}
          onDec={() => change((n) => (n.ui.ture[p.id] = Math.max(0.5, t - 0.5)))}
          onInc={() => change((n) => (n.ui.ture[p.id] = Math.min(5, t + 0.5)))}
        />
      </div>
      <div className="rtop">
        <div className="rname">
          <b>Na zalihi</b>
          <small>"Napravio sam" = +{pfmt(inv.make * t, inv.unit)}</small>
        </div>
        <Stepper
          label={p.n}
          value={pfmt(have, inv.unit)}
          onDec={() => change((n) => (n.prepStock[p.id] = Math.max(0, have - 1)))}
          onInc={() => change((n) => (n.prepStock[p.id] = have + 1))}
        />
      </div>
      {miss.length > 0 && <p className="miss">Fali na zalihi: {miss.join(", ")}</p>}
      <div>
        <h4>Sastojci</h4>
        <ul className="ing">
          {p.ing.map((i, k) => (
            <Html key={k} as="li" html={scaleText(i, t)} />
          ))}
        </ul>
      </div>
      <div>
        <h4>Priprema</h4>
        <ol>
          {p.st.map((x, k) => (
            <li key={k}>{x}</li>
          ))}
        </ol>
      </div>
      {t !== 1 && (
        <p className="prepline">
          Koraci su pisani za osnovni recept. Količine u njima pomnoži s {t.toLocaleString("hr-HR")}.
        </p>
      )}
      <div className="tip">{p.tip}</div>
      <div>
        <h4>Koristi u</h4>
        <div className="uses">
          {p.for.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
      </div>
      <div className="btnrow">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const r = makePrep(data, p.id, t);
            apply(r.data, r.msg);
          }}
        >
          Napravio sam
        </button>
        <span className="count">skida sastojke sa zalihe</span>
      </div>
    </Card>
  );
}

export function PrepTab() {
  const [f, setF] = useState<F>("sve");
  const list = PREP.filter((p) => f === "sve" || p.k === f);
  return (
    <section id="prep" aria-labelledby="tab-prep">
      <Note>
        <strong>Priprema unaprijed.</strong> Svaki recept ovdje radiš jednom, a koristiš ga cijeli tjedan ili duže. Kad
        nešto napraviš, stisni <strong>Napravio sam</strong>: sirovi sastojci se skinu sa zalihe, a vrećice ili kutije
        dodaju u pripremljeno. Recepti onda troše pripremljeno umjesto sirovog, pa se ništa ne oduzima dvaput.
      </Note>
      <Card
        title="Nedjeljni prep: redoslijed"
        meta={
          <>
            <span className="carb">oko 75 min</span>
            <span>lonac + wok + air fryer istovremeno</span>
          </>
        }
      >
        <ol className="tl">
          {PREP_TIMELINE.map(([t, x]) => (
            <li key={t}>
              <b className="g">{t}</b> {x}
            </li>
          ))}
        </ol>
        <p className="sub">Gulaš u duploj turi radi kao zaseban prep kad imaš 45 min, ne uz sve ostalo.</p>
      </Card>
      <Filters<F>
        label="Filtriraj prep recepte"
        value={f}
        onChange={setF}
        options={[
          ["sve", "Sve"],
          ["Umaci", "Umaci i dresinzi"],
          ["Marinade", "Marinade"],
          ["Baze", "Baze"],
          ["Gotovo", "Gotove komponente"],
        ]}
      />
      <div className="group">
        {list.map((p) => (
          <PrepCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

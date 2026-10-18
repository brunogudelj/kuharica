import { useState } from "react";
import { PREP_K, PREP_TIMELINE } from "../data";
import { allPreps, isCustomPrep, prepInv } from "../logic/preps";
import { Icon } from "../components/icons";
import type { PrepCat, PrepRecipe } from "../data";
import { useApp } from "../state/AppContext";
import { itemName } from "../logic/items";
import { clone } from "../state/model";
import { pc, planPreps, qty } from "../logic/inventory";
import { makePrep } from "../logic/actions";
import { pfmt, scaleText } from "../logic/format";
import { Html, Stepper } from "../components/ui";
import { FCheck, FGroup, FSearch, Page, toggle } from "../components/Page";
import type { Chip } from "../components/Page";
import { usePanel } from "../components/Panel";
import { Thumb } from "./ReceptiTab";

export function prepMeta(data: ReturnType<typeof useApp>["data"], p: PrepRecipe) {
  const t = data.ui.ture[p.id] ?? 1;
  const miss = Object.entries(p.use)
    .filter(([id, a]) => qty(data, id) + 1e-9 < a * t)
    .map(([id]) => itemName(data, id));
  return { t, miss, have: pc(data, p.id), inv: prepInv(data, p.id) ?? { make: 1, unit: "porcija" as const, per: {} } };
}

/** Sadržaj prep recepta: količina, zaliha, sastojci, koraci */
export function PrepBody({ p }: { p: PrepRecipe }) {
  const { data, apply, update } = useApp();
  const { t, miss, have, inv } = prepMeta(data, p);
  const change = (fn: (n: typeof data) => void) =>
    update((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });

  return (
    <>
      <div className="facts">
        <div>
          <b>Količina</b>
          <span>{scaleText(p.yieldTxt, t).replace(/<[^>]+>/g, "")}</span>
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
        <ol className="steps">
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
    </>
  );
}

type PTab = "list" | "order";
type Keep = "fri" | "frz";
const KEEP_LABEL: Record<Keep, string> = { fri: "Hladnjak", frz: "Zamrzivač" };
/** Gdje se prep čuva, iz teksta "Hladnjak 4 dana · zamrzivač 1 mjesec" */
export const keepOf = (p: PrepRecipe): Keep[] => {
  const t = p.keep.toLowerCase();
  return [
    ...(t.includes("hladnjak") ? (["fri"] as Keep[]) : []),
    ...(t.includes("zamrziva") ? (["frz"] as Keep[]) : []),
  ];
};

export function PrepTab() {
  const { data } = useApp();
  const { open } = usePanel();
  const [tab, setTab] = useState<PTab>("list");
  const [q, setQ] = useState("");
  const [fK, setFK] = useState<PrepCat[]>([]);
  const [fKeep, setFKeep] = useState<Keep[]>([]);
  const [fAvail, setFAvail] = useState(false);
  const [fHave, setFHave] = useState(false);
  const [fPlan, setFPlan] = useState(false);
  const inPlan = planPreps(data);
  const term = q.trim().toLowerCase();
  const preps = allPreps(data);
  const pass = (p: PrepRecipe, skip?: "k" | "keep") =>
    (!term || p.n.toLowerCase().includes(term)) &&
    (skip === "k" || !fK.length || fK.includes(p.k)) &&
    (skip === "keep" || !fKeep.length || keepOf(p).some((k) => fKeep.includes(k))) &&
    (!fAvail || !prepMeta(data, p).miss.length) &&
    (!fHave || pc(data, p.id) > 0) &&
    (!fPlan || (inPlan[p.id] ?? 0) > 0);
  const list = preps.filter((p) => pass(p));
  const cats = Object.keys(PREP_K) as PrepCat[];
  const chips: Chip[] = [
    ...fK.map((k): Chip => [PREP_K[k], () => setFK(toggle(fK, k))]),
    ...fKeep.map((k): Chip => [KEEP_LABEL[k], () => setFKeep(toggle(fKeep, k))]),
    ...(fAvail ? [["Imam sastojke", () => setFAvail(false)] as Chip] : []),
    ...(fHave ? [["Već pripremljeno", () => setFHave(false)] as Chip] : []),
    ...(fPlan ? [["Treba za tekući plan", () => setFPlan(false)] as Chip] : []),
  ];

  const search = <FSearch value={q} onChange={setQ} placeholder="Traži prep recept" />;

  const filters = (
    <>
      <FGroup title="Vrsta" count={fK.length}>
        {cats.map((k) => (
          <FCheck
            key={k}
            on={fK.includes(k)}
            label={PREP_K[k]}
            count={preps.filter((p) => pass(p, "k") && p.k === k).length}
            onChange={() => setFK(toggle(fK, k))}
          />
        ))}
      </FGroup>
      <FGroup title="Spremanje" count={fKeep.length}>
        {(Object.keys(KEEP_LABEL) as Keep[]).map((k) => (
          <FCheck
            key={k}
            on={fKeep.includes(k)}
            label={KEEP_LABEL[k]}
            dot={`l-${k}`}
            count={preps.filter((p) => pass(p, "keep") && keepOf(p).includes(k)).length}
            onChange={() => setFKeep(toggle(fKeep, k))}
          />
        ))}
      </FGroup>
      <FGroup title="Dostupnost" count={(fAvail ? 1 : 0) + (fHave ? 1 : 0) + (fPlan ? 1 : 0)}>
        <FCheck
          on={fPlan}
          label="Treba mi za tekući plan"
          count={preps.filter((p) => (inPlan[p.id] ?? 0) > 0).length}
          onChange={() => setFPlan(!fPlan)}
        />
        <FCheck
          on={fAvail}
          label="Imam sve sastojke"
          count={preps.filter((p) => !prepMeta(data, p).miss.length).length}
          onChange={() => setFAvail(!fAvail)}
        />
        <FCheck
          on={fHave}
          label="Već pripremljeno"
          count={preps.filter((p) => pc(data, p.id) > 0).length}
          onChange={() => setFHave(!fHave)}
        />
      </FGroup>
      <p className="fhint">
        Prep radiš jednom, a koristiš cijeli tjedan. „Napravio sam” skida sirove sastojke i dodaje pripremljeno, a
        recepti onda troše pripremljeno umjesto sirovog.
      </p>
    </>
  );

  return (
    <Page
      id="prep"
      title="Prep"
      count={
        <>
          <b>{list.length}</b> od {preps.length}
        </>
      }
      filters={tab === "list" ? filters : undefined}
      search={search}
      active={chips.length}
      onClear={() => {
        setFK([]);
        setFKeep([]);
        setFAvail(false);
        setFHave(false);
        setFPlan(false);
      }}
      chips={tab === "list" ? chips : []}
      actions={
        <button type="button" className="btn" onClick={() => open({ t: "newPrep" })}>
          <Icon name="plus" size={18} /> Novi prep
        </button>
      }
      tabs={
        <div className="seg" role="tablist" aria-label="Prikaz prepa">
          {(
            [
              ["list", "Prep recepti"],
              ["order", "Nedjeljni redoslijed"],
            ] as [PTab, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
            >
              {l}
            </button>
          ))}
        </div>
      }
    >
      {tab === "order" ? (
        <div className="group">
          <p className="sub">Oko 75 min: lonac, wok i air fryer rade istovremeno.</p>
          <ol className="tl">
            {PREP_TIMELINE.map(([t, x]) => (
              <li key={t}>
                <b className="g">{t}</b> {x}
              </li>
            ))}
          </ol>
          <p className="sub">Gulaš u duploj turi radi kao zaseban prep kad imaš 45 min, ne uz sve ostalo.</p>
        </div>
      ) : list.length ? (
        <div className="tablewrap">
          <table className="grid rows cards-mobile" aria-label="Prep recepti">
            <thead>
              <tr>
                <th className="sticky">Recept</th>
                <th>Vrsta</th>
                <th>Vrijeme</th>
                <th>Količina</th>
                <th>Čuvanje</th>
                <th className="num">Imaš</th>
                <th className="num">Za plan</th>
                <th>Sastojci</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const { miss, have, inv } = prepMeta(data, p);
                const total = Object.keys(p.use).length;
                const ok = total - miss.length;
                return (
                  <tr key={p.id} className="rowlink" onClick={() => open({ t: "prep", id: p.id })}>
                    <td className="sticky namecol">
                      <div className="ent">
                        <Thumb kind="prep" carb="" />
                        <div className="ent-txt">
                          <button
                            type="button"
                            className="ent-name"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              open({ t: "prep", id: p.id });
                            }}
                          >
                            {p.n}
                          </button>
                          <span className="ent-meta">
                            {isCustomPrep(p.id)
                              ? "moj prep"
                              : p.for.length
                                ? `za: ${p.for.slice(0, 2).join(", ")}`
                                : p.tip}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td data-l="Vrsta">
                      <span className="chip">{PREP_K[p.k]}</span>
                    </td>
                    <td data-l="Vrijeme" className="muted">
                      {p.time}
                    </td>
                    <td data-l="Količina" className="muted">
                      {p.yieldTxt.replace(/<[^>]+>/g, "")}
                    </td>
                    <td data-l="Čuvanje">
                      <span className="keepcell">
                        {keepOf(p).map((k) => (
                          <span key={k} className={`label l-${k}`}>
                            {KEEP_LABEL[k]}
                          </span>
                        ))}
                        <span className="muted">
                          {p.keep
                            .replace(/hladnjak|zamrzivač/gi, "")
                            .replace(/^\s*·?\s*/, "")
                            .replace(/\s*·\s*/g, " / ")}
                        </span>
                      </span>
                    </td>
                    <td data-l="Imaš" className="num strong">
                      {have > 0 ? pfmt(have, inv.unit) : "–"}
                    </td>
                    <td data-l="Za plan" className={"num" + ((inPlan[p.id] ?? 0) > have + 1e-9 ? " t-out" : "")}>
                      {inPlan[p.id] ? pfmt(inPlan[p.id], inv.unit) : "–"}
                    </td>
                    <td data-l="Sastojci">
                      <div className={"avail" + (!miss.length ? " full" : "")}>
                        <span className="avail-bar" aria-hidden="true">
                          <i style={{ width: `${total ? (ok / total) * 100 : 0}%` }} />
                        </span>
                        <span>{!miss.length ? "Imaš sve" : `${ok}/${total}`}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <b>Nijedan prep recept ne odgovara.</b>
          <span>Makni neki filter.</span>
        </div>
      )}
    </Page>
  );
}

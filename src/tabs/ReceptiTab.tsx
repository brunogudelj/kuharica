/* Recepti i prep: isti popis, isti filteri i iste kolone. Prep ima još spremanje, pripremljeno i potrebu za plan,
   a stoji na svojoj stranici. */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "../state/AppContext";
import { allItems } from "../logic/items";
import { kindName, kindOpts } from "../logic/lists";
import {
  CARB_ORDER,
  PROT_GROUPS,
  SORTS,
  TAG_ORDER,
  emptyFilter,
  facetCounts,
  feed,
  filterFeed,
  matches,
  prepFeed,
  sortFeed,
} from "../logic/feed";
import type { FeedEntry, FeedFilter, Kind, SortKey } from "../logic/feed";
import { eur, pfmt } from "../logic/format";
import { PREP_K } from "../data";
import type { PrepCat, PrepRecipe } from "../data";
import { pc, planPreps } from "../logic/inventory";
import { prepInv, prepOf } from "../logic/preps";
import { usePanel } from "../components/Panel";
import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";
import { FCheck, FGroup, FSearch, Page, toggle } from "../components/Page";
import type { Chip } from "../components/Page";

const KIND_ICON: Record<Kind, IconName> = { meal: "recepti", om: "omlet", prep: "prep" };
const carbCls = (c: string) => `cc-${c.replace(/\s/g, "") || "none"}`;
const n = (v: number | null, suf = "") => (v == null ? "–" : v.toLocaleString("hr-HR") + suf);

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

/** Kvadratić s ikonom: boja po prilogu (obroci) ili vrsti */
export function Thumb({ kind, carb, om }: { kind: Kind; carb: string; om?: boolean }) {
  return (
    <span className={`thumb k-${om ? "om" : kind} ${carbCls(carb)}`} aria-hidden="true">
      <Icon name={om ? "omlet" : KIND_ICON[kind]} size={20} />
    </span>
  );
}

function Row({
  e,
  onOpen,
  kindN,
  prepCells,
}: {
  e: FeedEntry;
  onOpen: () => void;
  kindN: (id: string) => string;
  prepCells?: ReactNode;
}) {
  const all = e.total > 0 && e.have >= e.total;
  const approx = e.macKnown > 0 && e.macKnown < e.items.length ? "≈ " : "";
  const isPrep = e.kind === "prep";
  return (
    <tr className="rowlink" onClick={onOpen}>
      <td className="sticky namecol">
        <div className="ent">
          <Thumb kind={e.kind} carb={e.carb} om={e.kinds.includes("omlet")} />
          <div className="ent-txt">
            <button
              type="button"
              className="ent-name"
              onClick={(ev) => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              {e.n}
            </button>
            <span className="ent-meta">
              {isPrep
                ? [e.d, e.time ? `${e.time} min` : ""].filter(Boolean).join(" · ")
                : [e.method, e.time ? `${e.time} min` : ""].filter(Boolean).join(" · ") || e.d}
            </span>
          </div>
        </div>
      </td>
      <td data-l="Vrsta">
        <div className="chips">
          {isPrep && <span className="chip">{e.method}</span>}
          {e.kinds.map((k) => (
            <span key={k} className="chip kind">
              {kindN(k)}
            </span>
          ))}
        </div>
      </td>
      <td data-l="Način" className="muted">
        {e.tags.filter((t) => t !== "2 u 1").join(", ")}
      </td>
      {!isPrep && (
        <td data-l="Prilog">{e.carb && <span className={`chip carb-chip ${carbCls(e.carb)}`}>{e.carb}</span>}</td>
      )}
      <td data-l="Protein">
        <div className="chips">
          {e.prot.slice(0, 2).map((p) => (
            <span key={p} className="chip">
              {p}
            </span>
          ))}
          {e.prot.length > 2 && <span className="chip">+{e.prot.length - 2}</span>}
          {e.two && <span className="chip">2 u 1</span>}
          {e.custom && <span className="chip mine">moj</span>}
        </div>
      </td>
      <td data-l="kcal" className="num">
        {e.kcal == null ? "–" : approx + n(e.kcal)}
      </td>
      <td data-l="Proteini" className="num strong">
        {n(e.p, " g")}
      </td>
      <td data-l="Cijena" className="num">
        {e.cost == null ? "–" : eur(e.cost)}
      </td>
      <td data-l="Vrijeme" className="num">
        {e.time == null ? "–" : `${e.time} min`}
      </td>
      <td data-l="Sastojci">
        <div className={"avail" + (all ? " full" : "")}>
          <span className="avail-bar" aria-hidden="true">
            <i style={{ width: `${e.total ? (e.have / e.total) * 100 : 0}%` }} />
          </span>
          <span>{all ? "Imaš sve" : `${e.have}/${e.total}`}</span>
        </div>
      </td>
      {prepCells}
    </tr>
  );
}

/** Popis recepata ili prepa s filterima. `override` zamjenjuje popis (npr. nedjeljni redoslijed prepa). */
export function RecipeList({
  mode,
  tabs,
  override,
}: {
  mode: "meal" | "prep";
  tabs?: ReactNode;
  override?: ReactNode;
}) {
  const { data } = useApp();
  const { open } = usePanel();
  const isPrep = mode === "prep";
  const [f, setF] = useState<FeedFilter>(emptyFilter);
  const [sort, setSort] = useState<SortKey>("pre");
  const [itemQ, setItemQ] = useState("");
  // samo za prep
  const [fK, setFK] = useState<PrepCat[]>([]);
  const [fKeep, setFKeep] = useState<Keep[]>([]);
  const [fHave, setFHave] = useState(false);
  const [fPlan, setFPlan] = useState(false);

  const all = useMemo(() => (isPrep ? prepFeed(data) : feed(data)), [data, isPrep]);
  const inPlan = useMemo(() => (isPrep ? planPreps(data) : {}), [data, isPrep]);
  const prepPass = (e: FeedEntry, skip?: "k" | "keep" | "have" | "plan") => {
    if (!isPrep) return true;
    const p = prepOf(data, e.id);
    if (!p) return false;
    return (
      (skip === "k" || !fK.length || fK.includes(p.k)) &&
      (skip === "keep" || !fKeep.length || keepOf(p).some((k) => fKeep.includes(k))) &&
      (skip === "have" || !fHave || pc(data, p.id) > 0) &&
      (skip === "plan" || !fPlan || (inPlan[p.id] ?? 0) > 0)
    );
  };
  const base = all.filter((e) => prepPass(e));
  const list = sortFeed(filterFeed(base, f, data), sort);
  const tagCounts = facetCounts(base, f, data, "tags");
  const tagList = [
    ...TAG_ORDER.filter((t) => all.some((e) => e.tags.includes(t))),
    ...[...new Set(all.flatMap((e) => e.tags))].filter((t) => !TAG_ORDER.includes(t)),
  ];
  const prots = facetCounts(base, f, data, "prot");
  const carbs = facetCounts(base, f, data, "carb");
  const kindCounts = facetCounts(base, f, data, "kinds");
  const kindN = (id: string) => kindName(data, id) ?? id;
  const set = (p: Partial<FeedFilter>) => setF({ ...f, ...p });
  // brojevi za prep filtere: sve ostale filtere uzmi u obzir
  const prepCount = (skip: "k" | "keep" | "have" | "plan", test: (p: PrepRecipe) => boolean) =>
    all.filter((e) => {
      const p = prepOf(data, e.id);
      return p && prepPass(e, skip) && matches(e, f, data) && test(p);
    }).length;

  const protList = [
    ...PROT_GROUPS.map(([g]) => g),
    ...Object.keys(prots).filter((p) => !PROT_GROUPS.some(([g]) => g === p)),
  ].filter((p) => all.some((e) => e.prot.includes(p)));
  const carbList = CARB_ORDER.filter((c) => all.some((e) => e.carb === c));

  const usedItems = useMemo(() => {
    const ids = new Set(all.flatMap((e) => e.items));
    return allItems(data)
      .filter((i) => ids.has(i.id))
      .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  }, [all, data]);
  const itemCount = (id: string) =>
    base.filter((e) => matches(e, { ...f, items: [...f.items.filter((x) => x !== id), id] }, data)).length;

  const chips: Chip[] = [
    ...f.kinds.map((k): Chip => [kindN(k), () => set({ kinds: toggle(f.kinds, k) })]),
    ...fK.map((k): Chip => [PREP_K[k], () => setFK(toggle(fK, k))]),
    ...f.tags.map((k): Chip => [k, () => set({ tags: toggle(f.tags, k) })]),
    ...f.prot.map((p): Chip => [p, () => set({ prot: toggle(f.prot, p) })]),
    ...f.carb.map((c): Chip => [c, () => set({ carb: toggle(f.carb, c) })]),
    ...fKeep.map((k): Chip => [KEEP_LABEL[k], () => setFKeep(toggle(fKeep, k))]),
    ...f.items.map((id): Chip => [
      "s: " + (allItems(data).find((i) => i.id === id)?.n ?? id),
      () => set({ items: toggle(f.items, id) }),
    ]),
    ...(f.avail ? [[f.avail === "all" ? "Imam sve" : "Fale najviše 2", () => set({ avail: "" })] as Chip] : []),
    ...(fPlan ? [["Treba za tekući plan", () => setFPlan(false)] as Chip] : []),
    ...(fHave ? [["Već pripremljeno", () => setFHave(false)] as Chip] : []),
    ...(f.time ? [[`do ${f.time} min`, () => set({ time: 0 })] as Chip] : []),
    ...(f.mine ? [[isPrep ? "Moj prep" : "Moji recepti", () => set({ mine: false })] as Chip] : []),
  ];
  const clearAll = () => {
    setF({ ...emptyFilter(), q: f.q });
    setFK([]);
    setFKeep([]);
    setFHave(false);
    setFPlan(false);
  };

  const openEntry = (e: FeedEntry) => {
    if (e.kind === "meal") open({ t: "meal", id: e.id });
    else if (e.kind === "om") open({ t: "om", sel: e.sel, n: e.n });
    else open({ t: "prep", id: e.id });
  };

  const search = (
    <FSearch
      id={isPrep ? "prepSearch" : "recipeSearch"}
      value={f.q}
      onChange={(q) => set({ q })}
      placeholder={isPrep ? "Traži prep ili sastojak" : "Traži recept ili sastojak"}
    />
  );

  const filters = (
    <>
      <FGroup title="Vrsta jela" count={f.kinds.length}>
        {kindOpts(data)
          .filter(([k]) => all.some((e) => e.kinds.includes(k)) || f.kinds.includes(k))
          .map(([k, t]) => (
            <FCheck
              key={k}
              on={f.kinds.includes(k)}
              label={t}
              count={kindCounts[k] || 0}
              onChange={() => set({ kinds: toggle(f.kinds, k) })}
            />
          ))}
        <p className="fhint">Vrste uređuješ u Postavkama, a dodaješ ih kod uređivanja.</p>
      </FGroup>
      {isPrep && (
        <FGroup title="Vrsta prepa" count={fK.length}>
          {(Object.keys(PREP_K) as PrepCat[]).map((k) => (
            <FCheck
              key={k}
              on={fK.includes(k)}
              label={PREP_K[k]}
              count={prepCount("k", (p) => p.k === k)}
              onChange={() => setFK(toggle(fK, k))}
            />
          ))}
        </FGroup>
      )}
      {tagList.length > 0 && (
        <FGroup title="Način" count={f.tags.length}>
          {tagList.map((k) => (
            <FCheck
              key={k}
              on={f.tags.includes(k)}
              label={k}
              count={tagCounts[k] || 0}
              onChange={() => set({ tags: toggle(f.tags, k) })}
            />
          ))}
        </FGroup>
      )}
      {protList.length > 0 && (
        <FGroup title="Protein" count={f.prot.length}>
          {protList.map((p) => (
            <FCheck
              key={p}
              on={f.prot.includes(p)}
              label={p}
              count={prots[p] || 0}
              onChange={() => set({ prot: toggle(f.prot, p) })}
            />
          ))}
        </FGroup>
      )}
      {carbList.length > 0 && (
        <FGroup title="Ugljikohidrat" count={f.carb.length}>
          {carbList.map((c) => (
            <FCheck
              key={c}
              on={f.carb.includes(c)}
              label={c}
              dot={carbCls(c)}
              count={carbs[c] || 0}
              onChange={() => set({ carb: toggle(f.carb, c) })}
            />
          ))}
        </FGroup>
      )}
      {isPrep && (
        <FGroup title="Spremanje" count={fKeep.length}>
          {(Object.keys(KEEP_LABEL) as Keep[]).map((k) => (
            <FCheck
              key={k}
              on={fKeep.includes(k)}
              label={KEEP_LABEL[k]}
              dot={`l-${k}`}
              count={prepCount("keep", (p) => keepOf(p).includes(k))}
              onChange={() => setFKeep(toggle(fKeep, k))}
            />
          ))}
        </FGroup>
      )}
      <FGroup title="Dostupnost" count={(f.avail ? 1 : 0) + (fPlan ? 1 : 0) + (fHave ? 1 : 0)}>
        {isPrep && (
          <>
            <FCheck
              on={fPlan}
              label="Treba mi za tekući plan"
              count={prepCount("plan", (p) => (inPlan[p.id] ?? 0) > 0)}
              onChange={() => setFPlan(!fPlan)}
            />
            <FCheck
              on={fHave}
              label="Već pripremljeno"
              count={prepCount("have", (p) => pc(data, p.id) > 0)}
              onChange={() => setFHave(!fHave)}
            />
          </>
        )}
        {(
          [
            ["", isPrep ? "Bilo koji sastojci" : "Svi recepti"],
            ["all", "Imam sve sastojke"],
            ["max2", "Fale najviše 2"],
          ] as [FeedFilter["avail"], string][]
        ).map(([k, l]) => (
          <FCheck
            key={k || "sve"}
            radio
            on={f.avail === k}
            label={l}
            count={base.filter((e) => matches(e, { ...f, avail: k }, data)).length}
            onChange={() => set({ avail: k })}
          />
        ))}
      </FGroup>
      <FGroup title="Vrijeme" count={f.time ? 1 : 0}>
        {[0, 15, 25, 30].map((t) => (
          <FCheck
            key={t}
            radio
            on={f.time === t}
            label={t ? `do ${t} min` : "Bilo koliko"}
            count={base.filter((e) => matches(e, { ...f, time: t }, data)).length}
            onChange={() => set({ time: t })}
          />
        ))}
      </FGroup>
      <FGroup title="Namirnice" count={f.items.length}>
        <FSearch value={itemQ} onChange={setItemQ} placeholder="Traži namirnicu" />
        <div className="fscroll">
          {usedItems
            .filter((i) => !itemQ.trim() || i.n.toLowerCase().includes(itemQ.trim().toLowerCase()))
            .map((i) => (
              <FCheck
                key={i.id}
                on={f.items.includes(i.id)}
                label={i.n}
                count={itemCount(i.id)}
                onChange={() => set({ items: toggle(f.items, i.id) })}
              />
            ))}
        </div>
        <p className="fhint">{isPrep ? "Prep" : "Recept"} mora imati sve odabrane namirnice.</p>
      </FGroup>
      <FGroup title={isPrep ? "Moj prep" : "Moji recepti"} count={f.mine ? 1 : 0}>
        <FCheck
          on={f.mine}
          label={isPrep ? "Samo prep koji sam dodao" : "Samo recepti koje sam dodao"}
          count={base.filter((e) => e.custom).length}
          onChange={() => set({ mine: !f.mine })}
        />
      </FGroup>
      {isPrep && (
        <p className="fhint">
          Prep je recept koji radiš unaprijed. „Napravio sam” skida namirnice i dodaje pripremljeno, a recepti koji ga
          imaju kao dio troše pripremljeno umjesto namirnica.
        </p>
      )}
    </>
  );

  return (
    <Page
      id={isPrep ? "prep" : "recepti"}
      title={isPrep ? "Prep" : "Recepti"}
      count={
        override ? undefined : (
          <>
            <b>{list.length}</b> od {all.length}
          </>
        )
      }
      filters={override ? undefined : filters}
      search={override ? undefined : search}
      active={chips.length}
      onClear={clearAll}
      chips={override ? [] : chips}
      tabs={tabs}
      actions={
        <>
          {!override && (
            <label className="sortsel">
              <span className="sr-only">Poredaj</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Poredaj">
                {SORTS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isPrep ? (
            <button type="button" className="btn" onClick={() => open({ t: "newPrep" })}>
              <Icon name="plus" size={18} /> Novi prep
            </button>
          ) : (
            <>
              <button type="button" className="btn ghost" onClick={() => open({ t: "importRecipe" })}>
                <Icon name="link" size={18} /> Recept iz linka
              </button>
              <button type="button" className="btn" onClick={() => open({ t: "newRecipe" })}>
                <Icon name="plus" size={18} /> Novi recept
              </button>
            </>
          )}
        </>
      }
    >
      {override ??
        (list.length ? (
          <div className="tablewrap">
            <table className="grid rows cards-mobile" aria-label={isPrep ? "Prep" : "Recepti"}>
              <thead>
                <tr>
                  <th className="sticky">{isPrep ? "Prep" : "Recept"}</th>
                  <th>Vrsta</th>
                  <th>Način</th>
                  {!isPrep && <th>Prilog</th>}
                  <th>Protein</th>
                  <th className="num">kcal</th>
                  <th className="num">Proteini</th>
                  <th className="num">Cijena</th>
                  <th className="num">Vrijeme</th>
                  <th>Sastojci</th>
                  {isPrep && (
                    <>
                      <th>Čuvanje</th>
                      <th className="num">Imaš</th>
                      <th className="num">Za plan</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <Row
                    key={e.key}
                    e={e}
                    kindN={kindN}
                    onOpen={() => openEntry(e)}
                    prepCells={isPrep ? <PrepCells id={e.id} need={inPlan[e.id] ?? 0} /> : undefined}
                  />
                ))}
              </tbody>
            </table>
            <div className="tblfoot">
              <span>
                {isPrep
                  ? "Brojke su za jednu turu. Klik otvara prep sa strane."
                  : "Brojke su po obroku, za doručak (omlet) po porciji. Klik na recept otvara ga sa strane."}
              </span>
            </div>
          </div>
        ) : (
          <div className="empty">
            {all.length ? (
              <>
                <b>{isPrep ? "Nijedan prep ne odgovara." : "Nijedan recept ne odgovara."}</b>
                <span>Makni neki filter ili dodaj svoj.</span>
              </>
            ) : (
              <>
                <b>{isPrep ? "Još nemaš prepa." : "Još nemaš recepata."}</b>
                <span>
                  {isPrep
                    ? "Dodaj prvi s „Novi prep”."
                    : "Dodaj prvi s „Novi recept” ili ga uvezi s „Recept iz linka”."}
                </span>
              </>
            )}
          </div>
        ))}
    </Page>
  );
}

/** Čuvanje, pripremljeno i potreba za plan u retku prepa */
function PrepCells({ id, need }: { id: string; need: number }) {
  const { data } = useApp();
  const p = prepOf(data, id);
  if (!p) return null;
  const unit = prepInv(data, id)?.unit ?? "porcija";
  const have = pc(data, id);
  return (
    <>
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
        {have > 0 ? pfmt(have, unit) : "–"}
      </td>
      <td data-l="Za plan" className={"num" + (need > have + 1e-9 ? " t-out" : "")}>
        {need ? pfmt(need, unit) : "–"}
      </td>
    </>
  );
}

export function ReceptiTab() {
  return <RecipeList mode="meal" />;
}

import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { allItems } from "../logic/items";
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
  sortFeed,
} from "../logic/feed";
import type { FeedEntry, FeedFilter, Kind, SortKey } from "../logic/feed";
import { eur } from "../logic/format";
import { usePanel } from "../components/Panel";
import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";
import { FCheck, FGroup, FSearch, Page, toggle } from "../components/Page";
import type { Chip } from "../components/Page";

const KIND_ICON: Record<Kind, IconName> = { meal: "recepti", om: "omlet", prep: "prep" };
const carbCls = (c: string) => `cc-${c.replace(/\s/g, "") || "none"}`;
const n = (v: number | null, suf = "") => (v == null ? "–" : v.toLocaleString("hr-HR") + suf);

/** Kvadratić s ikonom: boja po prilogu (obroci) ili vrsti */
export function Thumb({ kind, carb }: { kind: Kind; carb: string }) {
  return (
    <span className={`thumb k-${kind} ${carbCls(carb)}`} aria-hidden="true">
      <Icon name={KIND_ICON[kind]} size={20} />
    </span>
  );
}

function Row({ e, onOpen }: { e: FeedEntry; onOpen: () => void }) {
  const all = e.total > 0 && e.have >= e.total;
  const approx = e.macKnown > 0 && e.macKnown < e.items.length ? "≈ " : "";
  return (
    <tr className="rowlink" onClick={onOpen}>
      <td className="sticky namecol">
        <div className="ent">
          <Thumb kind={e.kind} carb={e.carb} />
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
              {[e.method, e.time ? `${e.time} min` : ""].filter(Boolean).join(" · ") || e.d}
            </span>
          </div>
        </div>
      </td>
      <td data-l="Oznake" className="muted">
        {e.tags.filter((t) => t !== "2 u 1").join(", ")}
      </td>
      <td data-l="Prilog">{e.carb && <span className={`chip carb-chip ${carbCls(e.carb)}`}>{e.carb}</span>}</td>
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
    </tr>
  );
}

export function ReceptiTab() {
  const { data } = useApp();
  const { open } = usePanel();
  const [f, setF] = useState<FeedFilter>(emptyFilter);
  const [sort, setSort] = useState<SortKey>("pre");
  const [itemQ, setItemQ] = useState("");
  const all = useMemo(() => feed(data), [data]);
  const list = sortFeed(filterFeed(all, f, data), sort);
  const tagCounts = facetCounts(all, f, data, "tags");
  const tagList = [
    ...TAG_ORDER.filter((t) => all.some((e) => e.tags.includes(t))),
    ...[...new Set(all.flatMap((e) => e.tags))].filter((t) => !TAG_ORDER.includes(t)),
  ];
  const prots = facetCounts(all, f, data, "prot");
  const carbs = facetCounts(all, f, data, "carb");
  const set = (p: Partial<FeedFilter>) => setF({ ...f, ...p });

  const protList = [
    ...PROT_GROUPS.map(([g]) => g),
    ...Object.keys(prots).filter((p) => !PROT_GROUPS.some(([g]) => g === p)),
  ];
  const carbList = CARB_ORDER.filter((c) => all.some((e) => e.carb === c));

  const usedItems = useMemo(() => {
    const ids = new Set(all.flatMap((e) => e.items));
    return allItems(data)
      .filter((i) => ids.has(i.id))
      .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  }, [all, data]);
  const itemCount = (id: string) =>
    all.filter((e) => matches(e, { ...f, items: [...f.items.filter((x) => x !== id), id] }, data)).length;

  const chips: Chip[] = [
    ...f.tags.map((k): Chip => [k, () => set({ tags: toggle(f.tags, k) })]),
    ...f.prot.map((p): Chip => [p, () => set({ prot: toggle(f.prot, p) })]),
    ...f.carb.map((c): Chip => [c, () => set({ carb: toggle(f.carb, c) })]),
    ...f.items.map((id): Chip => [
      "s: " + (allItems(data).find((i) => i.id === id)?.n ?? id),
      () => set({ items: toggle(f.items, id) }),
    ]),
    ...(f.avail ? [[f.avail === "all" ? "Imam sve" : "Fale najviše 2", () => set({ avail: "" })] as Chip] : []),
    ...(f.time ? [[`do ${f.time} min`, () => set({ time: 0 })] as Chip] : []),
    ...(f.mine ? [["Moji recepti", () => set({ mine: false })] as Chip] : []),
  ];

  const openEntry = (e: FeedEntry) => {
    if (e.kind === "meal") open({ t: "meal", id: e.id });
    else if (e.kind === "om") open({ t: "om", sel: e.sel, n: e.n });
    else open({ t: "prep", id: e.id });
  };

  const search = (
    <FSearch id="recipeSearch" value={f.q} onChange={(q) => set({ q })} placeholder="Traži recept ili sastojak" />
  );

  const filters = (
    <>
      <FGroup title="Oznake" count={f.tags.length}>
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
      <FGroup title="Dostupnost" count={f.avail ? 1 : 0}>
        {(
          [
            ["", "Svi recepti"],
            ["all", "Imam sve sastojke"],
            ["max2", "Fale najviše 2"],
          ] as [FeedFilter["avail"], string][]
        ).map(([k, l]) => (
          <FCheck
            key={k || "sve"}
            radio
            on={f.avail === k}
            label={l}
            count={all.filter((e) => matches(e, { ...f, avail: k }, data)).length}
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
            count={all.filter((e) => matches(e, { ...f, time: t }, data)).length}
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
        <p className="fhint">Recept mora imati sve odabrane namirnice.</p>
      </FGroup>
      <FGroup title="Moji recepti" count={f.mine ? 1 : 0}>
        <FCheck
          on={f.mine}
          label="Samo recepti koje sam dodao"
          count={all.filter((e) => e.custom).length}
          onChange={() => set({ mine: !f.mine })}
        />
      </FGroup>
    </>
  );

  return (
    <Page
      id="recepti"
      title="Recepti"
      count={
        <>
          <b>{list.length}</b> od {all.length}
        </>
      }
      filters={filters}
      search={search}
      active={chips.length}
      onClear={() => setF({ ...emptyFilter(), q: f.q })}
      chips={chips}
      actions={
        <>
          <label className="sortsel">
            <span className="sr-only">Poredaj</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Poredaj recepte">
              {SORTS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn ghost" onClick={() => open({ t: "importRecipe" })}>
            <Icon name="link" size={18} /> Recept iz linka
          </button>
          <button type="button" className="btn" onClick={() => open({ t: "newRecipe" })}>
            <Icon name="plus" size={18} /> Novi recept
          </button>
        </>
      }
    >
      {list.length ? (
        <div className="tablewrap">
          <table className="grid rows cards-mobile" aria-label="Recepti">
            <thead>
              <tr>
                <th className="sticky">Recept</th>
                <th>Oznake</th>
                <th>Prilog</th>
                <th>Protein</th>
                <th className="num">kcal</th>
                <th className="num">Proteini</th>
                <th className="num">Cijena</th>
                <th className="num">Vrijeme</th>
                <th>Sastojci</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <Row key={e.key} e={e} onOpen={() => openEntry(e)} />
              ))}
            </tbody>
          </table>
          <div className="tblfoot">
            <span>
              Brojke su po obroku, za omlet po omletu, a za prep za cijelu turu. Klik na recept otvara ga sa strane.
            </span>
          </div>
        </div>
      ) : (
        <div className="empty">
          <b>Nijedan recept ne odgovara.</b>
          <span>Makni neki filter ili dodaj svoj recept.</span>
        </div>
      )}
    </Page>
  );
}

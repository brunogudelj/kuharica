import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_OM } from "../data";
import { useApp } from "../state/AppContext";
import { allItems } from "../logic/items";
import {
  CARB_ORDER,
  KIND_LABEL,
  PROT_GROUPS,
  SORTS,
  emptyFilter,
  facetCounts,
  feed,
  filterFeed,
  matches,
  sortFeed,
} from "../logic/feed";
import type { FeedEntry, FeedFilter, Kind, SortKey } from "../logic/feed";
import { FeedCard } from "../components/RecipeViews";
import { usePanel } from "../components/Panel";
import { Icon } from "../components/icons";

/** Padajući izbornik filtera */
function Drop({ label, active, children }: { label: string; active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", out);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="drop" ref={ref}>
      <button
        type="button"
        className={"dropbtn" + (active ? " on" : "")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
        {active > 0 && <span className="badge">{active}</span>}
        <Icon name="chev" size={16} />
      </button>
      {open && <div className="dropmenu">{children}</div>}
    </div>
  );
}

function Check({
  on,
  label,
  count,
  onChange,
  radio,
}: {
  on: boolean;
  label: string;
  count?: number;
  onChange: () => void;
  radio?: boolean;
}) {
  return (
    <label className={"checkrow" + (count === 0 && !on ? " dim" : "")}>
      <input type={radio ? "radio" : "checkbox"} checked={on} onChange={onChange} />
      <span>{label}</span>
      {count != null && <small>{count}</small>}
    </label>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function ReceptiTab() {
  const { data } = useApp();
  const { open } = usePanel();
  const [f, setF] = useState<FeedFilter>(emptyFilter);
  const [sort, setSort] = useState<SortKey>("pre");
  const [itemQ, setItemQ] = useState("");
  const all = useMemo(() => feed(data), [data]);
  const list = sortFeed(filterFeed(all, f, data), sort);
  const kinds = facetCounts(all, f, data, "kind");
  const prots = facetCounts(all, f, data, "prot");
  const carbs = facetCounts(all, f, data, "carb");
  const set = (p: Partial<FeedFilter>) => setF({ ...f, ...p });

  const protList = [
    ...PROT_GROUPS.map(([g]) => g),
    ...Object.keys(prots).filter((p) => !PROT_GROUPS.some(([g]) => g === p)),
  ];
  const carbList = CARB_ORDER.filter((c) => all.some((e) => e.carb === c));

  // namirnice koje se pojavljuju u receptima, s brojem recepata uz trenutne filtere
  const usedItems = useMemo(() => {
    const ids = new Set(all.flatMap((e) => e.items));
    return allItems(data)
      .filter((i) => ids.has(i.id))
      .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  }, [all, data]);
  const itemCount = (id: string) =>
    all.filter((e) => matches(e, { ...f, items: [...f.items.filter((x) => x !== id), id] }, data)).length;

  const chips: [string, () => void][] = [
    ...f.kind.map((k): [string, () => void] => [KIND_LABEL[k], () => set({ kind: toggle(f.kind, k) })]),
    ...f.prot.map((p): [string, () => void] => [p, () => set({ prot: toggle(f.prot, p) })]),
    ...f.carb.map((c): [string, () => void] => [c, () => set({ carb: toggle(f.carb, c) })]),
    ...f.items.map((id): [string, () => void] => [
      "s: " + (allItems(data).find((i) => i.id === id)?.n ?? id),
      () => set({ items: toggle(f.items, id) }),
    ]),
    ...(f.avail ? [[f.avail === "all" ? "Imam sve" : "Fale najviše 2", () => set({ avail: "" })] as [string, () => void]] : []),
    ...(f.time ? [[`do ${f.time} min`, () => set({ time: 0 })] as [string, () => void]] : []),
    ...(f.mine ? [["Moji recepti", () => set({ mine: false })] as [string, () => void]] : []),
  ];

  const openEntry = (e: FeedEntry) => {
    if (e.kind === "meal") open({ t: "meal", id: e.id });
    else if (e.kind === "om") open({ t: "om", sel: e.sel, n: e.n });
    else open({ t: "prep", id: e.id });
  };

  return (
    <section id="recepti" aria-labelledby="tab-recepti">
      <div className="toolbar">
        <div className="searchbox grow">
          <Icon name="search" size={18} />
          <input
            id="recipeSearch"
            type="search"
            placeholder="Traži recept ili sastojak"
            aria-label="Traži recept ili sastojak"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
        <button type="button" className="btn" onClick={() => open({ t: "newRecipe" })}>
          <Icon name="plus" size={18} /> Novi recept
        </button>
        <button type="button" className="btn ghost" onClick={() => open({ t: "om", sel: DEFAULT_OM })}>
          <Icon name="plus" size={18} /> Složi omlet
        </button>
      </div>

      <div className="filterbar" role="group" aria-label="Filteri recepata">
        <Drop label="Vrsta" active={f.kind.length}>
          {(["meal", "om", "prep"] as Kind[]).map((k) => (
            <Check
              key={k}
              on={f.kind.includes(k)}
              label={KIND_LABEL[k]}
              count={kinds[k] || 0}
              onChange={() => set({ kind: toggle(f.kind, k) })}
            />
          ))}
        </Drop>
        <Drop label="Protein" active={f.prot.length}>
          {protList.map((p) => (
            <Check key={p} on={f.prot.includes(p)} label={p} count={prots[p] || 0} onChange={() => set({ prot: toggle(f.prot, p) })} />
          ))}
        </Drop>
        <Drop label="Ugljikohidrat" active={f.carb.length}>
          {carbList.map((c) => (
            <Check key={c} on={f.carb.includes(c)} label={c} count={carbs[c] || 0} onChange={() => set({ carb: toggle(f.carb, c) })} />
          ))}
        </Drop>
        <Drop label="Namirnice" active={f.items.length}>
          <div className="searchbox small">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Traži namirnicu"
              aria-label="Traži namirnicu"
              value={itemQ}
              onChange={(e) => setItemQ(e.target.value)}
            />
          </div>
          <div className="dropscroll">
            {usedItems
              .filter((i) => !itemQ.trim() || i.n.toLowerCase().includes(itemQ.trim().toLowerCase()))
              .map((i) => (
                <Check
                  key={i.id}
                  on={f.items.includes(i.id)}
                  label={i.n}
                  count={itemCount(i.id)}
                  onChange={() => set({ items: toggle(f.items, i.id) })}
                />
              ))}
          </div>
          <p className="drophint">Recept mora imati sve odabrane namirnice.</p>
        </Drop>
        <Drop label="Dostupnost" active={f.avail ? 1 : 0}>
          {(
            [
              ["", "Svi recepti"],
              ["all", "Imam sve sastojke"],
              ["max2", "Fale najviše 2"],
            ] as [FeedFilter["avail"], string][]
          ).map(([k, l]) => (
            <Check
              key={k || "sve"}
              radio
              on={f.avail === k}
              label={l}
              count={all.filter((e) => matches(e, { ...f, avail: k }, data)).length}
              onChange={() => set({ avail: k })}
            />
          ))}
        </Drop>
        <Drop label="Vrijeme" active={f.time ? 1 : 0}>
          {[0, 15, 25, 30].map((t) => (
            <Check
              key={t}
              radio
              on={f.time === t}
              label={t ? `do ${t} min` : "Bilo koliko"}
              count={all.filter((e) => matches(e, { ...f, time: t }, data)).length}
              onChange={() => set({ time: t })}
            />
          ))}
        </Drop>
        <button type="button" className={"dropbtn" + (f.mine ? " on" : "")} aria-pressed={f.mine} onClick={() => set({ mine: !f.mine })}>
          Moji recepti
        </button>
        <span className="grow" />
        <label className="inline-label sortsel">
          Poredaj
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="resultbar">
        <span>
          <b>{list.length}</b> {list.length === 1 ? "recept" : list.length >= 2 && list.length <= 4 ? "recepta" : "recepata"}
        </span>
        {chips.map(([l, rm]) => (
          <button key={l} type="button" className="chip removable" onClick={rm} aria-label={`Makni filter: ${l}`}>
            {l} <Icon name="close" size={12} />
          </button>
        ))}
        {chips.length > 0 && (
          <button type="button" className="linkbtn" onClick={() => setF({ ...emptyFilter(), q: f.q })}>
            Očisti filtere
          </button>
        )}
      </div>

      {list.length ? (
        <div className="cardgrid">
          {list.map((e) => (
            <FeedCard key={e.key} e={e} onOpen={() => openEntry(e)} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <b>Nijedan recept ne odgovara.</b>
          <span>Makni neki filter ili dodaj svoj recept.</span>
        </div>
      )}
    </section>
  );
}

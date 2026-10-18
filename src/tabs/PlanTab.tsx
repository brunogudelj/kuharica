import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { CYCLE } from "../data";
import { useApp } from "../state/AppContext";
import { clone, cycleIx, daySlots } from "../state/model";
import { dayDate, dayLabel, dayName, todayKey, windowKeys } from "../logic/dates";
import type { AppData, Slot } from "../state/model";
import { dayCost, qty, shopping, slotUse, weekNeeds } from "../logic/inventory";
import type { NeedRow } from "../logic/inventory";
import {
  addSlot,
  autoFillPlan,
  clearAhead,
  defaultFruitQty,
  moveSlot,
  removeSlot,
  setCycleToday,
  setSlot,
  slotLabel,
  toggleSlot,
} from "../logic/actions";
import { allRecipes, recipeName, recipeOf } from "../logic/recipes";
import { allItems, itemOf } from "../logic/items";
import { mealEntry } from "../logic/feed";
import { eur, fmt, porcTxt, stavki } from "../logic/format";
import { shopIndex, shopName } from "../logic/shops";
import { Icon } from "../components/icons";
import { usePanel } from "../components/Panel";
import { SortTh } from "../components/Cells";
import { FGroup, Page } from "../components/Page";

type NK = "n" | "shop" | "need" | "have" | "short" | "cost";

/** Namirnice koje traži plan za ovaj tjedan */
function WeekNeeds({ data }: { data: AppData }) {
  const { update } = useApp();
  const toShop = () =>
    update((d) => {
      const n = clone(d);
      n.ui.tab = "kupovina";
      n.ui.kupFocus = "plan";
      return n;
    });
  const [sort, setSort] = useState<{ k: NK; dir: 1 | -1 }>({ k: "shop", dir: 1 });
  const rows = weekNeeds(data);
  const short = rows.filter((r) => r.short > 0.0001);
  const total = short.reduce((s, r) => s + (r.cost ?? 0), 0);
  const val: Record<NK, (r: NeedRow) => number | string> = {
    n: (r) => r.i.n,
    shop: (r) => shopIndex(data, r.i.src) * 1000 + (r.short > 0 ? 0 : 500),
    need: (r) => r.need,
    have: (r) => r.have,
    short: (r) => r.short,
    cost: (r) => r.cost ?? -1,
  };
  const sorted = rows.slice().sort((a, b) => {
    const x = val[sort.k](a);
    const y = val[sort.k](b);
    const c = typeof x === "string" ? x.localeCompare(y as string, "hr") : x - (y as number);
    return c * sort.dir || a.i.n.localeCompare(b.i.n, "hr");
  });
  const grouped = sort.k === "shop";
  if (!rows.length)
    return (
      <div className="empty">
        <b>Plan je prazan.</b>
        <span>Dodaj recepte i omlete u kalendar pa ćeš ovdje vidjeti sve namirnice za tjedan.</span>
      </div>
    );

  return (
    <div>
      {
        <div className="tablewrap">
          <table className="grid">
            <thead>
              <tr>
                <SortTh k="n" sort={sort} setSort={setSort} className="sticky">
                  Namirnica
                </SortTh>
                <SortTh k="shop" sort={sort} setSort={setSort}>
                  Dućan
                </SortTh>
                <SortTh k="need" sort={sort} setSort={setSort} className="num">
                  Treba
                </SortTh>
                <SortTh k="have" sort={sort} setSort={setSort} className="num">
                  Imaš
                </SortTh>
                <SortTh k="short" sort={sort} setSort={setSort} className="num">
                  Fali
                </SortTh>
                <th className="num">€/pak.</th>
                <SortTh k="cost" sort={sort} setSort={setSort} className="num">
                  Procjena
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, ix) => {
                const head = grouped && (ix === 0 || sorted[ix - 1].i.src !== r.i.src);
                return (
                  <Fragment key={r.i.id}>
                    {head && (
                      <tr className="grouprow">
                        <td className="sticky" colSpan={7}>
                          {shopName(data, r.i.src)}
                        </td>
                      </tr>
                    )}
                    <tr className={r.short > 0.0001 ? "st-out" : "st-ok"}>
                      <td className="sticky namecell">
                        <span className={"dot " + (r.short > 0.0001 ? "out" : "ok")} aria-hidden="true" />
                        {r.i.n}
                      </td>
                      <td className="muted">{shopName(data, r.i.src)}</td>
                      <td className="num">{fmt(r.need, r.i.u)}</td>
                      <td className="num">{fmt(r.have, r.i.u)}</td>
                      <td className="num strong">{r.short > 0.0001 ? fmt(r.short, r.i.u) : "–"}</td>
                      <td className="num muted">{r.price != null ? eur(r.price) : "–"}</td>
                      <td className="num">{r.cost != null && r.packs ? eur(r.cost) : "–"}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="tblfoot">
            <span>
              {rows.length} namirnica · fali <b className={short.length ? "t-out" : "t-ok"}>{short.length}</b>
            </span>
            {total > 0 && (
              <span className="tblsum">
                Za dokupiti ≈ <b>{eur(total)}</b>
              </span>
            )}
          </div>
        </div>
      }
      {short.length > 0 ? (
        <div className="needsbar">
          <span>
            {short.length === 1
              ? "Namirnica koja fali već je"
              : short.length <= 4
                ? `Sve ${short.length} namirnice koje fale već su`
                : `Svih ${short.length} namirnica koje fale već su`}{" "}
            na popisu za kupovinu, s količinom zaokruženom na cijela pakiranja.
          </span>
          <button type="button" className="btn" onClick={toShop}>
            <Icon name="kupovina" size={18} /> Otvori popis za kupovinu ({short.length})
          </button>
        </div>
      ) : (
        <p className="ready">Imaš sve za ovaj tjedan.</p>
      )}
    </div>
  );
}

type Opt = [value: string, label: string];
type OptGroup = [label: string, opts: Opt[]];

/** Padajući izbornik: prazan slot ("+ Dodaj …") ili ikona za zamjenu preko popunjenog */
function PickSelect({
  groups,
  onPick,
  label,
  swap,
  hint,
}: {
  groups: OptGroup[];
  onPick: (v: string) => void;
  label: string;
  swap?: boolean;
  hint?: string;
}) {
  const sel = (
    <select
      aria-label={label}
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="">{swap ? "Zamijeni…" : label}</option>
      {groups
        .filter(([, o]) => o.length)
        .map(([g, o]) => (
          <optgroup key={g} label={g}>
            {o.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </optgroup>
        ))}
    </select>
  );
  if (swap)
    return (
      <span className="mini swapsel" title={label}>
        <Icon name="swap" size={16} />
        {sel}
      </span>
    );
  return (
    <label className="cell addcell selcell">
      <span className="addtxt">
        <Icon name="plus" size={16} /> {label}
      </span>
      {hint && <small>{hint}</small>}
      {sel}
    </label>
  );
}

/** Obrok u kalendaru: naziv (klik otvara recept), porcije, stanje, zamjena, brisanje, kvačica */
function Cell({
  cls,
  name,
  meta,
  flag,
  flagCls,
  onOpen,
  tools,
  onRemove,
  done,
  onTick,
  tickLabel,
}: {
  cls: string;
  name: string;
  meta?: string;
  flag: string;
  flagCls: string;
  onOpen?: () => void;
  tools: ReactNode;
  onRemove: () => void;
  done: boolean;
  onTick: () => void;
  tickLabel: string;
}) {
  return (
    <div className={"cell slot " + cls + (done ? " done" : "")}>
      {onOpen ? (
        <button type="button" className="cname linkname" title="Otvori recept" onClick={onOpen}>
          {name}
        </button>
      ) : (
        <span className="cname">{name}</span>
      )}
      {meta && <span className="cmeta">{meta}</span>}
      {flag && <span className={"flag " + flagCls}>{flag}</span>}
      <div className="crow">
        {!done && tools}
        {!done && (
          <button type="button" className="mini" aria-label={`Makni: ${name}`} onClick={onRemove}>
            <Icon name="close" size={14} />
          </button>
        )}
        <button type="button" className="tick-btn small" aria-pressed={done} aria-label={tickLabel} onClick={onTick}>
          <Icon name="check" size={14} />
        </button>
      </div>
    </div>
  );
}

const PORC = [0.5, 1, 1.5, 2, 3];

export function PlanTab() {
  const { data, apply, update } = useApp();
  const { open } = usePanel();
  const { plan } = data;
  const now = Date.now();
  const keys = windowKeys(now);
  const today = todayKey(now);
  const ahead = keys.filter((k) => k >= today);
  const shopDays = data.settings.shopDays || 7;

  // isti izbor za svaki obrok: bilo koji recept (1 porcija) ili namirnica
  const recipes = allRecipes(data)
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n, "hr"));
  const has = (r: (typeof recipes)[number], ...k: string[]) => !!r.kinds?.some((x) => k.includes(x));
  const bf = recipes.filter((r) => has(r, "omlet", "dorucak"));
  const soups = recipes.filter((r) => !bf.includes(r) && (r.side === "juha" || has(r, "juha")));
  const salads = recipes.filter((r) => !bf.includes(r) && (r.side === "salata" || has(r, "salata")));
  const rest = recipes.filter((r) => !bf.includes(r) && !soups.includes(r) && !salads.includes(r));
  const fruits = allItems(data)
    .filter((i) => i.grp === "voce")
    .sort((x, y) => x.n.localeCompare(y.n, "hr"));
  const groupsFor = (k: string): OptGroup[] => {
    const cy = CYCLE[cycleIx(plan, k)];
    const carbs = (["Riža", "Krumpir", "Tjestenina", "Ostalo"] as const)
      .slice()
      .sort((a, b) => (a === cy ? -1 : b === cy ? 1 : 0));
    return [
      ["Doručak i omleti", bf.map((r): Opt => ["r:" + r.id, r.n])],
      ["Juhe", soups.map((r): Opt => ["r:" + r.id, r.n])],
      ...carbs.map((c): OptGroup => [
        c === cy ? `${c} (ciklus)` : c,
        rest.filter((r) => r.c === c).map((r): Opt => ["r:" + r.id, r.n]),
      ]),
      ["Salate", salads.map((r): Opt => ["r:" + r.id, r.n])],
      [
        "Voće",
        fruits.map((i): Opt => ["i:" + i.id, qty(data, i.id) > 0 ? `${i.n} (imaš ${fmt(qty(data, i.id), i.u)})` : i.n]),
      ],
    ];
  };
  const parse = (v: string): Omit<Slot, "id" | "done"> | null => {
    if (v.startsWith("r:")) return { r: v.slice(2) };
    const i = itemOf(data, v.slice(2));
    return i ? { item: i.id, qty: defaultFruitQty(i) } : null;
  };
  const add = (k: string, v: string) => {
    const x = parse(v);
    if (x) apply(addSlot(data, k, x), `${slotLabel(data, x)} za ${dayLabel(k)}.`);
  };
  const swap = (k: string, id: string, v: string) => {
    const x = parse(v);
    if (x) apply(setSlot(data, k, id, x), `${slotLabel(data, x)} za ${dayLabel(k)}.`);
  };

  // brojke za razdoblje popisa za kupovinu (od danas)
  const horizon = ahead.slice(0, shopDays);
  const meals = horizon.flatMap((k) => daySlots(plan, k));
  const eaten = meals.filter((x) => x.done).length;
  const emptyDays = horizon.filter((k) => !daySlots(plan, k).length).length;
  const dayTotals = horizon
    .filter((k) => daySlots(plan, k).length)
    .map((k) =>
      daySlots(plan, k).reduce(
        (t, x) => {
          if (!x.r) return t;
          const e = mealEntry(data, x.r);
          const sv = x.s ?? 1;
          return { k: t.k + (e?.kcal ?? 0) * sv, p: t.p + (e?.p ?? 0) * sv };
        },
        { k: 0, p: 0 },
      ),
    );
  const avg = (f: (t: { k: number; p: number }) => number) =>
    dayTotals.length ? Math.round(dayTotals.reduce((a, t) => a + f(t), 0) / dayTotals.length) : 0;
  const planCost = horizon.reduce((t, k) => t + dayCost(data, k).c, 0);
  const shop = shopping(data).length;
  const cyc = cycleIx(plan, today);

  const tab = data.ui.planView ?? "cal";
  const setView = (v: "cal" | "needs") =>
    update((d) => {
      const n = clone(d);
      n.ui.planView = v;
      return n;
    });
  const needs = weekNeeds(data);
  const needShort = needs.filter((r) => r.short > 0.0001).length;
  const goShop = () =>
    update((d) => {
      const n = clone(d);
      n.ui.tab = "kupovina";
      return n;
    });

  const side = (
    <>
      <div className="fblock">
        <label htmlFor="cycleStart" className="flabel">
          Danas je u ciklusu
        </label>
        <select
          id="cycleStart"
          value={String(cyc)}
          onChange={(e) => apply(setCycleToday(data, Number(e.target.value)), "Ciklus je pomaknut.")}
        >
          {CYCLE.map((c, i) => (
            <option key={i} value={i}>
              {i + 1}. dan: {c}
            </option>
          ))}
        </select>
        <button
          className="btn wide"
          type="button"
          onClick={() => apply(autoFillPlan(data), "Plan je popunjen: dodano je ono što je danima falilo.")}
        >
          Popuni plan
        </button>
        <button
          className="btn ghost wide"
          type="button"
          onClick={() => apply(clearAhead(data), "Plan od danas je očišćen.")}
        >
          Očisti plan od danas
        </button>
        <label htmlFor="shopDays" className="flabel">
          Popis za kupovinu pokriva
        </label>
        <select
          id="shopDays"
          value={String(shopDays)}
          onChange={(e) =>
            update((d) => {
              const n = clone(d);
              n.settings.shopDays = Number(e.target.value);
              return n;
            })
          }
        >
          {[3, 5, 7, 10, 13].map((n) => (
            <option key={n} value={n}>
              {n} dana od danas
            </option>
          ))}
        </select>
        <p className="fhint">
          Plan ide 14 dana: jučer, danas i 12 dana unaprijed. Svaki obrok je bilo koji recept, po defaultu 1 porcija.
          „Popuni plan” slaže doručak, juhu, ručak po ciklusu, salatu, večeru i voće.
        </p>
      </div>

      <FGroup title={`Sljedećih ${shopDays} dana`} open>
        <dl className="kv">
          <div>
            <dt>Obroci</dt>
            <dd>
              <b>{eaten}</b>/{meals.length} pojedeno
              {emptyDays > 0 && <small> · {emptyDays} praznih dana</small>}
            </dd>
          </div>
          <div>
            <dt>Prosječno na dan</dt>
            <dd>
              {dayTotals.length ? (
                <>
                  <b>{avg((t) => t.k)} kcal</b> · {avg((t) => t.p)} g prot.
                </>
              ) : (
                "–"
              )}
            </dd>
          </div>
          <div>
            <dt>Plan košta</dt>
            <dd>{planCost > 0 ? <b>{eur(planCost)}</b> : <small>upiši cijene u Zalihi</small>}</dd>
          </div>
          <div>
            <dt>Za kupiti</dt>
            <dd>
              <button type="button" className="linkbtn" onClick={goShop}>
                {shop ? `${stavki(shop)} →` : "ništa ne fali"}
              </button>
            </dd>
          </div>
        </dl>
      </FGroup>

      <FGroup title="Zadnje skuhano" open={false}>
        {data.hist.length ? (
          <ul className="hist">
            {data.hist.slice(0, 8).map((h, i) => (
              <li key={i}>
                <b>{recipeName(data, h.r)}</b>
                <span>
                  {new Date(h.t).toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fhint">Još ništa. Kad skuhaš, pojavit će se ovdje.</p>
        )}
      </FGroup>
    </>
  );

  const colCls = (k: string) => (k === today ? " today" : k < today ? " past" : "");
  const rows = Math.max(5, ...keys.map((k) => daySlots(plan, k).length + 1));

  const slotCell = (k: string, x: Slot, ix: number) => {
    const list = daySlots(plan, k);
    const name = slotLabel(data, x);
    const r = x.r ? recipeOf(data, x.r) : undefined;
    const it = x.item ? itemOf(data, x.item) : undefined;
    const sv = x.s ?? 1;
    const e = x.r ? mealEntry(data, x.r) : null;
    const miss = x.done
      ? 0
      : Object.entries(slotUse(data, x, { ...data.prepStock }).use).filter(([id, a]) => qty(data, id) + 1e-9 < a)
          .length;
    return (
      <Cell
        cls={it ? "s-voce" : r?.side ? `s-${r.side}` : `s-${r?.c ?? "Ostalo"}`}
        name={name}
        meta={
          it
            ? fmt(x.qty ?? 1, it.u)
            : [e?.kcal != null ? `${Math.round(e.kcal * sv)} kcal` : "", porcTxt(sv)].filter(Boolean).join(" · ")
        }
        flag={x.done ? "" : miss ? (it ? "nema" : `fali ${miss}`) : it ? "" : "imaš sve"}
        flagCls={x.done ? "done" : miss ? "miss" : "ready"}
        onOpen={x.r ? () => open({ t: "meal", id: x.r!, day: k }) : undefined}
        tools={
          <>
            {ix > 0 && (
              <button
                type="button"
                className="mini"
                aria-label={`Pomakni gore: ${name}`}
                onClick={() => update((d) => moveSlot(d, k, x.id, -1))}
              >
                <span className="upchev">
                  <Icon name="chev" size={14} />
                </span>
              </button>
            )}
            {x.r && (
              <label className="mini porcsel" title="Porcije">
                <span>{String(sv).replace(".", ",")}×</span>
                <select
                  aria-label={`Porcije: ${name}`}
                  value={String(sv)}
                  onChange={(ev) => update((d) => setSlot(d, k, x.id, { s: Number(ev.target.value) }))}
                >
                  {PORC.map((p) => (
                    <option key={p} value={p}>
                      {porcTxt(p)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <PickSelect
              swap
              label={`Zamijeni: ${name}, ${dayLabel(k)}`}
              groups={groupsFor(k)}
              onPick={(v) => swap(k, x.id, v)}
            />
          </>
        }
        onRemove={() => apply(removeSlot(data, k, x.id), `${name} maknut (${dayLabel(k)}).`)}
        done={x.done}
        onTick={() => {
          const res = toggleSlot(data, k, x.id);
          apply(res.data, res.msg);
        }}
        tickLabel={`${x.done ? "Pojedeno" : "Pojeo sam"}: ${dayLabel(k)}, ${name}${list.length > 1 ? ` (${ix + 1}.)` : ""}`}
      />
    );
  };

  return (
    <Page
      id="plan"
      title="Plan"
      count={
        <>
          {dayDate(keys[0])} – {dayDate(keys[keys.length - 1])}
        </>
      }
      filters={side}
      filterTitle="Plan"
      tabs={
        <div className="seg" role="tablist" aria-label="Prikaz plana">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cal"}
            aria-pressed={tab === "cal"}
            onClick={() => setView("cal")}
          >
            Kalendar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "needs"}
            aria-pressed={tab === "needs"}
            onClick={() => setView("needs")}
          >
            Namirnice za {shopDays} dana <small>{needs.length}</small>
            {needShort > 0 && <span className="badge">{needShort}</span>}
          </button>
        </div>
      }
    >
      {tab === "needs" ? (
        <WeekNeeds data={data} />
      ) : (
        <>
          <div className="calwrap">
            <div className="cal cal14" role="grid" aria-label="Kalendar obroka, 14 dana">
              <div className="corner" />
              {keys.map((k) => (
                <div key={k} className={"ch" + colCls(k)} role="columnheader">
                  <b>{k === today ? "Danas" : k < today ? "Jučer" : dayName(k)}</b>
                  <small>
                    {dayDate(k)} · {CYCLE[cycleIx(plan, k)].toLowerCase()}
                  </small>
                </div>
              ))}
              {Array.from({ length: rows }, (_, ix) => (
                <Fragment key={ix}>
                  <div className="rh small" role="rowheader">
                    {ix + 1}.<small>obrok</small>
                  </div>
                  {keys.map((k) => {
                    const list = daySlots(plan, k);
                    const x = list[ix];
                    return (
                      <div key={k + ix} role="gridcell" className={colCls(k)}>
                        {x ? (
                          slotCell(k, x, ix)
                        ) : ix === list.length ? (
                          <PickSelect label="Dodaj obrok" groups={groupsFor(k)} onPick={(v) => add(k, v)} />
                        ) : null}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="sub">
            Svaki obrok je recept ili voće, po defaultu 1 porcija (1,5 porcija = ručak i večera iz jednog kuhanja). Klik
            na naziv otvara recept, kvačica znači pojedeno i skida sastojke sa zalihe. <Icon name="swap" size={14} />{" "}
            mijenja jelo, <Icon name="close" size={14} /> ga miče s dana.
          </p>
        </>
      )}
    </Page>
  );
}

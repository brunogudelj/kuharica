import { DAILY, DAILY_PREP, PREP_INV, REC_USE_PREP } from "../data";
import type { Item, Recipe, Use } from "../data";
import { recipeOf } from "./recipes";
import type { AppData } from "../state/model";
import { omEff, omUse } from "./omlet";
import { allItems, itemName, itemOf } from "./items";

export const qty = (d: AppData, id: string) => {
  const s = d.stock[id];
  return s && typeof s.qty === "number" ? s.qty : 0;
};
export const price = (d: AppData, id: string) => {
  const s = d.stock[id];
  return s && typeof s.price === "number" ? s.price : null;
};
export const pc = (d: AppData, id: string) => (typeof d.prepStock[id] === "number" ? d.prepStock[id] : 0);

/** Osnovna količina recepta je 1,5 porcija */
export const BASE_SERVINGS = 1.5;

export interface EffUse {
  use: Use;
  consumed: [string, number][];
}

/**
 * Što recept stvarno troši: sirovi sastojci × f, umanjeni za ono što pokrije pripremljeno.
 * Pripremljeno se troši iz `pcopy` (kopija stanja prepa koju funkcija mijenja).
 */
export function effUse(r: Recipe, pcopy: Record<string, number>, withDaily: boolean, f = 1): EffUse {
  const rid = r.id;
  const use: Use = {};
  for (const [id, a] of Object.entries(r.use)) use[id] = a * f;
  if (withDaily) for (const [id, a] of Object.entries(DAILY)) use[id] = (use[id] || 0) + a;
  const consumed: [string, number][] = [];
  const list: [string, number][] = (REC_USE_PREP[rid] || [])
    .map(([p, n]): [string, number] => [p, n * f])
    .concat(withDaily ? DAILY_PREP : []);
  for (const [pid, n] of list) {
    const k = Math.min(n, pcopy[pid] || 0);
    if (k <= 0) continue;
    pcopy[pid] -= k;
    consumed.push([pid, k]);
    for (const [id, a] of Object.entries(PREP_INV[pid].per))
      if (use[id] != null) use[id] = Math.max(0, use[id] - a * k);
  }
  for (const id of Object.keys(use)) if (use[id] < 0.001) delete use[id];
  return { use, consumed };
}

/** Potreba za tjedan: neskuhani dani (s dodacima i prepom) + nepojedeni omleti */
export function planNeeds(d: AppData): Use {
  const need: Use = {};
  const pcopy = { ...d.prepStock };
  d.plan.days.forEach((day) => {
    const r = day.r && !day.done ? recipeOf(d, day.r) : undefined;
    if (!r) return;
    for (const [id, a] of Object.entries(effUse(r, pcopy, true).use)) need[id] = (need[id] || 0) + a;
  });
  (d.plan.om || []).forEach((o) => {
    if (!o.done) for (const [id, a] of Object.entries(omEff(d, o.sel, 1, pcopy).use)) need[id] = (need[id] || 0) + a;
  });
  return need;
}

export interface ShopRow {
  i: Item;
  short: number;
  packs: number;
  cost: number | null;
  forPlan: boolean;
}

/** Popis za kupovinu: potreba + minimum − zaliha, zaokruženo na cijela pakiranja.
 * Skrivene namirnice nemaju minimum, ali ulaze u popis ako ih traži planirani recept ili omlet. */
export function shopping(d: AppData): ShopRow[] {
  const pn = planNeeds(d);
  return allItems(d)
    .map((i): ShopRow | null => {
      const min = d.items.hidden.includes(i.id) ? 0 : i.min;
      const want = (pn[i.id] || 0) + min;
      const short = want - qty(d, i.id);
      if (short <= 0.0001) return null;
      const packs = Math.max(1, Math.ceil(short / i.pack - 1e-9));
      const p = price(d, i.id);
      return { i, short, packs, cost: p != null ? packs * p : null, forPlan: (pn[i.id] || 0) > qty(d, i.id) };
    })
    .filter((x): x is ShopRow => x !== null);
}

export type Status = "ok" | "low" | "out" | "none";
export function status(d: AppData, i: Item): Status {
  const v = qty(d, i.id);
  if (v <= 0) return i.min > 0 ? "out" : "none";
  if (v < i.min) return "low";
  return "ok";
}

export function missingFor(d: AppData, rid: string, f = 1): string[] {
  const r = recipeOf(d, rid);
  if (!r) return [];
  return Object.entries(effUse(r, { ...d.prepStock }, false, f).use)
    .filter(([id, a]) => qty(d, id) + 1e-9 < a)
    .map(([id]) => itemName(d, id));
}

export const prepUsed = (d: AppData, rid: string, f = 1) => {
  const r = recipeOf(d, rid);
  return r ? effUse(r, { ...d.prepStock }, false, f).consumed : [];
};

/** Cijena sastojaka prema cijeni pakiranja iz zalihe */
export function costOf(d: AppData, use: Use) {
  let c = 0;
  let known = 0;
  let total = 0;
  for (const [id, a] of Object.entries(use)) {
    const it = itemOf(d, id);
    if (!it || a <= 0) continue;
    total++;
    const p = price(d, id);
    if (p != null) {
      c += (p / it.pack) * a;
      known++;
    }
  }
  return { c, known, total };
}

/** Trošak dana s receptom: obroci (recept + dodaci), po obroku, cijeli dan s omletom */
export function dayCost(d: AppData, rid: string) {
  const r = costOf(d, recipeOf(d, rid)?.use ?? {});
  const dl = costOf(d, DAILY);
  const oms = d.plan.om || [];
  const om = oms.length ? oms.reduce((s, o) => s + costOf(d, omUse(d, o.sel, 1)).c, 0) / oms.length : 0;
  return {
    meals: r.c + dl.c,
    perMeal: (r.c + dl.c) / 2,
    full: r.c + dl.c + om,
    known: r.known + dl.known,
    total: r.total + dl.total,
  };
}

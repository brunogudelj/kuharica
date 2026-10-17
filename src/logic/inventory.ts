import { DAILY, DAILY_COOK, PREP_INV, REC_USE_PREP } from "../data";
import type { Item, Recipe, Use } from "../data";
import { recipeOf } from "./recipes";
import type { AppData, Slot } from "../state/model";
import { SLOT_KEYS } from "../state/model";
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
  /** pripremljeno koje recept traži: koliko treba i koliko se uzima iz pripremljenog */
  prep: { id: string; need: number; used: number }[];
}

/** Prep sastojci recepta: vlastiti (r.prep) ili ugrađeni (REC_USE_PREP) */
export const prepListOf = (r: Recipe): [string, number][] => r.prep ?? REC_USE_PREP[r.id] ?? [];

/**
 * Što recept stvarno troši: sirovi sastojci × f, umanjeni za ono što pokrije pripremljeno.
 * Pripremljeno se troši iz `pcopy` (kopija stanja prepa koju funkcija mijenja).
 */
export function effUse(r: Recipe, pcopy: Record<string, number>, withDaily: boolean, f = 1): EffUse {
  const use: Use = {};
  for (const [id, a] of Object.entries(r.use)) use[id] = a * f;
  if (withDaily) for (const [id, a] of Object.entries(DAILY_COOK)) use[id] = (use[id] || 0) + a;
  const consumed: [string, number][] = [];
  const own = !!r.prep;
  const list: [string, number][] = prepListOf(r)
    .filter(([p]) => PREP_INV[p])
    .map(([p, n]): [string, number] => [p, n * f]);
  const prep: EffUse["prep"] = [];
  for (const [pid, n] of list) {
    const k = Math.max(0, Math.min(n, pcopy[pid] || 0));
    prep.push({ id: pid, need: n, used: k });
    if (k > 0) {
      pcopy[pid] -= k;
      consumed.push([pid, k]);
    }
    const per = PREP_INV[pid].per;
    if (own) {
      // vlastiti recept nema sirove sastojke prepa: za ono što fali troše se sirovi
      const short = n - k;
      if (short > 0) for (const [id, a] of Object.entries(per)) use[id] = (use[id] || 0) + a * short;
    } else if (k > 0) {
      // ugrađeni recept već ima sirove sastojke: pripremljeno ih zamjenjuje
      for (const [id, a] of Object.entries(per)) if (use[id] != null) use[id] = Math.max(0, use[id] - a * k);
    }
  }
  for (const id of Object.keys(use)) if (use[id] < 0.001) delete use[id];
  return { use, consumed, prep };
}

/** Recept kao jedna porcija u slotu (doručak, juha, salata): dodaci (juha, salata) su već za cijeli dan */
export const slotFactor = (r: Recipe) => (r.side ? 1 : 1 / BASE_SERVINGS);

/** Što troši slot (recept ili namirnica), s pripremljenim iz `pcopy` */
export function slotUse(d: AppData, s: Slot, pcopy: Record<string, number>): EffUse {
  if (s.item) return { use: { [s.item]: s.qty ?? 1 }, consumed: [], prep: [] };
  const r = s.r ? recipeOf(d, s.r) : undefined;
  return r ? effUse(r, pcopy, false, slotFactor(r)) : { use: {}, consumed: [], prep: [] };
}

/** Potreba za tjedan: neskuhani dani (s posnim sirom i prepom), nepojedeni doručci i dodatni slotovi */
export function planNeeds(d: AppData): Use {
  const need: Use = {};
  const add = (u: Use) => {
    for (const [id, a] of Object.entries(u)) need[id] = (need[id] || 0) + a;
  };
  const pcopy = { ...d.prepStock };
  d.plan.days.forEach((day) => {
    const r = day.r && !day.done ? recipeOf(d, day.r) : undefined;
    if (r) add(effUse(r, pcopy, true).use);
  });
  (d.plan.om || []).forEach((o) => {
    if (o.done) return;
    if (o.r) add(slotUse(d, { r: o.r, done: false }, pcopy).use);
    else if (o.sel) add(omEff(d, o.sel, 1, pcopy).use);
  });
  for (const k of SLOT_KEYS) for (const s of d.plan.extra?.[k] || []) if (!s.done) add(slotUse(d, s, pcopy).use);
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

export interface NeedRow {
  i: Item;
  /** treba za neskuhane dane i nepojedene omlete */
  need: number;
  have: number;
  short: number;
  packs: number;
  price: number | null;
  /** procjena za ono što fali (cijela pakiranja) */
  cost: number | null;
}

/** Sve namirnice koje traži plan za ovaj tjedan, s onim što imaš i što fali */
export function weekNeeds(d: AppData): NeedRow[] {
  const pn = planNeeds(d);
  return Object.entries(pn)
    .map(([id, need]): NeedRow | null => {
      const i = itemOf(d, id);
      if (!i) return null;
      const have = qty(d, id);
      const short = Math.max(0, need - have);
      const packs = short > 0.0001 ? Math.max(1, Math.ceil(short / i.pack - 1e-9)) : 0;
      const p = price(d, id);
      return { i, need, have, short, packs, price: p, cost: p != null ? packs * p : null };
    })
    .filter((x): x is NeedRow => x !== null);
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
  const oms = (d.plan.om || []).filter((o) => o.sel && !o.r);
  const om = oms.length ? oms.reduce((s, o) => s + costOf(d, omUse(d, o.sel!, 1)).c, 0) / oms.length : 0;
  return {
    meals: r.c + dl.c,
    perMeal: (r.c + dl.c) / 2,
    full: r.c + dl.c + om,
    known: r.known + dl.known,
    total: r.total + dl.total,
  };
}

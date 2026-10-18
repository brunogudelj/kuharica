import { DAILY_COOK, REC_USE_PREP } from "../data";
import { prepInv } from "./preps";
import type { Item, PrepRecipe, Recipe, Use } from "../data";
import { allRecipes, recipeOf } from "./recipes";
import type { AppData, Slot } from "../state/model";
import { daySlots } from "../state/model";
import { aheadKeys, windowKeys } from "./dates";
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

/** Prep sastojci recepta: [id, količina, sirovi sastojci su već u receptu]. Ugrađeni bez `prep` koriste REC_USE_PREP. */
export const prepListOf = (r: Recipe): [string, number, boolean][] =>
  r.prep
    ? [
        ...r.prep.map(([p, n]): [string, number, boolean] => [p, n, false]),
        ...(r.prepIn ?? []).map(([p, n]): [string, number, boolean] => [p, n, true]),
      ]
    : (REC_USE_PREP[r.id] ?? []).map(([p, n]): [string, number, boolean] => [p, n, true]);

/**
 * Što recept stvarno troši: sirovi sastojci × f, umanjeni za ono što pokrije pripremljeno.
 * Pripremljeno se troši iz `pcopy` (kopija stanja prepa koju funkcija mijenja).
 */
export function effUse(r: Recipe, pcopy: Record<string, number>, withDaily: boolean, f = 1, d?: AppData): EffUse {
  const use: Use = {};
  for (const [id, a] of Object.entries(r.use)) use[id] = a * f;
  if (withDaily && d?.settings.builtin !== false)
    for (const [id, a] of Object.entries(DAILY_COOK)) use[id] = (use[id] || 0) + a;
  const consumed: [string, number][] = [];
  const list = prepListOf(r)
    .filter(([p]) => prepInv(d, p))
    .map(([p, n, inUse]): [string, number, boolean] => [p, n * f, inUse]);
  const prep: EffUse["prep"] = [];
  for (const [pid, n, inUse] of list) {
    const k = Math.max(0, Math.min(n, pcopy[pid] || 0));
    prep.push({ id: pid, need: n, used: k });
    if (k > 0) {
      pcopy[pid] -= k;
      consumed.push([pid, k]);
    }
    const per = prepInv(d, pid)!.per;
    if (!inUse) {
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

/** Što troši prep za `t` tura: sirovi sastojci i drugi prep (dio); prep koji nemaš troši svoje sirove sastojke */
export function prepEff(d: AppData, p: PrepRecipe, t: number, pcopy: Record<string, number>): EffUse {
  const use: Use = {};
  for (const [id, a] of Object.entries(p.use)) use[id] = a * t;
  const consumed: [string, number][] = [];
  const prep: EffUse["prep"] = [];
  for (const [pid, n0] of p.prep ?? []) {
    const inv = prepInv(d, pid);
    if (!inv || pid === p.id) continue;
    const n = n0 * t;
    const k = Math.max(0, Math.min(n, pcopy[pid] || 0));
    prep.push({ id: pid, need: n, used: k });
    if (k > 0) {
      pcopy[pid] -= k;
      consumed.push([pid, k]);
    }
    const short = n - k;
    if (short > 0) for (const [id, a] of Object.entries(inv.per)) use[id] = (use[id] || 0) + a * short;
  }
  return { use, consumed, prep };
}

/** Recepti koji koriste prep (kao dio) */
export const prepUsedIn = (d: AppData, id: string) =>
  allRecipes(d).filter((r) => prepListOf(r).some(([p]) => p === id));

/** Za koliko porcija su upisane količine recepta: dodatak (juha, salata) za 1, ostali za 1,5 */
export const recipeBase = (r: Recipe) => (r.side ? 1 : BASE_SERVINGS);
/** Množitelj količina recepta za `s` porcija */
export const portionF = (r: Recipe, s = 1) => s / recipeBase(r);

/** Što troši obrok u planu (recept u porcijama ili namirnica), s pripremljenim iz `pcopy` */
export function slotUse(d: AppData, s: Pick<Slot, "r" | "s" | "item" | "qty">, pcopy: Record<string, number>): EffUse {
  if (s.item) return { use: { [s.item]: s.qty ?? 1 }, consumed: [], prep: [] };
  const r = s.r ? recipeOf(d, s.r) : undefined;
  return r ? effUse(r, pcopy, false, portionF(r, s.s ?? 1), d) : { use: {}, consumed: [], prep: [] };
}

/** Potreba za razdoblje popisa za kupovinu: svi nepojedeni obroci u planu */
export function planNeeds(d: AppData, now = Date.now()): Use {
  const need: Use = {};
  const pcopy = { ...d.prepStock };
  for (const k of aheadKeys(now, d.settings.shopDays || 7))
    for (const x of daySlots(d.plan, k))
      if (!x.done) for (const [id, a] of Object.entries(slotUse(d, x, pcopy).use)) need[id] = (need[id] || 0) + a;
  return need;
}

/** Prep koji traži tekući plan (od danas do kraja prozora): id → potrebne jedinice */
export function planPreps(d: AppData, now = Date.now()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of windowKeys(now).slice(1))
    for (const x of daySlots(d.plan, k))
      if (x.r && !x.done) for (const p of slotUse(d, x, {}).prep) out[p.id] = (out[p.id] || 0) + p.need;
  return out;
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

/** Što fali za `porc` porcija recepta */
export function missingFor(d: AppData, rid: string, porc = 1): string[] {
  const r = recipeOf(d, rid);
  if (!r) return [];
  return Object.entries(effUse(r, { ...d.prepStock }, false, portionF(r, porc), d).use)
    .filter(([id, a]) => qty(d, id) + 1e-9 < a)
    .map(([id]) => itemName(d, id));
}

export const prepUsed = (d: AppData, rid: string, f = 1) => {
  const r = recipeOf(d, rid);
  return r ? effUse(r, { ...d.prepStock }, false, f, d).consumed : [];
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

/** Trošak recepta po porciji */
export function portionCost(d: AppData, rid: string) {
  const r = recipeOf(d, rid);
  const c = costOf(d, r?.use ?? {});
  const f = r ? portionF(r) : 1;
  return { c: c.c * f, known: c.known, total: c.total };
}

/** Trošak dana u planu: zbroj obroka */
export function dayCost(d: AppData, k: string) {
  let c = 0;
  let known = 0;
  let total = 0;
  for (const x of daySlots(d.plan, k)) {
    const u = slotUse(d, x, {}).use;
    const r = costOf(d, u);
    c += r.c;
    known += r.known;
    total += r.total;
  }
  return { c, known, total };
}

/* Prep recepti za korisnika: ugrađeni + vlastiti (npr. umak spremljen iz recepta s weba) */
import { PREP, PREP_INV } from "../data";
import type { CustomPrep, PrepInv, PrepRecipe } from "../data";
import type { AppData } from "../state/model";
import { clone } from "../state/model";
import { itemOf } from "./items";
import { plural, round } from "./format";

export const isCustomPrep = (id: string) => id.startsWith("pp-");

const num = (a: number) => String(round(a)).replace(".", ",");

export function toPrep(d: AppData | undefined, c: CustomPrep): PrepRecipe {
  const ing = Object.entries(c.use).map(([id, a]) => {
    const it = d ? itemOf(d, id) : undefined;
    return it
      ? `<span class=g>${num(a)} ${it.u}</span> ${it.n}`
      : `<span class=g>${num(a)}</span> (obrisana namirnica)`;
  });
  return {
    id: c.id,
    n: c.n,
    k: c.k,
    time: c.time || "",
    yieldTxt: `${num(c.make)} ${plural(c.make, c.unit)}`,
    keep: c.keep || "",
    use: c.use,
    ing: [...ing, ...c.extra],
    st: c.st,
    tip: "",
    for: [],
  };
}

const cache = new WeakMap<CustomPrep[], { items: unknown; builtin: boolean; all: PrepRecipe[] }>();

/** Svi prep recepti: ugrađeni (ako nisu isključeni u Postavkama) + vlastiti */
export function allPreps(d?: AppData): PrepRecipe[] {
  const builtin = d?.settings.builtin !== false;
  const base = builtin ? PREP : [];
  if (!d?.preps?.length) return base;
  let c = cache.get(d.preps);
  if (!c || c.items !== d.items || c.builtin !== builtin) {
    c = { items: d.items, builtin, all: [...base, ...d.preps.map((x) => toPrep(d, x))] };
    cache.set(d.preps, c);
  }
  return c.all;
}

export function prepOf(d: AppData | undefined, id: string): PrepRecipe | undefined {
  return allPreps(d).find((p) => p.id === id);
}

/** Inventar prepa: koliko jedinica daje tura i koje sirove sastojke zamjenjuje jedna jedinica */
export function prepInv(d: AppData | undefined, id: string): PrepInv | undefined {
  if (PREP_INV[id]) return PREP_INV[id];
  const c = d?.preps?.find((x) => x.id === id);
  if (!c) return undefined;
  const make = c.make > 0 ? c.make : 1;
  return { make, unit: c.unit, per: Object.fromEntries(Object.entries(c.use).map(([k, a]) => [k, a / make])) };
}

export const prepName = (d: AppData | undefined, id: string) => prepOf(d, id)?.n ?? "Obrisani prep";

export function newPrepId(n: string) {
  const slug = n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `pp-${slug || "prep"}-${Math.random().toString(36).slice(2, 6)}`;
}

export function saveCustomPrep(src: AppData, p: CustomPrep): { data: AppData; msg: string } {
  const d = clone(src);
  const i = d.preps.findIndex((x) => x.id === p.id);
  if (i >= 0) d.preps[i] = p;
  else d.preps.push(p);
  return { data: d, msg: i >= 0 ? `${p.n} je spremljen.` : `${p.n} je dodan u prep.` };
}

/** Obriši vlastiti prep i njegovo pripremljeno; vlastiti recepti koji ga koriste prelaze na sirove sastojke */
export function removeCustomPrep(src: AppData, id: string): { data: AppData; msg: string } {
  const d = clone(src);
  const p = d.preps.find((x) => x.id === id);
  if (!p) return { data: src, msg: "" };
  d.preps = d.preps.filter((x) => x.id !== id);
  delete d.prepStock[id];
  d.recipes = d.recipes.map((r) => {
    const k = r.prep?.[id];
    if (!k) return r;
    const use = { ...r.use };
    for (const [iid, a] of Object.entries(p.use)) use[iid] = round((use[iid] || 0) + (a / (p.make || 1)) * k);
    const prep = { ...r.prep };
    delete prep[id];
    return { ...r, use, prep };
  });
  return { data: d, msg: `${p.n} je obrisan. Recepti koji su ga koristili sada imaju njegove sastojke.` };
}

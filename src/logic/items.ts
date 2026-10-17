/* Katalog namirnica za korisnika: ugrađene (s njegovim promjenama) + vlastite */
import { ITEMS } from "../data";
import type { CatId, Item, ShopId, Unit } from "../data";
import type { AppData, ItemsState } from "../state/model";

const cache = new WeakMap<ItemsState, { all: Item[]; map: Map<string, Item> }>();

function build(s: ItemsState) {
  let c = cache.get(s);
  if (!c) {
    const all = ITEMS.map((i) => {
      const o = s.over[i.id];
      return o ? { ...i, min: o.min ?? i.min, pack: o.pack ?? i.pack } : i;
    }).concat(s.custom);
    c = { all, map: new Map(all.map((i) => [i.id, i])) };
    cache.set(s, c);
  }
  return c;
}

/** Sve namirnice, i skrivene */
export const allItems = (d: AppData) => build(d.items).all;
/** Namirnice koje korisnik koristi (bez skrivenih) */
export const visibleItems = (d: AppData) => build(d.items).all.filter((i) => !d.items.hidden.includes(i.id));
export const hiddenItems = (d: AppData) => build(d.items).all.filter((i) => d.items.hidden.includes(i.id));
export const itemOf = (d: AppData, id: string) => build(d.items).map.get(id);
export const itemName = (d: AppData, id: string) => itemOf(d, id)?.n ?? id;
export const isCustom = (id: string) => id.startsWith("c-");

/** Korak za + i −: komadi po 1, inače desetina pakiranja zaokružena na lijep broj */
export function defaultStep(u: Unit, pack: number): number {
  if (u === "kom") return 1;
  const raw = Math.max(1, pack / 10);
  const nice = [1, 5, 10, 20, 25, 50, 100, 250, 500];
  return nice.reduce((best, n) => (Math.abs(n - raw) < Math.abs(best - raw) ? n : best), 1);
}

export function newCustomItem(f: {
  n: string;
  cat: CatId;
  src: ShopId;
  u: Unit;
  pack: number;
  min: number;
  hint?: string;
}): Item {
  const slug = f.n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return {
    id: `c-${slug || "namirnica"}-${Math.random().toString(36).slice(2, 6)}`,
    n: f.n.trim(),
    cat: f.cat,
    src: f.src,
    u: f.u,
    pack: f.pack,
    min: f.min,
    step: defaultStep(f.u, f.pack),
    hint: f.hint?.trim() || "vlastita namirnica",
  };
}

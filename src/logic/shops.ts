/* Popis dućana: dodavanje, izmjena, brisanje */
import { SHOPS } from "../data";
import type { Shop } from "../data";
import type { AppData } from "../state/model";
import { clone } from "../state/model";
import { allItems, isCustom } from "./items";
import { newId } from "./format";
import type { Result } from "./actions";

export const shopOf = (d: AppData, id: string): Shop | undefined => d.shops.find((s) => s.id === id);
export const shopName = (d: AppData, id: string) => shopOf(d, id)?.n ?? SHOPS[id] ?? "Ostalo";
export const shopOpts = (d: AppData): [string, string][] => d.shops.map((s) => [s.id, s.n]);

/** Redoslijed dućana s popisa (za grupiranje) */
export const shopIndex = (d: AppData, id: string) => {
  const i = d.shops.findIndex((s) => s.id === id);
  return i < 0 ? 999 : i;
};

export function addShop(src: AppData, f: Omit<Shop, "id">): Result & { id: string } {
  const d = clone(src);
  const id = "s-" + newId();
  const o = d.shops.findIndex((s) => s.id === "O");
  const shop: Shop = { id, ...f, n: f.n.trim() };
  // "Ostalo" ostaje zadnje
  if (o >= 0) d.shops.splice(o, 0, shop);
  else d.shops.push(shop);
  return { data: d, id, msg: `${shop.n} je dodan u dućane.` };
}

export function editShop(src: AppData, id: string, patch: Partial<Omit<Shop, "id">>): AppData {
  const d = clone(src);
  d.shops = d.shops.map((s) => (s.id === id ? { ...s, ...patch } : s));
  return d;
}

/** Obriši dućan; njegove namirnice i troškovi prelaze na "Ostalo" */
export function removeShop(src: AppData, id: string): Result {
  if (id === "O") return { data: src, msg: "Ostalo se ne može obrisati." };
  const d = clone(src);
  const n = shopName(src, id);
  d.shops = d.shops.filter((s) => s.id !== id);
  let moved = 0;
  for (const i of allItems(src)) {
    if (i.src !== id) continue;
    moved++;
    if (isCustom(i.id)) d.items.custom = d.items.custom.map((x) => (x.id === i.id ? { ...x, src: "O" } : x));
    else d.items.over[i.id] = { ...(d.items.over[i.id] || {}), src: "O" };
  }
  for (const mk of Object.keys(d.costs))
    d.costs[mk] = d.costs[mk].map((e) => (e.shop === id ? { ...e, shop: "O", note: `${e.note} (${n})` } : e));
  return { data: d, msg: `${n} je obrisan${moved ? `, ${moved} namirnica prešlo je na Ostalo` : ""}.` };
}

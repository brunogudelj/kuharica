/* Popisi koje korisnik uređuje u Postavkama: mjesta spremanja, skupine namirnica i jedinice */
import { CATS, GROUPS } from "../data";
import type { AppData } from "../state/model";
import { clone } from "../state/model";
import { allItems, isCustom } from "./items";
import { allRecipes } from "./recipes";

export type ListKind = "cats" | "grps" | "units" | "kinds";
export type { Entry, Lists } from "../state/model";
export { BUILTIN_UNITS, defaultLists } from "../state/model";
import { BUILTIN_UNITS, defaultLists } from "../state/model";
import type { Entry } from "../state/model";

/** g i ml se mjere na 100 (kcal na 100 g), sve ostale jedinice su komadi (kcal po komadu, kocki…) */
export const isMass = (u: string) => u === "g" || u === "ml";

export const LIST_LABEL: Record<ListKind, { one: string; many: string; fallback: string }> = {
  cats: { one: "mjesto spremanja", many: "Mjesta spremanja", fallback: "dry" },
  grps: { one: "skupina", many: "Skupine namirnica", fallback: "ostalo" },
  units: { one: "jedinica", many: "Jedinice", fallback: "kom" },
  kinds: { one: "vrsta jela", many: "Vrste jela", fallback: "" },
};

export const isBuiltin = (kind: ListKind, id: string) =>
  kind === "kinds"
    ? false
    : kind === "cats"
      ? id in CATS
      : kind === "grps"
        ? id in GROUPS
        : BUILTIN_UNITS.some((u) => u.id === id);

const listOf = (d: AppData, kind: ListKind): Entry[] => d.lists?.[kind] ?? defaultLists()[kind];

export const catOpts = (d: AppData): [string, string][] => listOf(d, "cats").map((e) => [e.id, e.n]);
export const grpOpts = (d: AppData): [string, string][] => listOf(d, "grps").map((e) => [e.id, e.n]);
export const unitOpts = (d: AppData): [string, string][] => listOf(d, "units").map((e) => [e.id, e.n]);
export const kindOpts = (d: AppData): [string, string][] => listOf(d, "kinds").map((e) => [e.id, e.n]);
export const kindName = (d: AppData, id: string) => listOf(d, "kinds").find((e) => e.id === id)?.n;
export const catName = (d: AppData, id: string) => listOf(d, "cats").find((e) => e.id === id)?.n ?? CATS[id] ?? id;
export const grpName = (d: AppData, id: string | undefined) =>
  listOf(d, "grps").find((e) => e.id === (id ?? "ostalo"))?.n ?? GROUPS[id ?? "ostalo"] ?? id ?? "Ostalo";

/** Koliko namirnica koristi stavku popisa */
export function usage(d: AppData, kind: ListKind, id: string): number {
  if (kind === "kinds") return allRecipes(d).filter((r) => r.kinds?.includes(id)).length;
  return allItems(d).filter((i) => (kind === "cats" ? i.cat : kind === "grps" ? (i.grp ?? "ostalo") : i.u) === id)
    .length;
}

const slug = (n: string) =>
  n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);

export function addEntry(
  src: AppData,
  kind: ListKind,
  name: string,
): { data: AppData; msg: string; id: string | null } {
  const n = name.trim();
  if (!n) return { data: src, msg: "Upiši naziv.", id: null };
  const list = listOf(src, kind);
  if (list.some((e) => e.n.toLowerCase() === n.toLowerCase() || e.id === n))
    return { data: src, msg: `„${n}” već postoji.`, id: null };
  // jedinica je ujedno i oznaka uz broj (npr. "2 kocka"), pa je id sam naziv
  const id =
    kind === "units"
      ? n
      : `${kind === "cats" ? "k" : kind === "kinds" ? "v" : "s"}-${slug(n) || "x"}-${Math.random().toString(36).slice(2, 5)}`;
  const d = clone(src);
  d.lists[kind] = [...list, { id, n }];
  return { data: d, msg: `Dodano: ${n}.`, id };
}

export function renameEntry(src: AppData, kind: ListKind, id: string, name: string): AppData {
  const n = name.trim();
  if (!n) return src;
  const d = clone(src);
  d.lists[kind] = listOf(src, kind).map((e) => (e.id === id ? { ...e, n } : e));
  return d;
}

/** Obriši stavku: namirnice prelaze na zadanu (Smočnica, Ostalo). Jedinica u upotrebi se ne briše. */
export function removeEntry(src: AppData, kind: ListKind, id: string): { data: AppData; msg: string } {
  if (isBuiltin(kind, id)) return { data: src, msg: "Ugrađena stavka se ne može obrisati, ali je možeš preimenovati." };
  const used = usage(src, kind, id);
  if (kind === "units" && used)
    return { data: src, msg: `Jedinicu koristi ${used} namirnica. Promijeni im jedinicu pa je obriši.` };
  const d = clone(src);
  const name = listOf(src, kind).find((e) => e.id === id)?.n ?? id;
  d.lists[kind] = listOf(src, kind).filter((e) => e.id !== id);
  if (kind === "kinds") {
    d.recipes = d.recipes.map((r) => (r.kinds?.includes(id) ? { ...r, kinds: r.kinds.filter((k) => k !== id) } : r));
    return { data: d, msg: `${name} je obrisan${used ? ` i maknut s ${used} recepata` : ""}.` };
  }
  if (used) {
    const to = LIST_LABEL[kind].fallback;
    const key = kind === "cats" ? "cat" : "grp";
    for (const i of allItems(src)) {
      if ((key === "cat" ? i.cat : i.grp) !== id) continue;
      if (isCustom(i.id)) d.items.custom = d.items.custom.map((x) => (x.id === i.id ? { ...x, [key]: to } : x));
      else d.items.over[i.id] = { ...(d.items.over[i.id] || {}), [key]: to };
    }
  }
  return {
    data: d,
    msg: `${name} je obrisan${used ? `, ${used} namirnica prešlo je na ${kind === "cats" ? catName(d, "dry") : grpName(d, "ostalo")}` : ""}.`,
  };
}

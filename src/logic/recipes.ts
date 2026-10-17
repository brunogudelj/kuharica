/* Recepti za korisnika: ugrađeni + vlastiti */
import { RECIPES } from "../data";
import type { CustomRecipe, Recipe } from "../data";
import type { AppData } from "../state/model";
import { itemOf } from "./items";

/** Broj za tekst sastojka (decimalni zarez, bez razmaka tisućica, da ga scaleText može skalirati) */
const num = (a: number) => String(Math.round(a * 100) / 100).replace(".", ",");

export function toRecipe(d: AppData, r: CustomRecipe): Recipe {
  const ing = Object.entries(r.use).map(([id, a]) => {
    const it = itemOf(d, id);
    if (!it) return `<span class=g>${num(a)}</span> (obrisana namirnica)`;
    return `<span class=g>${num(a)} ${it.u === "kom" ? "kom" : it.u}</span> ${it.n}`;
  });
  return { id: r.id, n: r.n, c: r.c, d: r.d, use: r.use, ing: [...ing, ...r.extra], st: r.st, custom: true };
}

const cache = new WeakMap<CustomRecipe[], { items: unknown; all: Recipe[]; map: Map<string, Recipe> }>();

export function allRecipes(d: AppData): Recipe[] {
  let c = cache.get(d.recipes);
  if (!c || c.items !== d.items) {
    const all = RECIPES.concat(d.recipes.map((r) => toRecipe(d, r)));
    c = { items: d.items, all, map: new Map(all.map((r) => [r.id, r])) };
    cache.set(d.recipes, c);
  }
  return c.all;
}

export function recipeOf(d: AppData, id: string): Recipe | undefined {
  allRecipes(d);
  return cache.get(d.recipes)!.map.get(id);
}

export const recipeName = (d: AppData, id: string) => recipeOf(d, id)?.n ?? "Obrisani recept";

export function newRecipeId(n: string) {
  const slug = n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `r-${slug || "recept"}-${Math.random().toString(36).slice(2, 6)}`;
}

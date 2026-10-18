import { describe, expect, it } from "vitest";
import { RBY } from "../data";
import { defaultData } from "../state/model";
import { allRecipes, recipeOf, toCustom } from "./recipes";
import { effUse } from "./inventory";
import { cook, removeRecipe, saveRecipe } from "./actions";
import { removeEntry } from "./lists";
import { mealEntry } from "./feed";

const sum = (u: Record<string, number>) => Object.values(u).reduce((a, b) => a + b, 0);

describe("složeni recepti", () => {
  it("dijelovi se zbrajaju u namirnice i prep, a kuhanje skida sve", () => {
    let d = defaultData();
    d = saveRecipe(d, {
      id: "r-tuna-krumpir",
      n: "Tuna steak s krumpirom",
      c: "Krumpir",
      d: "Tava · 25 min",
      use: { limun: 0.5 },
      extra: [],
      st: [],
      parts: { losos: 1, "dod-miso": 1 },
      kinds: ["pecenje"],
    }).data;
    const r = recipeOf(d, "r-tuna-krumpir")!;
    expect(r.parts).toEqual([
      ["losos", 1],
      ["dod-miso", 1],
    ]);
    // svi sirovi sastojci lososa i juhe su u složenom receptu (prep izvučen zasebno)
    const empty = effUse(r, {}, false, 1, d).use;
    for (const id of Object.keys(RBY["dod-miso"].use)) expect(empty[id]).toBeGreaterThan(0);
    expect(empty.losos ?? empty[Object.keys(RBY.losos.use)[0]]).toBeGreaterThan(0);
    expect(empty.limun).toBeGreaterThanOrEqual(0.5);
    // ništa se ne broji dvaput: bez prepa troši isto koliko i dijelovi zasebno
    const parts =
      sum(effUse(recipeOf(d, "losos")!, {}, false, 1, d).use) +
      sum(effUse(recipeOf(d, "dod-miso")!, {}, false, 1.5, d).use);
    expect(sum(empty)).toBeCloseTo(parts + 0.5, 1);
    expect(mealEntry(d, r.id)!.parts).toBe(2);
    const c = cook(d, r.id, null, 1, Date.now());
    expect(c.data.hist[0].r).toBe(r.id);
  });

  it("petlja se ignorira, a brisanje dijela ga miče iz složenog", () => {
    let d = defaultData();
    d = saveRecipe(d, { id: "r-a", n: "A", c: "Ostalo", d: "", use: {}, extra: [], st: [], parts: { "r-b": 1 } }).data;
    d = saveRecipe(d, {
      id: "r-b",
      n: "B",
      c: "Ostalo",
      d: "",
      use: { jaja: 2 },
      extra: [],
      st: [],
      parts: { "r-a": 1 },
    }).data;
    expect(recipeOf(d, "r-a")!.use.jaja).toBe(2);
    d = removeRecipe(d, "r-b").data;
    expect(d.recipes.find((x) => x.id === "r-a")!.parts).toEqual({});
  });
});

describe("uređivanje ugrađenog recepta i vrste jela", () => {
  it("uređeni ugrađeni recept zamjenjuje original, vraćanje briše izmjenu", () => {
    let d = defaultData();
    const n = allRecipes(d).length;
    const c = toCustom(d, recipeOf(d, "teriyaki")!);
    expect(c.prepIn?.["teriyaki-umak"]).toBe(1);
    d = saveRecipe(d, { ...c, use: { ...c.use, piletina: 999 } }).data;
    expect(allRecipes(d).length).toBe(n);
    const r = recipeOf(d, "teriyaki")!;
    expect(r.edited).toBe(true);
    expect(r.use.piletina).toBe(999);
    expect(mealEntry(d, "teriyaki")!.custom).toBe(false);
    d = removeRecipe(d, "teriyaki").data;
    expect(recipeOf(d, "teriyaki")!.edited).toBeUndefined();
  });

  it("uređeni ugrađeni bez promjena troši isto kao original", () => {
    let d = defaultData();
    const orig = sum(effUse(recipeOf(d, "teriyaki")!, {}, false, 1, d).use);
    d = saveRecipe(d, toCustom(d, recipeOf(d, "teriyaki")!)).data;
    expect(sum(effUse(recipeOf(d, "teriyaki")!, {}, false, 1, d).use)).toBeCloseTo(orig, 1);
  });

  it("brisanje vrste jela miče je s recepata", () => {
    let d = defaultData();
    d = saveRecipe(d, {
      id: "r-x",
      n: "X",
      c: "Ostalo",
      d: "",
      use: { jaja: 1 },
      extra: [],
      st: [],
      kinds: ["burek"],
    }).data;
    d = removeEntry(d, "kinds", "burek").data;
    expect(d.recipes[0].kinds).toEqual([]);
    expect(d.lists.kinds.some((k) => k.id === "burek")).toBe(false);
  });
});

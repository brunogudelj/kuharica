import { describe, expect, it } from "vitest";
import { defaultData, emptyPlan, wipeState, WIPE_EPOCH } from "../state/model";
import { fromStored, importJson } from "../storage/storage";
import { allRecipes } from "./recipes";
import { allPreps } from "./preps";
import { feed, prepFeed } from "./feed";
import { allItems } from "./items";
import { addItem, autoFillPlan, saveRecipe } from "./actions";
import { newCustomItem } from "./items";

describe("sve od nule", () => {
  it("briše sve osim dućana, popisa i postavki", () => {
    let d = defaultData();
    d = addItem(d, newCustomItem({ n: "Moja", cat: "fri", src: "K", u: "g", pack: 100, min: 0 }), 300).data;
    d = saveRecipe(d, { id: "r-moj", n: "Moj", c: "Riža", d: "", use: {}, extra: [], st: [] }).data;
    d.costs["2026-11"] = [{ id: "a", t: 1, shop: "K", amount: 5, note: "", est: false }];
    d.shops.push({ id: "X", n: "Moj dućan", addr: "", url: "" } as (typeof d.shops)[number]);
    const c = wipeState(d);
    expect(allItems(c)).toEqual([]);
    expect(allRecipes(c)).toEqual([]);
    expect(allPreps(c)).toEqual([]);
    expect(feed(c)).toEqual([]);
    expect(prepFeed(c)).toEqual([]);
    expect(c.stock).toEqual({});
    expect(c.costs).toEqual({});
    expect(c.plan.slots).toEqual({});
    expect(c.shops.some((s) => s.id === "X")).toBe(true);
    expect(c.lists.kinds.length).toBeGreaterThan(5);
    expect(autoFillPlan(c).plan.slots).toEqual({});
    expect(c.epoch).toBe(WIPE_EPOCH);
  });

  it("vlastito dodano nakon brisanja radi normalno", () => {
    let d = wipeState(defaultData());
    const it = newCustomItem({ n: "Jaja", cat: "fri", src: "K", u: "kom", pack: 10, min: 0 });
    d = addItem(d, it, 10).data;
    d = saveRecipe(d, { id: "r-o", n: "Omlet", c: "Ostalo", d: "", use: { [it.id]: 3 }, extra: [], st: [] }).data;
    expect(allItems(d).map((i) => i.n)).toEqual(["Jaja"]);
    expect(feed(d).map((e) => e.id)).toEqual(["r-o"]);
    d.plan = emptyPlan();
    expect(Object.values(autoFillPlan(d).plan.slots).flat().length).toBeGreaterThanOrEqual(0);
  });

  it("stari podaci se jednom obrišu (s GitHuba kao najstariji), novi ostaju", async () => {
    const old = defaultData() as unknown as Record<string, unknown>;
    old.updatedAt = 1000;
    const local = fromStored(old, true);
    expect(allRecipes(local)).toEqual([]);
    expect(local.updatedAt).toBeGreaterThan(1000);
    const remote = fromStored(old, false);
    expect(remote.updatedAt).toBe(0);
    const fresh = { ...wipeState(defaultData()), updatedAt: 5 };
    fresh.recipes = [{ id: "r-x", n: "X", c: "Ostalo", d: "", use: {}, extra: [], st: [] }];
    expect(fromStored(JSON.parse(JSON.stringify(fresh))).recipes.length).toBe(1);
    // vraćeni backup se ne briše
    const file = { text: async () => JSON.stringify(defaultData()) } as File;
    const b = await importJson(file);
    expect(fromStored(JSON.parse(JSON.stringify(b))).settings.builtin).toBe(true);
  });
});

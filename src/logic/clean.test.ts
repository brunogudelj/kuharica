import { describe, expect, it } from "vitest";
import { ITEMS } from "../data";
import { cleanState, defaultData, emptyPlan } from "../state/model";
import { fromStored, migrate } from "../storage/storage";
import { allRecipes } from "./recipes";
import { allPreps } from "./preps";
import { feed } from "./feed";
import { visibleItems } from "./items";
import { autoFillPlan } from "./actions";

describe("kreni od nule", () => {
  it("skriva namirnice i prazni zalihu, a recepti i plan ostaju", () => {
    const d = defaultData();
    d.stock[ITEMS[0].id] = { qty: 100, price: 2 };
    d.recipes.push({ id: "r-moj", n: "Moj", c: "Riža", d: "", use: {}, extra: [], st: [] });
    const c = cleanState(d);
    expect(visibleItems(c)).toEqual([]);
    expect(c.stock).toEqual({});
    expect(c.plan).toEqual(d.plan);
    expect(allRecipes(c).length).toBe(allRecipes(d).length);
  });

  it("isključeni ugrađeni recepti: ostaje samo vlastito", () => {
    const d = defaultData();
    d.recipes.push({ id: "r-moj", n: "Moj", c: "Riža", d: "", use: {}, extra: [], st: [] });
    d.settings.builtin = false;
    d.plan = emptyPlan();
    expect(allRecipes(d).map((r) => r.id)).toEqual(["r-moj"]);
    expect(allPreps(d)).toEqual([]);
    expect(feed(d).map((e) => e.id)).toEqual(["r-moj"]);
    const f = autoFillPlan(d);
    // bez ugrađenih recepata: nema omleta ni juhe, samo vlastiti recept
    expect(
      Object.values(f.plan.slots)
        .flat()
        .every((x) => x.r === "r-moj"),
    ).toBe(true);
  });

  it("stari podaci se jednom očiste, novi ostaju kakvi jesu", () => {
    const old = defaultData() as unknown as { settings: Record<string, unknown> };
    delete old.settings.builtin;
    const c = fromStored(old);
    expect(c.settings.builtin).toBe(true);
    expect(visibleItems(c)).toEqual([]);
    expect(migrate(old).settings.builtin).toBe(true);
    const fresh = defaultData();
    expect(visibleItems(fromStored(fresh)).length).toBeGreaterThan(0);
  });
});

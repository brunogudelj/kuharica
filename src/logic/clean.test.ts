import { describe, expect, it } from "vitest";
import { ITEMS } from "../data";
import { cleanState, defaultData } from "../state/model";
import { fromStored, migrate } from "../storage/storage";
import { allRecipes } from "./recipes";
import { allPreps } from "./preps";
import { feed } from "./feed";
import { visibleItems } from "./items";
import { autoFillPlan } from "./actions";

describe("kreni od nule", () => {
  it("skriva sve ugrađeno, prazni zalihu i plan, a vlastito ostaje", () => {
    const d = defaultData();
    d.stock[ITEMS[0].id] = { qty: 100, price: 2 };
    d.recipes.push({ id: "r-moj", n: "Moj", c: "Riža", d: "", use: {}, extra: [], st: [] });
    const c = cleanState(d);
    expect(visibleItems(c)).toEqual([]);
    expect(c.stock).toEqual({});
    expect(Object.keys(c.plan.om)).toEqual([]);
    expect(allRecipes(c).map((r) => r.id)).toEqual(["r-moj"]);
    expect(allPreps(c)).toEqual([]);
    expect(feed(c).map((e) => e.id)).toEqual(["r-moj"]);
    const f = autoFillPlan(c);
    expect(Object.keys(f.plan.om)).toEqual([]);
    expect(Object.keys(f.plan.extra.juha)).toEqual([]);
  });

  it("stari podaci se jednom očiste, novi ostaju kakvi jesu", () => {
    const old = defaultData() as unknown as { settings: Record<string, unknown> };
    delete old.settings.builtin;
    expect(fromStored(old).settings.builtin).toBe(false);
    expect(migrate(old).settings.builtin).toBe(true);
    const fresh = defaultData();
    expect(fromStored(fresh).settings.builtin).toBe(true);
  });
});

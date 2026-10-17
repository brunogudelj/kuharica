import { describe, expect, it } from "vitest";
import { PREP_INV } from "../data";
import { defaultData } from "../state/model";
import { saveRecipe } from "./actions";
import { effUse } from "./inventory";
import { recipeOf } from "./recipes";

describe("prep kao sastojak recepta", () => {
  it("ugrađeni recept pokazuje prep i s njim troši manje sirovog", () => {
    const d = defaultData();
    const r = recipeOf(d, "teriyaki")!;
    const bez = effUse(r, {}, false);
    expect(bez.prep.find((p) => p.id === "teriyaki-umak")).toEqual({ id: "teriyaki-umak", need: 1, used: 0 });
    const s = effUse(r, { "teriyaki-umak": 3 }, false);
    expect(s.prep.find((p) => p.id === "teriyaki-umak")!.used).toBe(1);
    expect((s.use.soja ?? 0) < (bez.use.soja ?? 0)).toBe(true);
  });

  it("vlastiti recept s prepom: bez prepa troši njegove sirove sastojke", () => {
    let d = defaultData();
    d = saveRecipe(d, {
      id: "r-t-1",
      n: "Moj teriyaki",
      c: "Riža",
      d: "",
      use: { piletina: 250 },
      prep: { "teriyaki-umak": 1 },
      extra: [],
      st: [],
    }).data;
    const r = recipeOf(d, "r-t-1")!;
    expect(r.ing[0]).toContain("Teriyaki umak");
    const bez = effUse(r, {}, false);
    for (const [id, a] of Object.entries(PREP_INV["teriyaki-umak"].per)) expect(bez.use[id]).toBeCloseTo(a, 5);
    const s = effUse(r, { "teriyaki-umak": 2 }, false);
    expect(Object.keys(s.use)).toEqual(["piletina"]);
    expect(s.consumed).toEqual([["teriyaki-umak", 1]]);
  });
});

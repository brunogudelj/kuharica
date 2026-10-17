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

describe("vlastiti prep", () => {
  it("napravi, koristi u receptu, obriši", async () => {
    const { saveCustomPrep, removeCustomPrep, prepInv } = await import("./preps");
    const { makePrep } = await import("./actions");
    let d = defaultData();
    d = saveCustomPrep(d, {
      id: "pp-umak-x1",
      n: "Kikiriki umak",
      k: "Umaci",
      time: "5 min",
      keep: "Hladnjak 1 tjedan",
      make: 2,
      unit: "porcija",
      use: { kikiriki: 40, soja: 20 },
      extra: [],
      st: [],
    }).data;
    expect(prepInv(d, "pp-umak-x1")!.per).toEqual({ kikiriki: 20, soja: 10 });
    d = saveRecipe(d, {
      id: "r-k-1",
      n: "Satay",
      c: "Riža",
      d: "",
      use: { piletina: 250 },
      prep: { "pp-umak-x1": 1 },
      extra: [],
      st: [],
    }).data;
    const r = recipeOf(d, "r-k-1")!;
    // bez prepa: sirovi sastojci za 1 porciju umaka
    expect(effUse(r, {}, false, 1, d).use).toEqual({ piletina: 250, kikiriki: 20, soja: 10 });
    d.stock.kikiriki = { qty: 100, price: null };
    d.stock.soja = { qty: 100, price: null };
    d = makePrep(d, "pp-umak-x1", 1).data;
    expect(d.prepStock["pp-umak-x1"]).toBe(2);
    expect(effUse(r, { ...d.prepStock }, false, 1, d).use).toEqual({ piletina: 250 });
    const g = removeCustomPrep(d, "pp-umak-x1").data;
    expect(g.preps).toHaveLength(0);
    expect(g.recipes[0].use).toEqual({ piletina: 250, kikiriki: 20, soja: 10 });
  });

  it("uvoz: skupina sastojaka i postojeći prep se prepoznaju", async () => {
    const { parseRecipeText, parseIngredient } = await import("./importRecipe");
    const d = defaultData();
    const p = parseRecipeText(
      "Piletina\n2 porcije\n400 g pilećih prsa\nZa umak:\n2 žlice soja umaka\n1 žličica meda\nPriprema:\nSve zapeci u woku i prelij umakom na kraju.",
    );
    expect(p.ingredients).toHaveLength(3);
    expect(p.groups).toEqual([undefined, "Umak", "Umak"]);
    const l = parseIngredient(d, "1 porcija teriyaki umaka");
    expect(l.prep).toBe("teriyaki-umak");
    expect(l.amount).toBe(1);
  });
});

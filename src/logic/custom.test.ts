import { todayKey } from "./dates";
import { describe, expect, it } from "vitest";
import { daySlots, defaultData } from "../state/model";
import type { AppData } from "../state/model";
import { migrate } from "../storage/storage";
import { addItem, addSlot, autoFillPlan, cook, removeRecipe, saveRecipe, toggleSlot } from "./actions";
import { newCustomItem } from "./items";
import { allRecipes, recipeOf } from "./recipes";
import { qty, planNeeds, shopping } from "./inventory";
import { omMacros, omName, omProt, omSteps, surpriseSel } from "./omlet";

function withKobasice(): { d: AppData; id: string } {
  const i = newCustomItem({ n: "Pileće kobasice", cat: "fri", src: "K", u: "g", pack: 400, min: 0 });
  i.om = { role: "prot", amt: 50, pre: "Kobasice nareži i zapeci 3 min." };
  i.kcal = 180;
  i.prot = 14;
  const d = addItem(defaultData(), i, 400).data;
  d.stock.basmati = { qty: 1000, price: null };
  d.stock.jaja = { qty: 30, price: null };
  d.stock.bjelanjci = { qty: 1000, price: null };
  return { d, id: i.id };
}

describe("vlastita namirnica u omletu", () => {
  it("pojavi se kao protein i ulazi u makro, naziv i korake", () => {
    const { d, id } = withKobasice();
    expect(omProt(d)).toContain(id);
    const sel = { base: "protein", fill: [id], carb: "nista" };
    const m = omMacros(d, sel, 1);
    const bez = omMacros(d, { ...sel, fill: [] }, 1);
    expect(m.k - bez.k).toBe(90); // 50 g × 180 kcal/100 g
    expect(m.p - bez.p).toBe(7);
    expect(omName(d, sel)).toBe("Pileće kobasice");
    expect(omSteps(d, sel, "wok").join(" ")).toContain("zapeci 3 min");
  });
  it("pojeo sam skida vlastitu namirnicu, a kupovina je računa", () => {
    const { d: d0, id } = withKobasice();
    const d = addSlot(d0, todayKey(), { item: id, qty: 50 });
    expect(planNeeds(d)[id]).toBe(50);
    const sid = daySlots(d.plan, todayKey()).at(-1)!.id;
    const r = toggleSlot(d, todayKey(), sid).data;
    expect(qty(r, id)).toBe(350);
  });
  it("iznenadi me može odabrati vlastiti nadjev", () => {
    const { d, id } = withKobasice();
    const picks = new Set<string>();
    for (let s = 1; s < 200; s++) {
      let x = s;
      const rng = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
      surpriseSel(d, rng).fill.forEach((f) => picks.add(f));
    }
    expect(picks.has(id)).toBe(true);
  });
});

describe("vlastiti recept", () => {
  it("spremi, prikaži, skuhaj i obriši", () => {
    const { d: d0, id } = withKobasice();
    const rec = {
      id: "r-test-abcd",
      n: "Kobasice s rižom",
      c: "Riža" as const,
      d: "Wok · 20 min",
      use: { [id]: 150, basmati: 105 },
      extra: ["sol"],
      st: ["Skuhaj rižu."],
    };
    let d = saveRecipe(d0, rec).data;
    const r = recipeOf(d, rec.id)!;
    expect(r.custom).toBe(true);
    expect(r.ing[0]).toContain("Pileće kobasice");
    expect(r.ing).toContain("sol");
    d = addSlot(d, todayKey(), { r: rec.id, s: 1.5 });
    expect(planNeeds(d)[id]).toBe(150);
    d = cook(d, rec.id, todayKey(), 1.5).data;
    expect(qty(d, id)).toBe(250);
    expect(qty(d, "basmati")).toBe(895);
    d = removeRecipe(d, rec.id).data;
    expect(allRecipes(d).some((x) => x.id === rec.id)).toBe(false);
  });
  it("ulazi u Popuni tjedan za svoj ugljikohidrat i preživi spremanje", () => {
    const { d: d0, id } = withKobasice();
    const d = saveRecipe(d0, {
      id: "r-x-1",
      n: "X",
      c: "Tjestenina",
      d: "",
      use: { [id]: 100 },
      extra: [],
      st: [],
    }).data;
    const back = migrate(JSON.parse(JSON.stringify(d)));
    expect(recipeOf(back, "r-x-1")!.n).toBe("X");
    expect(back.items.custom[0].om!.role).toBe("prot");
    const filled = autoFillPlan(back);
    expect(
      Object.values(filled.plan.slots)
        .flat()
        .some((x) => x.r === "r-x-1"),
    ).toBe(true);
    expect(shopping(filled).length).toBeGreaterThan(0);
  });
});

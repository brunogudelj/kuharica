import { describe, expect, it } from "vitest";
import { fromClaudeFood, fromOff, hitPatch, parseQuantity } from "./foodinfo";
import { defaultData } from "../state/model";
import { addItem } from "./actions";
import { newCustomItem } from "./items";
import { learnAliases, matchItem } from "./importRecipe";

describe("podaci o proizvodu", () => {
  it("čita pakiranje s deklaracije", () => {
    expect(parseQuantity("400 g")).toEqual({ pack: 400, unit: "g" });
    expect(parseQuantity("1 kg")).toEqual({ pack: 1000, unit: "g" });
    expect(parseQuantity("0,5 l")).toEqual({ pack: 500, unit: "ml" });
    expect(parseQuantity("6 x 100 g")).toEqual({ pack: 600, unit: "g" });
    expect(parseQuantity("1 komad")).toBeNull();
  });

  it("Open Food Facts proizvod u namirnicu", () => {
    const h = fromOff({
      code: "3850104222337",
      product_name: "Meksička mješavina",
      brands: "Ledo, Fortenova",
      quantity: "400 g",
      nutriments: { "energy-kcal_100g": 62, proteins_100g: 2.9, carbohydrates_100g: 9.1, fat_100g: 0.6 },
    })!;
    expect(h).toMatchObject({ brand: "Ledo", pack: 400, unit: "g", kcal: 62, prot: 2.9 });
    const p = hitPatch({ n: "Meksička mješavina", u: "g" }, h);
    expect(p).toMatchObject({
      kcal: 62,
      prot: 2.9,
      carb: 9.1,
      fat: 0.6,
      brand: "Ledo",
      ean: "3850104222337",
      pack: 400,
    });
    expect(p.alias).toEqual(["Ledo Meksička mješavina"]);
    // komadi: kalorije na 100 g se ne prepisuju
    expect(hitPatch({ n: "x", u: "kom" }, h).kcal).toBeUndefined();
    // kJ kad nema kcal
    expect(fromOff({ code: "1", product_name: "a", nutriments: { energy_100g: 418.4 } })!.kcal).toBe(100);
  });

  it("Claudeov odgovor", () => {
    const r = fromClaudeFood(
      'Evo: {"products":[{"name":"Meksička mješavina","brand":"Ledo","quantity":"750 g","kcal":60,"protein":3}]}',
    );
    expect(r[0]).toMatchObject({ brand: "Ledo", pack: 750, kcal: 60, prot: 3, carb: null });
  });
});

describe("prepoznavanje namirnica pri uvozu", () => {
  it("drugi naziv i marka imaju prednost, a ručno povezano se pamti", () => {
    let d = defaultData();
    const it = {
      ...newCustomItem({ n: "Meksička mješavina", cat: "frz", src: "K", u: "g", pack: 400, min: 0 }),
      brand: "Ledo",
    };
    d = addItem(d, it, 0).data;
    expect(matchItem(d, "300 g Ledo meksička mješavina")?.id).toBe(it.id);
    expect(matchItem(d, "mexican vegetable mix")?.id).not.toBe(it.id);
    const l = learnAliases(d, [[it.id, "2 cups mexican vegetable mix"]]);
    expect(l.n).toBe(1);
    expect(matchItem(l.data, "500 g mexican vegetable mix, frozen")?.id).toBe(it.id);
    // isti naziv se ne pamti dvaput
    expect(learnAliases(l.data, [[it.id, "1 cup Mexican vegetable mix"]]).n).toBe(0);
  });
});

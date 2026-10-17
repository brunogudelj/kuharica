import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { emptyFilter, facetCounts, feed, filterFeed } from "./feed";
import { addShop, removeShop } from "./shops";
import { makeDemo } from "./demo";
import { allItems } from "./items";

describe("feed recepata", () => {
  const d = makeDemo(Date.UTC(2026, 9, 17));
  const all = feed(d);

  it("sadrži obroke, omlete i prep na jednom mjestu", () => {
    const kinds = new Set(all.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["meal", "om", "prep"]));
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length);
  });

  it("filteri se kombiniraju: unutar skupine ili, između skupina i", () => {
    const f = { ...emptyFilter(), kind: ["meal" as const], carb: ["Riža", "Krumpir"] };
    const out = filterFeed(all, f, d);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((e) => e.kind === "meal" && ["Riža", "Krumpir"].includes(e.carb))).toBe(true);
    const narrower = filterFeed(all, { ...f, prot: ["Piletina"] }, d);
    expect(narrower.length).toBeLessThanOrEqual(out.length);
    expect(narrower.every((e) => e.prot.includes("Piletina"))).toBe(true);
  });

  it("brojevi u filteru ne broje vlastitu skupinu", () => {
    const f = { ...emptyFilter(), carb: ["Riža"] };
    const c = facetCounts(all, f, d, "carb");
    expect(c["Krumpir"]).toBeGreaterThan(0);
  });

  it("demo ima kalorije i cijene, pa kartice imaju brojke", () => {
    const meal = all.find((e) => e.kind === "meal")!;
    expect(meal.kcal).toBeGreaterThan(0);
    expect(meal.cost).toBeGreaterThan(0);
  });
});

describe("dućani", () => {
  it("brisanje dućana prebacuje namirnice na Ostalo", () => {
    const d0 = defaultData();
    const { data: d1, id } = addShop(d0, { n: "Tržnica Kvatrić", type: "Tržnica", addr: "", url: "", note: "" });
    expect(d1.shops.at(-1)!.id).toBe("O");
    const item = allItems(d1)[0];
    const d2 = { ...d1, items: { ...d1.items, over: { [item.id]: { src: id } } } };
    const r = removeShop(d2, id);
    expect(r.data.shops.some((s) => s.id === id)).toBe(false);
    expect(allItems(r.data).find((i) => i.id === item.id)!.src).toBe("O");
  });
});

import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { emptyFilter, facetCounts, feed, filterFeed } from "./feed";
import { addShop, removeShop } from "./shops";
import { makeDemo } from "./demo";
import { allItems } from "./items";

describe("feed recepata", () => {
  const d = makeDemo(Date.UTC(2026, 9, 17));
  const all = feed(d);

  it("recepti su obroci i omleti, a prep ima svoj popis s istim podacima", async () => {
    const kinds = new Set(all.map((e) => e.kind));
    // omlet je recept s vrstom jela Omlet
    expect(kinds).toEqual(new Set(["meal"]));
    expect(all.filter((e) => e.kinds.includes("omlet")).length).toBeGreaterThan(10);
    const { prepFeed } = await import("./feed");
    expect(prepFeed(d).every((e) => e.kind === "prep")).toBe(true);
    expect(prepFeed(d).length).toBeGreaterThan(5);
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length);
  });

  it("vrsta jela: omleti su omlet, a juha, salata, wok i varivo se prepoznaju iz ugrađenih recepata", () => {
    expect(all.filter((e) => e.id.startsWith("om-")).every((e) => e.kinds.includes("omlet") && e.portion)).toBe(true);
    for (const k of ["juha", "salata", "wok", "varivo", "curry", "rezanci", "pasta"])
      expect(all.some((e) => e.kind === "meal" && e.kinds.includes(k))).toBe(true);
    const f = { ...emptyFilter(), kinds: ["juha"] };
    expect(filterFeed(all, f, d).every((e) => e.kinds.includes("juha"))).toBe(true);
  });

  it("filteri se kombiniraju: unutar skupine ili, između skupina i", () => {
    const f = { ...emptyFilter(), tags: ["Wok", "Air fryer"], carb: ["Riža", "Krumpir"] };
    const out = filterFeed(all, f, d);
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every((e) => e.tags.some((t) => ["Wok", "Air fryer"].includes(t)) && ["Riža", "Krumpir"].includes(e.carb)),
    ).toBe(true);
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

describe("potrošnja po dućanu", () => {
  it("ukupno dosad i tjedni prosjek zadnjih 6 mjeseci", async () => {
    const { shopSpend } = await import("./costs");
    const now = Date.UTC(2026, 9, 17);
    const day = 86400000;
    const d = defaultData();
    d.costs["2026-01"] = [{ id: "a", t: now - 300 * day, shop: "K", amount: 100, note: "", est: false }];
    d.costs["2026-10"] = [
      { id: "b", t: now - 14 * day, shop: "K", amount: 52, note: "", est: false },
      { id: "c", t: now - 1 * day, shop: "K", amount: 26, note: "", est: false },
    ];
    const s = shopSpend(d, now);
    expect(s.byShop.K.total).toBe(178);
    expect(s.byShop.K.last6).toBe(78);
    expect(s.byShop.K.weekly).toBeCloseTo(3, 5);
  });
});

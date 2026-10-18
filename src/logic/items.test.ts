import { todayKey } from "./dates";
import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { migrate } from "../storage/storage";
import { addItem, addSlot, buy, editItem, removeItem, setHidden } from "./actions";
import { defaultStep, hiddenItems, itemOf, newCustomItem, visibleItems } from "./items";
import { costOf, qty, shopping } from "./inventory";

const kobasice = () =>
  newCustomItem({ n: "Pileće kobasice Gavrilović", cat: "fri", src: "K", u: "g", pack: 400, min: 200 });

describe("vlastite namirnice", () => {
  it("dodaj s početnom količinom i pojavi se u zalihi", () => {
    const i = kobasice();
    expect(i.id.startsWith("c-pilece-kobasice")).toBe(true);
    const d = addItem(defaultData(), i, 100).data;
    expect(visibleItems(d).some((x) => x.id === i.id)).toBe(true);
    expect(qty(d, i.id)).toBe(100);
  });
  it("ispod minimuma dolazi na popis za kupovinu u svom dućanu", () => {
    const i = kobasice();
    const d = addItem(defaultData(), i, 100).data;
    const row = shopping(d).find((r) => r.i.id === i.id)!;
    expect(row.packs).toBe(1);
    expect(row.i.src).toBe("K");
  });
  it("Kupio i cijena rade kao za ugrađene", () => {
    const i = kobasice();
    let d = addItem(defaultData(), i).data;
    d.stock[i.id] = { qty: 0, price: 3.2 };
    d = buy(d, i.id, 1).data;
    expect(qty(d, i.id)).toBe(400);
    expect(costOf(d, { [i.id]: 200 }).c).toBeCloseTo(1.6);
  });
  it("uredi i obriši", () => {
    const i = kobasice();
    let d = addItem(defaultData(), i, 50).data;
    d = editItem(d, i.id, { n: "Kobasice", pack: 1000 });
    expect(itemOf(d, i.id)!.n).toBe("Kobasice");
    expect(itemOf(d, i.id)!.step).toBe(defaultStep("g", 1000));
    d = removeItem(d, i.id).data;
    expect(itemOf(d, i.id)).toBeUndefined();
    expect(d.stock[i.id]).toBeUndefined();
  });
  it("preživi spremanje i sinkronizaciju (migrate)", () => {
    const i = kobasice();
    const d = addItem(defaultData(), i, 50).data;
    const back = migrate(JSON.parse(JSON.stringify(d)));
    expect(itemOf(back, i.id)!.n).toBe(i.n);
  });
});

describe("ugrađene namirnice", () => {
  it("skrivena nema minimum, ali ulazi u kupovinu ako je traži plan", () => {
    let d = setHidden(defaultData(), "piletina", true).data;
    expect(hiddenItems(d).map((x) => x.id)).toContain("piletina");
    expect(shopping(d).some((r) => r.i.id === "piletina")).toBe(false);
    d = addSlot(d, todayKey(), { r: "teriyaki", s: 1.5 });
    expect(shopping(d).find((r) => r.i.id === "piletina")!.short).toBeCloseTo(250);
    d = setHidden(d, "piletina", false).data;
    expect(visibleItems(d).some((x) => x.id === "piletina")).toBe(true);
  });
  it("promjena pakiranja i minimuma", () => {
    const d = editItem(defaultData(), "piletina", { pack: 500, min: 0 });
    expect(itemOf(d, "piletina")!.pack).toBe(500);
    expect(shopping(d).some((r) => r.i.id === "piletina")).toBe(false);
  });
});

describe("kreni od nule", () => {
  it("sakrije katalog, obriše vlastite, količine i pripremljeno; recepti i troškovi ostaju", async () => {
    const { resetItems, restoreItem, saveRecipe } = await import("./actions");
    let d = addItem(defaultData(), kobasice(), 100).data;
    d.stock.piletina = { qty: 500, price: 9.99 };
    d.prepStock.riza = 2;
    d.costs["2026-10"] = [{ id: "a", t: 1, shop: "K", amount: 5, note: "", est: false }];
    d = saveRecipe(d, { id: "r-a-1", n: "A", c: "Riža", d: "", use: { piletina: 100 }, extra: [], st: [] }).data;
    d = resetItems(d).data;
    expect(visibleItems(d)).toEqual([]);
    expect(d.items.custom).toEqual([]);
    expect(d.stock).toEqual({});
    expect(d.prepStock).toEqual({});
    expect(d.recipes.length).toBe(1);
    expect(d.costs["2026-10"].length).toBe(1);
    // bez minimuma; na popisu je samo ono što traže isplanirani omleti
    expect(shopping(d).every((r) => r.forPlan)).toBe(true);
    for (const l of Object.values(d.plan.slots)) for (const x of l) x.done = true;
    expect(shopping(d)).toEqual([]);
    d = restoreItem(d, "jaja", 10).data;
    expect(visibleItems(d).map((i) => i.id)).toEqual(["jaja"]);
    expect(qty(d, "jaja")).toBe(10);
  });
});

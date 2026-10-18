import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { addReceipt, purchase, resetItems, undoPurchase } from "./actions";
import { price, qty, shopping } from "./inventory";
import { visibleItems } from "./items";

const T = new Date(2026, 9, 17, 12).getTime();

describe("kupovina s popisa", () => {
  it("točna količina ide u zalihu, upisana cijena se pamti po pakiranju", () => {
    const r = purchase(defaultData(), "piletina", 512, 5.6, T).data;
    expect(qty(r, "piletina")).toBe(512);
    expect(price(r, "piletina")).toBeCloseTo((5.6 / 512) * 1000, 1);
    const e = r.costs["2026-10"][0];
    expect(e).toMatchObject({ item: "piletina", qty: 512, amount: 5.6, est: true, shop: "K" });
  });
  it("bez upisane cijene koristi poznatu cijenu pakiranja", () => {
    const d = defaultData();
    d.stock.gyoze = { qty: 0, price: 4 };
    const r = purchase(d, "gyoze", 20, null, T).data;
    expect(r.costs["2026-10"][0].amount).toBe(4);
  });
  it("vraćanje kupnje miče količinu i zapis", () => {
    const d = purchase(defaultData(), "jaja", 10, 2.5, T).data;
    const e = d.costs["2026-10"][0];
    const r = undoPurchase(d, "2026-10", e.id).data;
    expect(qty(r, "jaja")).toBe(0);
    expect(r.costs["2026-10"]).toEqual([]);
  });
  it("skrivena namirnica se vraća kad je kupiš", () => {
    const d = resetItems(defaultData()).data;
    const r = purchase(d, "jaja", 10, null, T).data;
    expect(visibleItems(r).map((i) => i.id)).toEqual(["jaja"]);
  });
  it("kupljeno nestaje s popisa, a ukupni račun zamjenjuje stavke tog dućana", () => {
    let d = defaultData();
    for (const k of Object.keys(d.plan.om)) d.plan.om[k].done = true;
    expect(shopping(d).some((r) => r.i.id === "piletina")).toBe(true); // minimum 500 g
    d = purchase(d, "piletina", 520, 5.7, T).data;
    expect(shopping(d).some((r) => r.i.id === "piletina")).toBe(false);
    d = purchase(d, "miso", 300, 6, T).data; // Bio&Bio
    const res = addReceipt(d, { shop: "K", amount: 30, t: T + 1000, note: "Račun" });
    expect(res.replaced).toBe(1);
    expect(res.data.costs["2026-10"].map((e) => e.shop).sort()).toEqual(["BIO", "K"]);
    expect(qty(res.data, "piletina")).toBe(520);
  });
});

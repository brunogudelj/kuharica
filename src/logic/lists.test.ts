import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { migrate } from "../storage/storage";
import { addItem } from "./actions";
import { allItems, newCustomItem } from "./items";
import { addEntry, grpName, removeEntry, usage } from "./lists";

describe("popisi u Postavkama", () => {
  it("nova skupina i jedinica za pileći temeljac", () => {
    let d = defaultData();
    const g = addEntry(d, "grps", "Juhe i temeljci");
    d = g.data;
    const u = addEntry(d, "units", "l");
    d = u.data;
    expect(addEntry(d, "grps", "juhe i temeljci").id).toBeNull();
    const it = newCustomItem({ n: "Pileći temeljac", cat: "fri", grp: g.id!, src: "K", u: "l", pack: 1, min: 0 });
    d = addItem(d, it, 1).data;
    expect(grpName(d, allItems(d).find((i) => i.n === "Pileći temeljac")!.grp)).toBe("Juhe i temeljci");
    // preživi spremanje i učitavanje
    const back = migrate(JSON.parse(JSON.stringify(d)));
    expect(back.items.custom[0].u).toBe("l");
    expect(back.lists.grps.some((x) => x.n === "Juhe i temeljci")).toBe(true);
    // jedinica u upotrebi se ne briše, skupina se briše i namirnica ide na Ostalo
    expect(removeEntry(d, "units", "l").data).toBe(d);
    const r = removeEntry(d, "grps", g.id!).data;
    expect(allItems(r).find((i) => i.n === "Pileći temeljac")!.grp).toBe("ostalo");
    expect(usage(r, "grps", "ostalo")).toBeGreaterThan(0);
    // ugrađeno se ne briše
    expect(removeEntry(d, "cats", "fri").data).toBe(d);
  });
});

describe("stari tjedni plan → datumi", () => {
  it("pon–ned zadnjeg tjedna postaju datumi, ciklus se čuva", async () => {
    const { addDays, dkey } = await import("./dates");
    const { cycleIx } = await import("../state/model");
    const t = Date.UTC(2026, 9, 14, 12); // srijeda 14. 10. 2026.
    const old = {
      version: 1,
      updatedAt: t,
      plan: {
        start: 1,
        days: [
          { r: "teriyaki", done: true },
          { r: "losos", done: false },
          { r: "", done: false },
          { r: "", done: false },
          { r: "", done: false },
          { r: "", done: false },
          { r: "", done: false },
        ],
        om: Array.from({ length: 7 }, () => ({ sel: { base: "protein", fill: [], carb: "nista" }, done: false })),
        extra: { juha: Array.from({ length: 7 }, () => ({ r: "dod-miso", done: false })) },
      },
    };
    const d = migrate(old);
    const mon = "2026-10-12";
    // stari ručak i večera postaje obrok od 1,5 porcija, juha obrok prije njega
    expect(d.plan.slots[mon].map((x) => x.r)).toEqual(["dod-miso", "teriyaki"]);
    expect(d.plan.slots[mon][1]).toMatchObject({ r: "teriyaki", s: 1.5, done: true });
    expect(d.plan.slots[addDays(mon, 1)].map((x) => x.r)).toContain("losos");
    expect(d.plan.slots[addDays(mon, 6)].map((x) => x.r)).toEqual(["dod-miso"]);
    // ponedjeljak je bio 2. dan ciklusa (start 1)
    expect(cycleIx(d.plan, mon)).toBe(1);
    expect(dkey(new Date(2026, 9, 12))).toBe(mon);
  });
});

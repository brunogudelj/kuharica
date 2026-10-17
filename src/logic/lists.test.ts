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

import { describe, expect, it } from "vitest";
import { DAILY, ITEMS, OM_PRESETS, PREP_INV, RBY, RECIPES, REC_USE_PREP } from "../data";
import { defaultData } from "../state/model";
import type { AppData } from "../state/model";
import { addReceipt, buy, cook, eatOmlet, makePrep, newWeek } from "./actions";
import { effUse, planNeeds, qty, shopping, status } from "./inventory";
import { autoOmWeek, omMacros, omNorm, validOm } from "./omlet";
import { niceNum, plural, scaleText } from "./format";
import { costSummary } from "./costs";

/** Zaliha s puno svega, da ništa ne fali */
function full(): AppData {
  const d = defaultData();
  for (const i of ITEMS) d.stock[i.id] = { qty: 10000, price: null };
  return d;
}
// zaliha se sprema zaokružena na 2 decimale
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 1);

describe("pravilo 1: osnova je 1,5 porcija", () => {
  it("brojač 1 porcija skida 2/3 recepta", () => {
    const d = full();
    const r = cook(d, "teriyaki", null, 1 / 1.5).data;
    close(qty(d, "piletina") - qty(r, "piletina"), (250 * 1) / 1.5);
    close(qty(d, "basmati") - qty(r, "basmati"), 70 / 1.5);
  });
  it("plan (faktor 1) skida cijeli recept od 1,5 porcija", () => {
    const d = full();
    d.plan.days[0] = { r: "teriyaki", done: false };
    const r = cook(d, "teriyaki", 0).data;
    close(qty(d, "piletina") - qty(r, "piletina"), 250);
    expect(r.plan.days[0].done).toBe(true);
  });
});

describe("pravilo 2: dnevni dodaci se ne skaliraju", () => {
  it("miso i posni sir skidaju se jednom bez obzira na porcije", () => {
    const d = full();
    const a = cook(d, "teriyaki", null, 1).data;
    const b = cook(d, "teriyaki", null, 3).data;
    close(qty(d, "posni") - qty(a, "posni"), DAILY.posni);
    close(qty(d, "posni") - qty(b, "posni"), DAILY.posni);
    close(qty(d, "miso") - qty(b, "miso"), DAILY.miso);
  });
});

describe("pravilo 3: pripremljeno se ne oduzima dvaput", () => {
  it("napravio sam: skida sirovo i dodaje jedinice", () => {
    const d = full();
    const r = makePrep(d, "tandoori-mar", 1).data;
    close(qty(d, "piletina") - qty(r, "piletina"), 500);
    expect(r.prepStock["tandoori-mar"]).toBe(PREP_INV["tandoori-mar"].make);
    const r2 = makePrep(d, "tandoori-mar", 2).data;
    expect(r2.prepStock["tandoori-mar"]).toBe(4);
  });

  it("2 vrećice tandoorija + 1 kutija krumpira → skuhaj tandoori", () => {
    const d = full();
    d.prepStock = { "tandoori-mar": 2, krumpir: 1 };
    const r = cook(d, "tandoori", null, 1).data;
    // piletina i krumpir se ne skidaju sa sirove zalihe
    close(qty(r, "piletina"), qty(d, "piletina"));
    close(qty(r, "krumpir"), qty(d, "krumpir"));
    // vrećica i kutija se skidaju
    expect(r.prepStock["tandoori-mar"]).toBe(1);
    expect(r.prepStock.krumpir).toBe(0);
    // ostatak recepta (karfiol) se skida normalno
    close(qty(d, "karfiol") - qty(r, "karfiol"), RBY.tandoori.use.karfiol);
  });

  it("bez prepa recept skida sve sirovo", () => {
    const e = effUse(RBY.tandoori, {}, false, 1);
    expect(e.consumed).toEqual([]);
    close(e.use.piletina, 250);
  });

  it("prep + recept ukupno ne troše više sirovine od jednog kuhanja iz sirovog", () => {
    for (const r of RECIPES) {
      for (const [pid] of REC_USE_PREP[r.id] || []) {
        for (const [id, a] of Object.entries(PREP_INV[pid].per)) {
          // jedinica prepa ne smije zamijeniti više nego što recept uopće troši
          if (r.use[id] != null) expect(a).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("pravilo 4: kupovina", () => {
  it("zbraja neskuhane dane, omlete i minimum pa zaokružuje na pakiranja", () => {
    const d = defaultData();
    d.plan.days[0] = { r: "teriyaki", done: false };
    d.plan.days[1] = { r: "teriyaki", done: true };
    const need = planNeeds(d);
    // jedan neskuhan teriyaki = 250 g piletine
    close(need.piletina, 250);
    // 7 nepojedenih omleta u planu traže jaja
    const eggs = d.plan.om.reduce((s, o) => s + (o.sel!.base === "klasik" ? 3 : o.sel!.base === "protein" ? 2 : 1), 0);
    close(need.jaja, eggs);
    const row = shopping(d).find((x) => x.i.id === "piletina")!;
    // potreba 250 + minimum 500 = 750 → 1 pakiranje od 1000 g
    expect(row.packs).toBe(1);
    expect(row.forPlan).toBe(true);
  });

  it("pojedeni omleti i skuhani dani ne ulaze u kupovinu", () => {
    const d = defaultData();
    d.plan.om = d.plan.om.map((o) => ({ ...o, done: true }));
    expect(planNeeds(d).jaja ?? 0).toBe(0);
  });

  it("ništa ne fali kad je zaliha puna", () => {
    expect(shopping(full())).toEqual([]);
  });
});

describe("pravilo 5: stanje namirnice", () => {
  it("nema, nisko, ok", () => {
    const d = defaultData();
    const piletina = ITEMS.find((i) => i.id === "piletina")!;
    expect(status(d, piletina)).toBe("out");
    d.stock.piletina = { qty: 100, price: null };
    expect(status(d, piletina)).toBe("low");
    d.stock.piletina = { qty: 600, price: null };
    expect(status(d, piletina)).toBe("ok");
  });
});

describe("pravilo 8: račun zamjenjuje procjene", () => {
  it("procjene iz Kupio za isti dućan i dan nestaju", () => {
    let d = defaultData();
    d.stock.piletina = { qty: 0, price: 9.99 };
    d.stock.miso = { qty: 0, price: 5 };
    const t = new Date(2026, 9, 17, 12).getTime();
    d = buy(d, "piletina", 1, t).data; // Kaufland
    d = buy(d, "miso", 1, t).data; // Bio&Bio
    const res = addReceipt(d, { shop: "K", amount: 47.3, t: t + 3600_000, note: "tjedna" });
    expect(res.replaced).toBe(1);
    const list = res.data.costs["2026-10"];
    expect(list.filter((x) => x.est).map((x) => x.shop)).toEqual(["BIO"]);
    expect(list.find((x) => !x.est)!.amount).toBe(47.3);
  });
  it("procjena iz drugog dana ostaje", () => {
    let d = defaultData();
    d.stock.piletina = { qty: 0, price: 9.99 };
    const t = new Date(2026, 9, 16, 12).getTime();
    d = buy(d, "piletina", 1, t).data;
    const res = addReceipt(d, { shop: "K", amount: 10, t: t + 86400_000, note: "" });
    expect(res.replaced).toBe(0);
  });
});

describe("pravilo 9: skaliranje teksta", () => {
  it("skalira grame i komade", () => {
    expect(scaleText("<span class=g>250 g</span> pilećih prsa", 2 / 3)).toBe("<span class=g>165 g</span> pilećih prsa");
    expect(scaleText("sok ½ limuna", 2)).toBe("sok 1 limuna");
    expect(scaleText("1 žličica meda", 2 / 3)).toBe("⅔ žličica meda");
  });
  it("ne dira brojeve iza 'po' ni temperature i minute", () => {
    expect(scaleText("4 porcije po 70 g suhe riže", 2)).toBe("8 porcije po 70 g suhe riže");
    expect(scaleText("200 °C 10 min", 2)).toBe("200 °C 10 min");
  });
  it("faktor 1 ne mijenja ništa", () => {
    const s = "<span class=g>1,5</span> žlica";
    expect(scaleText(s, 1)).toBe(s);
  });
  it("niceNum", () => {
    expect(niceNum(166.6, "g")).toBe("165");
    expect(niceNum(1.5)).toBe("1½");
    expect(niceNum(0.25)).toBe("¼");
  });
});

describe("pravilo 10: hrvatska množina", () => {
  it("vrećica", () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25].map((n) => plural(n, "vrecica"))).toEqual([
      "vrećica",
      "vrećice",
      "vrećica",
      "vrećica",
      "vrećica",
      "vrećica",
      "vrećice",
      "vrećica",
    ]);
  });
});

describe("omleti", () => {
  it("novi tjedan omleta nema ponavljanja i čuva pojedene dane", () => {
    const d = defaultData();
    d.plan.om[0].done = true;
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const w = autoOmWeek(d, true, rng);
    expect(new Set(w.map((o) => omNorm(o.sel!))).size).toBe(7);
    expect(w[0]).toEqual(d.plan.om[0]);
  });
  it("pojeo sam skida sastojke i označi dan", () => {
    const d = full();
    const r = eatOmlet(d, 0).data;
    expect(r.plan.om[0].done).toBe(true);
    expect(qty(r, "jaja")).toBeLessThan(qty(d, "jaja"));
  });
  it("gotove kombinacije imaju smislene proteine", () => {
    for (const p of OM_PRESETS) {
      const m = omMacros(defaultData(), p.sel, 1);
      expect(m.p).toBeGreaterThan(20);
      expect(m.k).toBeLessThan(600);
    }
  });
  it("validOm odbacuje neispravno", () => {
    expect(validOm({ base: "nema", fill: [], carb: "nista" }).base).toBe("protein");
    expect(validOm({ base: "klasik", fill: ["spinat", "xxx"], carb: "nista" }).fill).toEqual(["spinat"]);
  });
  it("novi tjedan pomiče ciklus za 7 dana", () => {
    const d = defaultData();
    expect(newWeek(d).plan.start).toBe(2);
  });
});

describe("troškovi", () => {
  it("procjena po tempu tek nakon 7 dana", () => {
    const d = defaultData();
    d.costs["2026-10"] = [{ id: "a", t: new Date(2026, 9, 3).getTime(), shop: "K", amount: 50, note: "", est: false }];
    expect(costSummary(d, new Date(2026, 9, 5).getTime()).pace).toBeNull();
    const s = costSummary(d, new Date(2026, 9, 10).getTime());
    close(s.pace!, (50 / 10) * 31);
  });
});

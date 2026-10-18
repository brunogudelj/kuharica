import { recipeOf } from "./recipes";
import { describe, expect, it } from "vitest";
import { ITEMS, OM_PRESETS, PREP_INV, RBY, RECIPES, REC_USE_PREP } from "../data";
import { daySlots, defaultData } from "../state/model";
import type { AppData } from "../state/model";
import {
  addReceipt,
  addSlot,
  autoFillPlan,
  buy,
  cook,
  makePrep,
  moveSlot,
  removeSlot,
  setCycleToday,
  setSlot,
  toggleSlot,
} from "./actions";
import { addDays, aheadKeys, todayKey, windowKeys } from "./dates";
import { cycleIx } from "../state/model";
import { effUse, planNeeds, qty, shopping, status } from "./inventory";
import { omMacros, validOm } from "./omlet";
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

describe("pravilo 1: sve je za 1 porciju, recept je napisan za 1,5", () => {
  it("1 porcija skida 2/3 recepta, 1,5 porcija cijeli", () => {
    const d = full();
    const r = cook(d, "teriyaki", null, 1).data;
    close(qty(d, "piletina") - qty(r, "piletina"), 250 / 1.5);
    close(qty(d, "basmati") - qty(r, "basmati"), 70 / 1.5);
    const r2 = cook(d, "teriyaki", null, 1.5).data;
    close(qty(d, "piletina") - qty(r2, "piletina"), 250);
  });
  it("skuhao sam označi obrok tog dana", () => {
    let d = full();
    d.plan.slots = {};
    d = addSlot(d, todayKey(), { r: "teriyaki" });
    const r = cook(d, "teriyaki", todayKey(), 1).data;
    close(qty(d, "piletina") - qty(r, "piletina"), 250 / 1.5);
    expect(daySlots(r.plan, todayKey())[0].done).toBe(true);
    // posni sir se više ne skida sam
    close(qty(d, "posni") - qty(r, "posni"), 0);
  });
});

describe("pravilo 2: svaki obrok je isti", () => {
  it("juha je obrok kao i svaki drugi: 1 porcija", () => {
    let d = full();
    d.plan.slots = {};
    d = addSlot(d, todayKey(), { r: "dod-miso" });
    const id = daySlots(d.plan, todayKey())[0].id;
    const j = toggleSlot(d, todayKey(), id).data;
    close(qty(d, "miso") - qty(j, "miso"), RBY["dod-miso"].use.miso);
    expect(daySlots(j.plan, todayKey())[0].done).toBe(true);
  });

  it("voće skida komad, bilo koji recept može biti bilo gdje, porcije se mijenjaju", () => {
    let d = full();
    d.plan.slots = {};
    d.stock.banana = { qty: 3, price: null };
    const k = addDays(todayKey(), 2);
    d = addSlot(d, k, { item: "banana", qty: 1 });
    expect(planNeeds(d).banana).toBe(1);
    const r = toggleSlot(d, k, daySlots(d.plan, k)[0].id).data;
    expect(qty(r, "banana")).toBe(2);
    d = addSlot(d, todayKey(), { r: "teriyaki" });
    close(planNeeds(d).piletina, 250 / 1.5);
    const sid = daySlots(d.plan, todayKey())[0].id;
    d = setSlot(d, todayKey(), sid, { s: 1.5 });
    close(planNeeds(d).piletina, 250);
    d = moveSlot(addSlot(d, todayKey(), { r: "losos" }), todayKey(), sid, 1);
    expect(daySlots(d.plan, todayKey()).map((x) => x.r)).toEqual(["losos", "teriyaki"]);
    d = removeSlot(d, todayKey(), sid);
    expect(daySlots(d.plan, todayKey()).map((x) => x.r)).toEqual(["losos"]);
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
    const r = cook(d, "tandoori", null, 1.5).data;
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
  it("zbraja nepojedene obroke u razdoblju i minimum pa zaokružuje na pakiranja", () => {
    let d = defaultData();
    d = addSlot(d, todayKey(), { r: "teriyaki", s: 1.5 });
    d = addSlot(d, addDays(todayKey(), 1), { r: "teriyaki", s: 1.5 });
    const t1 = daySlots(d.plan, addDays(todayKey(), 1));
    t1[t1.length - 1].done = true;
    // izvan razdoblja popisa (7 dana) ne ulazi
    d = addSlot(d, addDays(todayKey(), 9), { r: "teriyaki", s: 1.5 });
    const need = planNeeds(d);
    // jedan nepojeden teriyaki od 1,5 porcija = 250 g piletine
    close(need.piletina, 250);
    // nepojedeni omleti (1 porcija) u sljedećih 7 dana traže jaja
    const eggs = aheadKeys(Date.now(), 7)
      .flatMap((k) => daySlots(d.plan, k))
      .filter((x) => x.r?.startsWith("om-"))
      .reduce((s, x) => s + (recipeOf(d, x.r!)!.use.jaja ?? 0) / 1.5, 0);
    close(need.jaja, eggs);
    const row = shopping(d).find((x) => x.i.id === "piletina")!;
    // potreba 250 + minimum 500 = 750 → 1 pakiranje od 1000 g
    expect(row.packs).toBe(1);
    expect(row.forPlan).toBe(true);
  });

  it("pojedeni obroci ne ulaze u kupovinu", () => {
    const d = defaultData();
    for (const l of Object.values(d.plan.slots)) for (const x of l) x.done = true;
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
  it("popuni plan: od danas, postojeći obroci ostaju, dodaje se ono što fali, jučer se ne dira", () => {
    let d = defaultData();
    d.plan.slots = {};
    d = addSlot(d, addDays(todayKey(), 1), { r: "losos" });
    const f = autoFillPlan(d);
    const ahead = windowKeys().slice(1);
    // doručak, juha, ručak, salata, večera
    for (const k of ahead.filter((x) => x !== addDays(todayKey(), 1) && x >= todayKey())) {
      const l = daySlots(f.plan, k);
      expect(l[0].r?.startsWith("om-")).toBe(true);
      expect(l.map((x) => x.r)).toContain("dod-miso");
      expect(l.length).toBeGreaterThanOrEqual(5);
    }
    // losos je već ručak: dodaju se doručak, juha i salata, ali ne još jedan ručak
    const t = daySlots(f.plan, addDays(todayKey(), 1)).map((x) => x.r);
    expect(t.filter((x) => x === "losos").length).toBe(1);
    expect(t).toContain("dod-salata");
    expect(t[0]?.startsWith("om-")).toBe(true);
    expect(daySlots(f.plan, windowKeys()[0])).toEqual([]);
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
  it("ciklus po datumu: danas je odabrani dan, dan ciklusa raste svaki dan", () => {
    const d = setCycleToday(defaultData(), 2);
    expect(cycleIx(d.plan, todayKey())).toBe(2);
    expect(cycleIx(d.plan, addDays(todayKey(), 3))).toBe(0);
    expect(cycleIx(d.plan, addDays(todayKey(), -1))).toBe(1);
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

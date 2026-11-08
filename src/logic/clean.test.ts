import { describe, expect, it } from "vitest";
import { defaultData, emptyPlan, wipeState, WIPE_EPOCH } from "../state/model";
import { fromStored, importJson } from "../storage/storage";
import { allRecipes } from "./recipes";
import { allPreps } from "./preps";
import { feed, prepFeed } from "./feed";
import { allItems } from "./items";
import { addItem, autoFillPlan, saveRecipe } from "./actions";
import { newCustomItem } from "./items";

describe("sve od nule", () => {
  it("briše sve osim dućana, popisa i postavki", () => {
    let d = defaultData();
    d = addItem(d, newCustomItem({ n: "Moja", cat: "fri", src: "K", u: "g", pack: 100, min: 0 }), 300).data;
    d = saveRecipe(d, { id: "r-moj", n: "Moj", c: "Riža", d: "", use: {}, extra: [], st: [] }).data;
    d.costs["2026-11"] = [{ id: "a", t: 1, shop: "K", amount: 5, note: "", est: false }];
    d.shops.push({ id: "X", n: "Moj dućan", addr: "", url: "" } as (typeof d.shops)[number]);
    const c = wipeState(d);
    expect(allItems(c)).toEqual([]);
    expect(allRecipes(c)).toEqual([]);
    expect(allPreps(c)).toEqual([]);
    expect(feed(c)).toEqual([]);
    expect(prepFeed(c)).toEqual([]);
    expect(c.stock).toEqual({});
    expect(c.costs).toEqual({});
    expect(c.plan.slots).toEqual({});
    expect(c.shops.some((s) => s.id === "X")).toBe(true);
    expect(c.lists.kinds.length).toBeGreaterThan(5);
    expect(autoFillPlan(c).plan.slots).toEqual({});
    expect(c.epoch).toBe(WIPE_EPOCH);
  });

  it("vlastito dodano nakon brisanja radi normalno", () => {
    let d = wipeState(defaultData());
    const it = newCustomItem({ n: "Jaja", cat: "fri", src: "K", u: "kom", pack: 10, min: 0 });
    d = addItem(d, it, 10).data;
    d = saveRecipe(d, { id: "r-o", n: "Omlet", c: "Ostalo", d: "", use: { [it.id]: 3 }, extra: [], st: [] }).data;
    expect(allItems(d).map((i) => i.n)).toEqual(["Jaja"]);
    expect(feed(d).map((e) => e.id)).toEqual(["r-o"]);
    d.plan = emptyPlan();
    expect(Object.values(autoFillPlan(d).plan.slots).flat().length).toBeGreaterThanOrEqual(0);
  });

  it("stari podaci se jednom obrišu (s GitHuba kao najstariji), novi ostaju", async () => {
    const old = defaultData() as unknown as Record<string, unknown>;
    old.updatedAt = 1000;
    const local = fromStored(old, true);
    expect(allRecipes(local)).toEqual([]);
    expect(local.updatedAt).toBeGreaterThan(1000);
    const remote = fromStored(old, false);
    expect(remote.updatedAt).toBe(0);
    const fresh = { ...wipeState(defaultData()), updatedAt: 5 };
    fresh.recipes = [{ id: "r-x", n: "X", c: "Ostalo", d: "", use: {}, extra: [], st: [] }];
    expect(fromStored(JSON.parse(JSON.stringify(fresh))).recipes.length).toBe(1);
    // vraćeni backup se ne briše
    const file = { text: async () => JSON.stringify(defaultData()) } as File;
    const b = await importJson(file);
    expect(fromStored(JSON.parse(JSON.stringify(b))).settings.builtin).toBe(true);
  });
});

describe("recept u prep", () => {
  it("čufte postaju prep: iste namirnice, plan bez njih, složeni recept dobiva prep", async () => {
    const { recipeToPrep, addSlot, makePrep } = await import("./actions");
    const { prepOf, prepInv } = await import("./preps");
    const { pc } = await import("./inventory");
    const { todayKey } = await import("./dates");
    let d = wipeState(defaultData());
    const meso = newCustomItem({ n: "Mljeveno meso", cat: "fri", src: "K", u: "g", pack: 500, min: 0 });
    d = addItem(d, meso, 1000).data;
    d = saveRecipe(d, {
      id: "r-cufta-1",
      n: "Čufta",
      c: "Ostalo",
      d: "Tava · 30 min",
      use: { [meso.id]: 450 },
      extra: ["sol"],
      st: ["Oblikuj"],
    }).data;
    d = saveRecipe(d, {
      id: "r-pire-1",
      n: "Čufte s pireom",
      c: "Krumpir",
      d: "",
      use: {},
      extra: [],
      st: [],
      parts: { "r-cufta-1": 1 },
    }).data;
    d = addSlot(d, todayKey(), { r: "r-cufta-1" });
    const res = recipeToPrep(d, "r-cufta-1");
    const pid = res.prepId!;
    d = res.data;
    expect(prepOf(d, pid)).toMatchObject({ n: "Čufta", time: "30 min", use: { [meso.id]: 450 } });
    expect(d.recipes.map((r) => r.id)).toEqual(["r-pire-1"]);
    expect(d.recipes[0].prep).toEqual({ [pid]: 1.5 });
    expect(d.plan.slots[todayKey()]).toBeUndefined();
    expect(prepInv(d, pid)).toMatchObject({ make: 1.5, unit: "porcija" });
    d = makePrep(d, pid, 1).data;
    expect(pc(d, pid)).toBe(1.5);
  });
});

describe("prep u recept i složeni obrok", () => {
  it("čufte (prep) + pire (recept) = čufte s pireom; prep se može vratiti u recept", async () => {
    const { recipeToPrep, prepToRecipe, makePrep, cook } = await import("./actions");
    const { recipeOf } = await import("./recipes");
    const { pc, qty, effUse } = await import("./inventory");
    let d = wipeState(defaultData());
    const meso = newCustomItem({ n: "Meso", cat: "fri", src: "K", u: "g", pack: 500, min: 0 });
    const krumpir = newCustomItem({ n: "Krumpir", cat: "pan", src: "K", u: "g", pack: 2000, min: 0 });
    d = addItem(d, meso, 1000).data;
    d = addItem(d, krumpir, 2000).data;
    d = saveRecipe(d, {
      id: "r-cufta",
      n: "Čufta",
      c: "Ostalo",
      d: "",
      use: { [meso.id]: 450 },
      extra: [],
      st: [],
    }).data;
    const res = recipeToPrep(d, "r-cufta");
    const pid = res.prepId!;
    d = res.data;
    d = saveRecipe(d, {
      id: "r-pire",
      n: "Pire",
      c: "Krumpir",
      d: "",
      use: { [krumpir.id]: 300 },
      extra: [],
      st: [],
    }).data;
    d = saveRecipe(d, {
      id: "r-cp",
      n: "Čufte s pireom",
      c: "Krumpir",
      d: "",
      use: {},
      prep: { [pid]: 1.5 },
      extra: [],
      st: [],
      parts: { "r-pire": 1 },
    }).data;
    // bez pripremljenih čufti troši meso, s njima samo krumpir
    const r = recipeOf(d, "r-cp")!;
    expect(effUse(r, {}, false, 1, d).use[meso.id]).toBeCloseTo(450);
    d = makePrep(d, pid, 1).data;
    expect(pc(d, pid)).toBe(1.5);
    const after = cook(d, "r-cp", null, 1.5).data;
    expect(pc(after, pid)).toBe(0);
    expect(qty(after, meso.id)).toBe(qty(d, meso.id));
    expect(qty(after, krumpir.id)).toBe(qty(d, krumpir.id) - 300);
    // natrag u recept: složeni obrok sada ima čufte kao dio-recept
    const back = prepToRecipe(d, pid);
    const rid = back.recipeId!;
    const cp = back.data.recipes.find((x) => x.id === "r-cp")!;
    expect(cp.parts).toEqual({ "r-pire": 1, [rid]: 1 });
    expect(cp.prep).toEqual({});
    expect(recipeOf(back.data, "r-cp")!.use[meso.id]).toBeCloseTo(450);
  });
});

describe("prep u planu", () => {
  it("čufte kao obrok: troše pripremljeno, a bez njega meso; nakon prebacivanja u recept slot ostaje", async () => {
    const { recipeToPrep, addSlot, toggleSlot, makePrep, prepToRecipe } = await import("./actions");
    const { pc, qty, planNeeds } = await import("./inventory");
    const { daySlots } = await import("../state/model");
    const { todayKey, addDays } = await import("./dates");
    let d = wipeState(defaultData());
    const meso = newCustomItem({ n: "Meso", cat: "fri", src: "K", u: "g", pack: 500, min: 0 });
    d = addItem(d, meso, 1000).data;
    d = saveRecipe(d, { id: "r-c", n: "Čufta", c: "Ostalo", d: "", use: { [meso.id]: 450 }, extra: [], st: [] }).data;
    const conv = recipeToPrep(d, "r-c");
    const pid = conv.prepId!;
    d = conv.data;
    // 1 porcija čufti u planu, a za kupovinu cijela tura (1,5 porcija = 450 g mesa)
    d = addSlot(d, todayKey(), { p: pid });
    expect(planNeeds(d)[meso.id]).toBeCloseTo(450);
    d = makePrep(d, pid, 1).data;
    expect(planNeeds(d)[meso.id] ?? 0).toBe(0);
    const sid = daySlots(d.plan, todayKey())[0].id;
    const t = toggleSlot(d, todayKey(), sid).data;
    expect(pc(t, pid)).toBe(0.5);
    expect(qty(t, meso.id)).toBe(qty(d, meso.id));
    d = addSlot(d, addDays(todayKey(), 1), { p: pid, s: 1.5 });
    const back = prepToRecipe(d, pid);
    const s1 = daySlots(back.data.plan, addDays(todayKey(), 1))[0];
    expect(s1).toMatchObject({ r: back.recipeId, s: 1.5 });
  });
});

describe("kupovina za cijele ture prepa", () => {
  it("1 porcija bolonjeza u planu kupuje za cijelu turu od 4", async () => {
    const { addSlot } = await import("./actions");
    const { saveCustomPrep } = await import("./preps");
    const { planDetail, planNeeds, shopping } = await import("./inventory");
    const { todayKey, addDays } = await import("./dates");
    let d = wipeState(defaultData());
    const meso = newCustomItem({ n: "Meso", cat: "fri", src: "K", u: "g", pack: 500, min: 0 });
    const pasta = newCustomItem({ n: "Špagete", cat: "pan", src: "K", u: "g", pack: 500, min: 0 });
    d = addItem(d, meso, 0).data;
    d = addItem(d, pasta, 0).data;
    d = saveCustomPrep(d, {
      id: "pp-bolonjez-1",
      n: "Bolonjez",
      k: "Gotovo",
      time: "",
      keep: "",
      make: 4,
      unit: "porcija",
      use: { [meso.id]: 400 },
      extra: [],
      st: [],
    }).data;
    d = saveRecipe(d, {
      id: "r-spag",
      n: "Špagete bolonjez",
      c: "Tjestenina",
      d: "",
      use: { [pasta.id]: 120 },
      prep: { "pp-bolonjez-1": 1.5 },
      extra: [],
      st: [],
    }).data;
    d = addSlot(d, todayKey(), { r: "r-spag" });
    // jedan obrok: 80 g špageta, a meso za cijelu turu bolonjeza
    expect(planNeeds(d)[pasta.id]).toBeCloseTo(80);
    expect(planNeeds(d)[meso.id]).toBeCloseTo(400);
    const row = shopping(d).find((x) => x.i.id === meso.id)!;
    expect(row.forPrep).toEqual(["pp-bolonjez-1"]);
    expect(planDetail(d).batches[0]).toMatchObject({ need: 1, ture: 1, make: 4 });
    // pet obroka (5 porcija) = 2 ture
    for (let i = 1; i < 5; i++) d = addSlot(d, addDays(todayKey(), i), { p: "pp-bolonjez-1" });
    expect(planNeeds(d)[meso.id]).toBeCloseTo(800);
    // s 4 pripremljene porcije fali 1 → još jedna tura
    d.prepStock["pp-bolonjez-1"] = 4;
    expect(planNeeds(d)[meso.id]).toBeCloseTo(400);
    d.prepStock["pp-bolonjez-1"] = 5;
    expect(planNeeds(d)[meso.id] ?? 0).toBe(0);
  });
});

describe("napravit ću prep", () => {
  it("4 porcije bolonjeza idu na popis, Napravio sam ih skida", async () => {
    const { setPrepTodo, makePrep } = await import("./actions");
    const { saveCustomPrep } = await import("./preps");
    const { planNeeds, shopping } = await import("./inventory");
    let d = wipeState(defaultData());
    const meso = newCustomItem({ n: "Meso", cat: "fri", src: "K", u: "g", pack: 500, min: 0 });
    const pasata = newCustomItem({ n: "Pasata", cat: "pan", src: "K", u: "g", pack: 400, min: 0 });
    d = addItem(d, meso, 100).data;
    d = addItem(d, pasata, 0).data;
    d = saveCustomPrep(d, {
      id: "pp-bol",
      n: "Bolonjez",
      k: "Gotovo",
      time: "",
      keep: "",
      make: 2,
      unit: "porcija",
      use: { [meso.id]: 200, [pasata.id]: 160 },
      extra: [],
      st: [],
    }).data;
    d = setPrepTodo(d, "pp-bol", 4).data;
    expect(planNeeds(d)[meso.id]).toBeCloseTo(400);
    expect(planNeeds(d)[pasata.id]).toBeCloseTo(320);
    const row = shopping(d).find((x) => x.i.id === meso.id)!;
    expect(row.short).toBeCloseTo(300);
    expect(row.forPrep).toEqual(["pp-bol"]);
    d = makePrep(d, "pp-bol", 1).data;
    expect(d.prepTodo["pp-bol"]).toBe(2);
    d = makePrep(d, "pp-bol", 1).data;
    expect(d.prepTodo["pp-bol"]).toBeUndefined();
    expect(setPrepTodo(d, "pp-bol", 0).data.prepTodo).toEqual({});
  });
});

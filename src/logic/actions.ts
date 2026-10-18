/* Čiste funkcije koje iz stanja rade novo stanje. Poništavanje = povratak prethodnog stanja. */
import { CYCLE, ITEMS } from "../data";
import { prepInv, prepOf } from "./preps";
import type { CustomRecipe, Item } from "../data";
import { allRecipes, isBuiltinRecipe, recipeOf } from "./recipes";
import type { AppData, CostEntry, Slot } from "../state/model";
import { cleanState, clone, cycleIx, daySlots, slotId } from "../state/model";
import { todayKey, windowKeys } from "./dates";
import { effUse, missingFor, pc, portionF, prepEff, price, qty, slotUse } from "./inventory";
import { shuffle } from "./omlet";
import { allItems, defaultStep, isCustom, itemOf } from "./items";
import { eur, fmt, monthKey, newId, pfmt, round, sameDay } from "./format";

export interface Result {
  data: AppData;
  msg: string;
}

export function setQty(d: AppData, id: string, v: number) {
  d.stock[id] = { qty: Math.max(0, round(v)), price: price(d, id) };
}

function consume(d: AppData, use: Record<string, number>, consumed: [string, number][]) {
  for (const [id, a] of Object.entries(use)) setQty(d, id, qty(d, id) - a);
  for (const [p, k] of consumed) d.prepStock[p] = Math.max(0, round(pc(d, p) - k));
}

/** Skuhaj ili pojedi recept: skida `porc` porcija sa zalihe (prvo pripremljeno). Ako je recept u planu
 * (na danom danu ili prvi nepojedeni), taj obrok dobiva kvačicu. */
export function cook(src: AppData, rid: string, day: string | null, porc = 1, now = Date.now()): Result {
  const d = clone(src);
  const r = recipeOf(src, rid);
  if (!r) return { data: src, msg: "Recept ne postoji." };
  const eff = effUse(r, { ...d.prepStock }, false, portionF(r, porc), src);
  consume(d, eff.use, eff.consumed);
  const keys = day ? [day] : windowKeys(now).filter((k) => k >= todayKey(now));
  for (const k of keys) {
    const x = daySlots(d.plan, k).find((y) => y.r === rid && !y.done);
    if (x) {
      x.done = true;
      break;
    }
  }
  d.hist = [{ r: rid, t: now }, ...d.hist].slice(0, 30);
  const np = eff.consumed.length;
  return { data: d, msg: `${r.n}: skinuto sa zalihe${np ? `, iskorišteno ${np} iz prepa` : ""}.` };
}

/** Napravi prep: skida sirove sastojke × t i dodaje make × t jedinica u pripremljeno */
export function makePrep(src: AppData, pid: string, t = 1): Result {
  const d = clone(src);
  const p = prepOf(src, pid);
  const inv = prepInv(src, pid);
  if (!p || !inv) return { data: src, msg: "Prep ne postoji." };
  const eff = prepEff(src, p, t, { ...src.prepStock });
  consume(d, eff.use, eff.consumed);
  d.prepStock[pid] = round(pc(d, pid) + inv.make * t);
  return { data: d, msg: `${p.n}: +${pfmt(inv.make * t, inv.unit)} u pripremljenom.` };
}

/** Kupio: povećaj zalihu i zabilježi procjenu troška ako je cijena poznata */
export function buy(src: AppData, id: string, packs = 1, now = Date.now()): Result {
  const d = clone(src);
  const i = itemOf(d, id);
  if (!i) return { data: src, msg: "Namirnica ne postoji." };
  setQty(d, id, qty(d, id) + packs * i.pack);
  const p = price(d, id);
  let extra = "";
  if (p != null) {
    const e: CostEntry = { id: newId(), t: now, shop: i.src, amount: round(packs * p), note: i.n, est: true };
    const mk = monthKey(now);
    d.costs[mk] = [...(d.costs[mk] || []), e];
    extra = `, trošak ${eur(e.amount)}`;
  }
  return { data: d, msg: `${i.n}: +${fmt(packs * i.pack, i.u)} na zalihi${extra}.` };
}

/** Račun zamjenjuje procjene iz "Kupio" za isti dućan i isti dan */
export function addReceipt(
  src: AppData,
  r: { shop: string; amount: number; t: number; note: string },
): Result & { replaced: number } {
  const d = clone(src);
  const mk = monthKey(r.t);
  const list = d.costs[mk] || [];
  const replaced = list.filter((x) => x.est && x.shop === r.shop && sameDay(x.t, r.t));
  d.costs[mk] = list.filter((x) => !replaced.includes(x));
  d.costs[mk].push({ id: newId(), t: r.t, shop: r.shop, amount: round(r.amount), note: r.note, est: false });
  return { data: d, replaced: replaced.length, msg: "" };
}

export function removeCost(src: AppData, mk: string, id: string): AppData {
  const d = clone(src);
  d.costs[mk] = (d.costs[mk] || []).filter((x) => x.id !== id);
  return d;
}

/** Popuni plan od danas do kraja prozora: svakom danu doda ono što mu fali od doručka (omlet), juhe,
 * ručka po ciklusu (prednost recepti za koje ima sastojaka), salate, večere (isto jelo kao ručak) i voća koje
 * imaš doma. Ono što je već na danu ostaje. */
export function autoFillPlan(src: AppData, now = Date.now(), rng: () => number = Math.random): AppData {
  const d = clone(src);
  const keys = windowKeys(now).filter((k) => k >= todayKey(now));
  const used: Record<string, number> = {};
  for (const k of windowKeys(now)) for (const x of daySlots(d.plan, k)) if (x.r) used[x.r] = (used[x.r] || 0) + 1;
  const all = allRecipes(d);
  const byId = new Map(all.map((r) => [r.id, r]));
  const oms = omPool(d, rng);
  let oi = 0;
  const fruits = fruitPool(d);
  let fi = 0;
  type R = (typeof all)[number];
  const isBf = (r?: R) => !!r?.kinds?.some((k) => k === "omlet" || k === "dorucak");
  const isSoup = (r?: R) => !!r && (r.side === "juha" || !!r.kinds?.includes("juha"));
  const isSalad = (r?: R) => !!r && (r.side === "salata" || !!r.kinds?.includes("salata"));
  const isMain = (r?: R) => !!r && !isBf(r) && !isSoup(r) && !isSalad(r);
  const soup = byId.get("dod-miso") ?? all.find((r) => isSoup(r));
  const salad = byId.get("dod-salata") ?? all.find((r) => isSalad(r));
  const mk = (x: Omit<Slot, "id" | "done">): Slot => ({ id: slotId(), ...x, done: false });
  for (const k of keys) {
    const list = [...daySlots(d.plan, k)];
    const rs = list.map((x) => (x.r ? byId.get(x.r) : undefined));
    if (!rs.some(isBf) && oms.length) list.unshift(mk({ r: oms[oi++ % oms.length] }));
    if (!rs.some(isSoup) && soup) list.splice(rs.some(isBf) || oms.length ? 1 : 0, 0, mk({ r: soup.id }));
    if (!rs.some(isMain)) {
      const c = CYCLE[cycleIx(d.plan, k)];
      const pool = all.filter((r) => r.c === c && isMain(r));
      pool.sort(
        (a, b) => (used[a.id] || 0) - (used[b.id] || 0) || missingFor(d, a.id).length - missingFor(d, b.id).length,
      );
      const main = pool[0];
      if (main) {
        used[main.id] = (used[main.id] || 0) + 1;
        list.push(mk({ r: main.id }));
        if (!rs.some(isSalad) && salad) list.push(mk({ r: salad.id }));
        list.push(mk({ r: main.id }));
      }
    } else if (!rs.some(isSalad) && salad) list.push(mk({ r: salad.id }));
    if (!list.some((x) => x.item))
      for (let n = 0; n < 2 && fruits.length; n++) {
        const i = fruits[fi++ % fruits.length];
        list.push(mk({ item: i.id, qty: defaultFruitQty(i) }));
      }
    if (list.length) d.plan.slots[k] = list;
  }
  return d;
}

/** Doručci za popunjavanje: recepti s vrstom Omlet ili Doručak, prednost oni za koje imaš sastojke */
function omPool(d: AppData, rng: () => number): string[] {
  return shuffle(
    allRecipes(d).filter((r) => r.kinds?.some((k) => k === "omlet" || k === "dorucak")),
    rng,
  )
    .map((r) => ({ r, miss: missingFor(d, r.id).length }))
    .sort((a, b) => a.miss - b.miss)
    .map((x) => x.r.id);
}

/** Očisti plan od danas nadalje (ono što je pojedeno ostaje) */
export function clearAhead(src: AppData, now = Date.now()): AppData {
  const d = clone(src);
  for (const k of windowKeys(now).filter((x) => x >= todayKey(now))) {
    const left = daySlots(d.plan, k).filter((x) => x.done);
    if (left.length) d.plan.slots[k] = left;
    else delete d.plan.slots[k];
  }
  return d;
}

/** Ciklus: danas je dan `ix` (0–4) ciklusa */
export function setCycleToday(src: AppData, ix: number, now = Date.now()): AppData {
  const d = clone(src);
  const t = new Date(now);
  t.setDate(t.getDate() - ix);
  d.plan.anchor = todayKey(t.getTime());
  return d;
}

/** Dodaj obrok na dan: recept (porcije) ili namirnicu */
export function addSlot(src: AppData, k: string, x: Omit<Slot, "id" | "done">): AppData {
  const d = clone(src);
  d.plan.slots[k] = [...daySlots(d.plan, k), { id: slotId(), ...x, done: false }];
  return d;
}

/** Zamijeni sadržaj obroka (kvačica se miče) ili promijeni porcije */
export function setSlot(src: AppData, k: string, id: string, x: Partial<Omit<Slot, "id">>): AppData {
  const d = clone(src);
  d.plan.slots[k] = daySlots(d.plan, k).map((y) => {
    if (y.id !== id) return y;
    const swap = "r" in x || "item" in x;
    const n: Slot = swap ? { id, done: false, ...x } : { ...y, ...x };
    if (n.s === 1) delete n.s;
    return n;
  });
  return d;
}

/** Makni obrok s dana */
export function removeSlot(src: AppData, k: string, id: string): AppData {
  const d = clone(src);
  const list = daySlots(d.plan, k).filter((y) => y.id !== id);
  if (list.length) d.plan.slots[k] = list;
  else delete d.plan.slots[k];
  return d;
}

/** Pomakni obrok gore ili dolje unutar dana */
export function moveSlot(src: AppData, k: string, id: string, dir: -1 | 1): AppData {
  const d = clone(src);
  const list = daySlots(d.plan, k);
  const i = list.findIndex((y) => y.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return src;
  [list[i], list[j]] = [list[j], list[i]];
  d.plan.slots[k] = list;
  return d;
}

/** Naziv sadržaja obroka */
export function slotLabel(d: AppData, s: Pick<Slot, "r" | "item">): string {
  if (s.item) return itemOf(d, s.item)?.n ?? "Obrisana namirnica";
  if (s.r) return recipeOf(d, s.r)?.n ?? "Obrisani recept";
  return "";
}

/** Pojedi obrok: skida sastojke ili namirnicu sa zalihe. Ponovni klik samo vraća kvačicu. */
export function toggleSlot(src: AppData, k: string, id: string, now = Date.now()): Result {
  const d = clone(src);
  const s = daySlots(d.plan, k).find((y) => y.id === id);
  if (!s || (!s.r && !s.item)) return { data: src, msg: "" };
  if (s.done) {
    s.done = false;
    return { data: d, msg: `${slotLabel(src, s)}: kvačica maknuta, sastojci se ne vraćaju.` };
  }
  const eff = slotUse(src, s, { ...d.prepStock });
  consume(d, eff.use, eff.consumed);
  s.done = true;
  if (s.r) d.hist = [{ r: s.r, t: now }, ...d.hist].slice(0, 30);
  return { data: d, msg: `${slotLabel(src, s)}: skinuto sa zalihe.` };
}

/** Voće koje imaš na zalihi, za popunjavanje slotova */
function fruitPool(d: AppData): Item[] {
  return allItems(d).filter((i) => i.grp === "voce" && !d.items.hidden.includes(i.id) && qty(d, i.id) > 0);
}
export const defaultFruitQty = (i: Item) => (i.u === "g" || i.u === "ml" ? 150 : 1);

/** Dodaj vlastitu namirnicu, po želji s početnom količinom */
export function addItem(src: AppData, item: Item, startQty = 0): Result {
  const d = clone(src);
  d.items.custom.push(item);
  if (startQty > 0) setQty(d, item.id, startQty);
  return { data: d, msg: `${item.n} dodana u zalihu.` };
}

/** Promijeni namirnicu: vlastitu u cijelosti (osim jedinice), ugrađenoj samo pakiranje i minimum */
const ITEM_FIELDS = [
  "n",
  "cat",
  "grp",
  "src",
  "min",
  "pack",
  "kcal",
  "prot",
  "carb",
  "fat",
  "brand",
  "ean",
  "alias",
] as const;
type ItemField = (typeof ITEM_FIELDS)[number];
const OPTIONAL = ["om", "kcal", "prot", "carb", "fat", "brand", "ean", "alias"] as const;

export function editItem(src: AppData, id: string, patch: Partial<Pick<Item, ItemField | "om">>): AppData {
  const d = clone(src);
  if (isCustom(id)) {
    d.items.custom = d.items.custom.map((i) => {
      if (i.id !== id) return i;
      const n: Item = { ...i, ...patch };
      for (const k of OPTIONAL) if (k in patch && patch[k] === undefined) delete n[k];
      return { ...n, step: patch.pack != null ? defaultStep(n.u, n.pack) : n.step };
    });
  } else {
    const o = { ...(d.items.over[id] || {}) };
    for (const k of ITEM_FIELDS) {
      if (!(k in patch)) continue;
      const v = patch[k];
      if (v === undefined) delete o[k];
      else (o as Record<string, unknown>)[k] = v;
    }
    d.items.over[id] = o;
  }
  return d;
}

/** Obriši vlastitu namirnicu i njezinu zalihu */
export function removeItem(src: AppData, id: string): Result {
  const d = clone(src);
  const i = itemOf(src, id);
  d.items.custom = d.items.custom.filter((x) => x.id !== id);
  delete d.stock[id];
  return { data: d, msg: `${i?.n ?? "Namirnica"} obrisana.` };
}

export function setHidden(src: AppData, id: string, hidden: boolean): Result {
  const d = clone(src);
  d.items.hidden = hidden ? [...new Set([...d.items.hidden, id])] : d.items.hidden.filter((x) => x !== id);
  const n = itemOf(src, id)?.n ?? "Namirnica";
  return { data: d, msg: hidden ? `${n} je skrivena. Vratiti je možeš na dnu Zalihe.` : `${n} je vraćena u zalihu.` };
}

/** Spremi vlastiti recept (novi ili izmjena postojećeg) */
export function saveRecipe(src: AppData, r: CustomRecipe): Result {
  const d = clone(src);
  const i = d.recipes.findIndex((x) => x.id === r.id);
  if (i >= 0) d.recipes[i] = r;
  else d.recipes.push(r);
  return { data: d, msg: i >= 0 ? `${r.n} je spremljen.` : `${r.n} je dodan u recepte.` };
}

/** Obriši vlastiti recept; makni ga i iz plana i iz složenih recepata.
 * Za uređeni ugrađeni recept samo vrati original. */
export function removeRecipe(src: AppData, id: string): Result {
  const d = clone(src);
  const r = d.recipes.find((x) => x.id === id);
  d.recipes = d.recipes.filter((x) => x.id !== id);
  if (isBuiltinRecipe(id)) return { data: d, msg: `${r?.n ?? "Recept"} je vraćen na original.` };
  d.recipes = d.recipes.map((x) => {
    if (!x.parts?.[id]) return x;
    const parts = { ...x.parts };
    delete parts[id];
    return { ...x, parts };
  });
  for (const [k, list] of Object.entries(d.plan.slots)) {
    const left = list.filter((x) => x.r !== id || x.done);
    if (left.length) d.plan.slots[k] = left;
    else delete d.plan.slots[k];
  }
  return { data: d, msg: `${r?.n ?? "Recept"} je obrisan.` };
}

/** Namirnice od nule: sve ugrađene namirnice skrivene, prazna zaliha; recepti i plan ostaju */
export function cleanStart(src: AppData): Result {
  return { data: cleanState(src), msg: "Namirnice kreću od nule. Recepti i plan su ostali." };
}

/** Uključi ili isključi ugrađene recepte, omlete i prep */
export function setBuiltin(src: AppData, on: boolean): Result {
  const d = clone(src);
  d.settings.builtin = on;
  return {
    data: d,
    msg: on ? "Ugrađeni recepti, omleti i prep su vraćeni." : "Ugrađeni recepti, omleti i prep su skriveni.",
  };
}

/** Kreni od nule: sakrij sve ugrađene namirnice, obriši vlastite, sve količine, cijene i pripremljeno.
 * Recepti, plan, omleti i troškovi ostaju. */
export function resetItems(src: AppData): Result {
  const d = clone(src);
  d.items = { v: 2, custom: [], hidden: ITEMS.map((i) => i.id), over: {} };
  d.stock = {};
  d.prepStock = {};
  return { data: d, msg: "Zaliha je prazna. Kreni s dodavanjem." };
}

/** Vrati ugrađenu namirnicu iz kataloga i odmah upiši količinu */
export function restoreItem(src: AppData, id: string, startQty = 0): Result {
  const r = setHidden(src, id, false);
  if (startQty > 0) setQty(r.data, id, startQty);
  return r;
}

/**
 * Kupljeno s popisa: točna količina ide u zalihu (skrivena namirnica se vraća),
 * a trošak se bilježi po upisanoj cijeni ili procjeni iz cijene pakiranja.
 * Upisana cijena se pamti kao nova cijena pakiranja. Ukupni iznos s računa kasnije zamjenjuje ove zapise.
 */
export function purchase(src: AppData, id: string, amount: number, paid: number | null, now = Date.now()): Result {
  const d = clone(src);
  const i = itemOf(d, id);
  if (!i || !(amount > 0)) return { data: src, msg: "Upiši količinu veću od 0." };
  d.items.hidden = d.items.hidden.filter((x) => x !== id);
  const known = price(d, id);
  setQty(d, id, qty(d, id) + amount);
  if (paid != null && paid >= 0) d.stock[id].price = round((paid / amount) * i.pack);
  const cost = paid != null ? paid : known != null ? (known / i.pack) * amount : null;
  // i bez cijene se zapisuje (0 €), da se kupnja može poništiti s popisa
  const mk = monthKey(now);
  d.costs[mk] = [
    ...(d.costs[mk] || []),
    { id: newId(), t: now, shop: i.src, amount: round(cost ?? 0), note: i.n, est: true, item: id, qty: round(amount) },
  ];
  return { data: d, msg: `${i.n}: +${fmt(amount, i.u)} u zalihi${cost != null ? `, ${eur(cost)}` : ""}.` };
}

/** Vrati kupnju s popisa: makni količinu iz zalihe i obriši zapis troška */
export function undoPurchase(src: AppData, mk: string, entryId: string): Result {
  const d = clone(src);
  const e = (d.costs[mk] || []).find((x) => x.id === entryId);
  if (!e) return { data: src, msg: "" };
  if (e.item && e.qty) setQty(d, e.item, qty(d, e.item) - e.qty);
  d.costs[mk] = d.costs[mk].filter((x) => x.id !== entryId);
  return { data: d, msg: `${e.note} je vraćen na popis.` };
}

/** Promijeni zapis troška (iznos, dućan, opis) */
export function editCost(
  src: AppData,
  mk: string,
  id: string,
  patch: Partial<Pick<CostEntry, "amount" | "shop" | "note">>,
): AppData {
  const d = clone(src);
  d.costs[mk] = (d.costs[mk] || []).map((e) => (e.id === id ? { ...e, ...patch } : e));
  return d;
}

/* Čiste funkcije koje iz stanja rade novo stanje. Poništavanje = povratak prethodnog stanja. */
import { CYCLE, ITEMS } from "../data";
import { prepInv, prepOf } from "./preps";
import type { CustomRecipe, Item, OmSel } from "../data";
import { allRecipes, recipeOf } from "./recipes";
import type { AppData, CostEntry, Slot, SlotKey } from "../state/model";
import { SLOT_KEYS, cleanState, clone, cycleIx, getOm, getSlot } from "../state/model";
import { todayKey, windowKeys } from "./dates";
import { effUse, missingFor, pc, price, qty, slotUse } from "./inventory";
import { omEff, omMissing, omName, omPresets, shuffle } from "./omlet";
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

/** Skuhaj recept: skida sastojke × f (osnova 1,5 porcija), dnevne dodatke i prvo troši pripremljeno */
export function cook(src: AppData, rid: string, day: string | null, f = 1, now = Date.now()): Result {
  const d = clone(src);
  const r = recipeOf(src, rid);
  if (!r) return { data: src, msg: "Recept ne postoji." };
  const eff = effUse(r, { ...d.prepStock }, true, f, src);
  consume(d, eff.use, eff.consumed);
  // bez dana: prvi neskuhani dan s tim receptom u prozoru plana
  const k = day ?? windowKeys(now).find((x) => d.plan.days[x]?.r === rid && !d.plan.days[x]?.done);
  if (k) d.plan.days[k] = { r: rid, done: true };
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
  for (const [id, a] of Object.entries(p.use)) setQty(d, id, qty(d, id) - a * t);
  d.prepStock[pid] = round(pc(d, pid) + inv.make * t);
  return { data: d, msg: `${p.n}: +${pfmt(inv.make * t, inv.unit)} u pripremljenom.` };
}

/** Pojedi doručak: omlet ili recept (1 porcija) */
export function eatOmlet(src: AppData, ix: string, f = 1): Result {
  const d = clone(src);
  const day = getOm(d.plan, ix);
  if (day.r) {
    const r = recipeOf(src, day.r);
    if (!r) return { data: src, msg: "Recept ne postoji." };
    const eff = slotUse(src, { r: day.r, done: false }, { ...d.prepStock });
    consume(d, eff.use, eff.consumed);
    d.plan.om[ix] = { sel: null, r: day.r, done: true };
    return { data: d, msg: `${r.n}: sastojci skinuti sa zalihe.` };
  }
  if (!day.sel) return { data: src, msg: "Za taj dan nema doručka." };
  const eff = omEff(src, day.sel, f, { ...d.prepStock });
  consume(d, eff.use, eff.consumed);
  d.plan.om[ix] = { sel: day.sel, done: true };
  return { data: d, msg: `${omName(src, day.sel)}: sastojci skinuti sa zalihe.` };
}

export function eatMuffins(src: AppData, ix: string): Result {
  const d = clone(src);
  d.prepStock["egg-muffini"] = Math.max(0, pc(d, "egg-muffini") - 4);
  d.plan.om[ix] = { ...getOm(d.plan, ix), done: true };
  return { data: d, msg: "4 egg muffina pojedena." };
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

/** Popuni prazne dane od danas do kraja prozora: ručak po ciklusu (prednost recepti za koje ima sastojaka),
 * doručak omletom, juha i salata, voće koje imaš doma. Ručno odabrano ostaje. */
export function autoFillPlan(src: AppData, now = Date.now(), rng: () => number = Math.random): AppData {
  const d = clone(src);
  const keys = windowKeys(now).filter((k) => k >= todayKey(now));
  const used: Record<string, number> = {};
  for (const k of windowKeys(now)) {
    const r = d.plan.days[k]?.r;
    if (r) used[r] = (used[r] || 0) + 1;
  }
  const builtin = d.settings.builtin !== false;
  const oms = omPool(d, rng);
  let oi = 0;
  const fruits = fruitPool(d);
  let fi = 0;
  const empty = (s?: Slot) => !s || (!s.r && !s.item && !s.done);
  for (const k of keys) {
    const day = d.plan.days[k];
    if (!day?.r && !day?.done) {
      const c = CYCLE[cycleIx(d.plan, k)];
      const pool = allRecipes(d).filter((r) => r.c === c && !r.side);
      pool.sort(
        (a, b) => (used[a.id] || 0) - (used[b.id] || 0) || missingFor(d, a.id).length - missingFor(d, b.id).length,
      );
      if (pool[0]) {
        used[pool[0].id] = (used[pool[0].id] || 0) + 1;
        d.plan.days[k] = { r: pool[0].id, done: false };
      }
    }
    const o = d.plan.om[k];
    if (oms.length && (!o || (!o.sel && !o.r && !o.done)))
      d.plan.om[k] = { sel: clone(oms[oi++ % oms.length]), done: false };
    if (builtin && empty(d.plan.extra.juha[k])) d.plan.extra.juha[k] = { r: "dod-miso", done: false };
    if (builtin && empty(d.plan.extra.salata[k])) d.plan.extra.salata[k] = { r: "dod-salata", done: false };
    if (fruits.length)
      for (const s of ["voce1", "voce2"] as SlotKey[])
        if (empty(d.plan.extra[s][k])) {
          const i = fruits[fi++ % fruits.length];
          d.plan.extra[s][k] = { item: i.id, qty: defaultFruitQty(i), done: false };
        }
  }
  return d;
}

/** Omleti za popunjavanje: svaki drugi, prednost oni za koje imaš sastojke */
function omPool(d: AppData, rng: () => number): OmSel[] {
  return shuffle(omPresets(d), rng)
    .map((p) => ({ p, miss: omMissing(d, p.sel).length }))
    .sort((a, b) => a.miss - b.miss)
    .map((x) => x.p.sel);
}

/** Očisti plan od danas nadalje (ono što je pojedeno ili skuhano ostaje) */
export function clearAhead(src: AppData, now = Date.now()): AppData {
  const d = clone(src);
  for (const k of windowKeys(now).filter((x) => x >= todayKey(now))) {
    if (!d.plan.days[k]?.done) delete d.plan.days[k];
    if (!d.plan.om[k]?.done) delete d.plan.om[k];
    for (const s of SLOT_KEYS) if (!d.plan.extra[s][k]?.done) delete d.plan.extra[s][k];
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

/** Stavi recept na dan (ili makni s r = "") */
export function setPlanDay(src: AppData, ix: string, r: string): AppData {
  const d = clone(src);
  d.plan.days[ix] = { r, done: false };
  return d;
}

/** Stavi omlet na dan (ili makni sa sel = null) */
export function setOmDay(src: AppData, ix: string, sel: OmSel | null): AppData {
  const d = clone(src);
  d.plan.om[ix] = { sel: sel ? clone(sel) : null, done: false };
  return d;
}

/** Doručak je recept (1 porcija) */
export function setBreakfastRecipe(src: AppData, ix: string, r: string): AppData {
  const d = clone(src);
  d.plan.om[ix] = r ? { sel: null, r, done: false } : { sel: null, done: false };
  return d;
}

const SLOT_NAME: Record<SlotKey, string> = { juha: "Juha", salata: "Salata", voce1: "Voće", voce2: "Voće" };

/** Postavi slot (juha, salata, voće) ili ga isprazni */
export function setSlot(src: AppData, k: SlotKey, ix: string, slot: Omit<Slot, "done"> | null): AppData {
  const d = clone(src);
  d.plan.extra[k][ix] = slot ? { ...slot, done: false } : { done: false };
  return d;
}

/** Naziv sadržaja slota */
export function slotLabel(d: AppData, s: Slot): string {
  if (s.item) return itemOf(d, s.item)?.n ?? "Obrisana namirnica";
  if (s.r) return recipeOf(d, s.r)?.n ?? "Obrisani recept";
  return "";
}

/** Pojedi slot: skida sastojke ili namirnicu sa zalihe. Ponovni klik samo vraća kvačicu. */
export function toggleSlot(src: AppData, k: SlotKey, ix: string): Result {
  const d = clone(src);
  const s = getSlot(d.plan, k, ix);
  if (!s.r && !s.item) return { data: src, msg: "" };
  if (s.done) {
    d.plan.extra[k][ix] = { ...s, done: false };
    return { data: d, msg: `${SLOT_NAME[k]}: kvačica maknuta, sastojci se ne vraćaju.` };
  }
  const eff = slotUse(src, s, { ...d.prepStock });
  consume(d, eff.use, eff.consumed);
  d.plan.extra[k][ix] = { ...s, done: true };
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
export function editItem(
  src: AppData,
  id: string,
  patch: Partial<Pick<Item, "n" | "cat" | "grp" | "src" | "pack" | "min" | "om" | "kcal" | "prot">>,
): AppData {
  const d = clone(src);
  if (isCustom(id)) {
    d.items.custom = d.items.custom.map((i) => {
      if (i.id !== id) return i;
      const n: Item = { ...i, ...patch };
      for (const k of ["om", "kcal", "prot"] as const) if (k in patch && patch[k] === undefined) delete n[k];
      return { ...n, step: patch.pack != null ? defaultStep(n.u, n.pack) : n.step };
    });
  } else {
    const o = { ...(d.items.over[id] || {}) };
    for (const k of ["n", "cat", "grp", "src", "min", "pack", "kcal", "prot"] as const) {
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

/** Obriši vlastiti recept; makni ga i iz plana */
export function removeRecipe(src: AppData, id: string): Result {
  const d = clone(src);
  const r = d.recipes.find((x) => x.id === id);
  d.recipes = d.recipes.filter((x) => x.id !== id);
  for (const [k, x] of Object.entries(d.plan.days)) if (x.r === id && !x.done) delete d.plan.days[k];
  for (const [k, x] of Object.entries(d.plan.om)) if (x.r === id && !x.done) delete d.plan.om[k];
  for (const s of SLOT_KEYS)
    for (const [k, x] of Object.entries(d.plan.extra[s])) if (x.r === id && !x.done) delete d.plan.extra[s][k];
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

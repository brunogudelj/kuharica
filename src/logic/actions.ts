/* Čiste funkcije koje iz stanja rade novo stanje. Poništavanje = povratak prethodnog stanja. */
import { BY, CYCLE, PBY, PREP_INV, RBY, RECIPES } from "../data";
import type { AppData, CostEntry } from "../state/model";
import { clone, emptyPlanDays } from "../state/model";
import { effUse, missingFor, pc, price, qty } from "./inventory";
import { autoOmWeek, omEff, omName } from "./omlet";
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
export function cook(src: AppData, rid: string, dayIx: number | null, f = 1, now = Date.now()): Result {
  const d = clone(src);
  const eff = effUse(rid, { ...d.prepStock }, true, f);
  consume(d, eff.use, eff.consumed);
  let ix = dayIx;
  if (ix == null) ix = d.plan.days.findIndex((x) => x.r === rid && !x.done);
  if (ix != null && ix >= 0) d.plan.days[ix] = { r: rid, done: true };
  d.hist = [{ r: rid, t: now }, ...d.hist].slice(0, 30);
  const np = eff.consumed.length;
  return { data: d, msg: `${RBY[rid].n}: skinuto sa zalihe${np ? `, iskorišteno ${np} iz prepa` : ""}.` };
}

/** Napravi prep: skida sirove sastojke × t i dodaje make × t jedinica u pripremljeno */
export function makePrep(src: AppData, pid: string, t = 1): Result {
  const d = clone(src);
  const p = PBY[pid];
  const inv = PREP_INV[pid];
  for (const [id, a] of Object.entries(p.use)) setQty(d, id, qty(d, id) - a * t);
  d.prepStock[pid] = round(pc(d, pid) + inv.make * t);
  return { data: d, msg: `${p.n}: +${pfmt(inv.make * t, inv.unit)} u pripremljenom.` };
}

export function eatOmlet(src: AppData, ix: number, f = 1): Result {
  const d = clone(src);
  const day = d.plan.om[ix];
  const eff = omEff(day.sel, f, { ...d.prepStock });
  consume(d, eff.use, eff.consumed);
  d.plan.om[ix] = { sel: day.sel, done: true };
  return { data: d, msg: `${omName(day.sel)}: sastojci skinuti sa zalihe.` };
}

export function eatMuffins(src: AppData, ix: number): Result {
  const d = clone(src);
  d.prepStock["egg-muffini"] = Math.max(0, pc(d, "egg-muffini") - 4);
  d.plan.om[ix] = { sel: d.plan.om[ix].sel, done: true };
  return { data: d, msg: "4 egg muffina pojedena." };
}

/** Kupio: povećaj zalihu i zabilježi procjenu troška ako je cijena poznata */
export function buy(src: AppData, id: string, packs = 1, now = Date.now()): Result {
  const d = clone(src);
  const i = BY[id];
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

/** Popuni tjedan prema ciklusu, ravnomjerno, prednost imaju recepti za koje ima sastojaka */
export function autoFillPlan(src: AppData): AppData {
  const d = clone(src);
  const used: Record<string, number> = {};
  d.plan.days = d.plan.days.map((day, ix) => {
    if (day.done) return day;
    const c = CYCLE[((d.plan.start || 0) + ix) % 5];
    const pool = RECIPES.filter((r) => r.c === c);
    pool.sort(
      (a, b) => (used[a.id] || 0) - (used[b.id] || 0) || missingFor(d, a.id).length - missingFor(d, b.id).length,
    );
    const pick = pool[0];
    used[pick.id] = (used[pick.id] || 0) + 1;
    return { r: pick.id, done: false };
  });
  return d;
}

/** Novi tjedan: ciklus se pomiče za 7 dana, plan se prazni, slažu se novi omleti */
export function newWeek(src: AppData, rng: () => number = Math.random): AppData {
  const d = clone(src);
  d.plan = { start: ((d.plan.start || 0) + 7) % 5, days: emptyPlanDays(), om: d.plan.om.map((o) => ({ ...o, done: false })) };
  d.plan.om = autoOmWeek(d, false, rng);
  return d;
}

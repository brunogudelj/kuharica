import type { AppData } from "../state/model";
import { dayCost, portionCost } from "./inventory";
import { daySlots } from "../state/model";
import { allRecipes } from "./recipes";
import { monthKey } from "./format";
import { windowKeys } from "./dates";

/** Sažetak troškova za karticu Troškovi */
export function costSummary(d: AppData, now = Date.now()) {
  const mk = monthKey(now);
  const dt = new Date(now);
  const daysIn = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const dom = dt.getDate();
  const entries = d.costs[mk] || [];
  const spent = entries.reduce((s, e) => s + (e.amount || 0), 0);

  // Procjena iz plana: prosjek planiranih dana; ako plan nije složen, 4 porcije prosječnog recepta na dan
  const days = windowKeys(now)
    .filter((k) => daySlots(d.plan, k).length)
    .map((k) => dayCost(d, k));
  const pcs = allRecipes(d)
    .filter((r) => !r.side)
    .map((r) => portionCost(d, r.id));
  const avgMeal = pcs.length ? pcs.reduce((s, x) => s + x.c, 0) / pcs.length : 0;
  const avgFull = days.length ? days.reduce((s, x) => s + x.c, 0) / days.length : avgMeal * 4;
  const src = days.length ? days : pcs;
  const cover =
    src.reduce((s, x) => s + x.known, 0) /
    Math.max(
      1,
      src.reduce((s, x) => s + x.total, 0),
    );
  const planMonth = avgFull * daysIn;
  const pace = spent > 0 && dom >= 7 ? (spent / dom) * daysIn : null;
  const dost = d.settings.dostava || 0;
  const saveMonth = (2 * dost - 2 * avgMeal) * daysIn;

  const byShop: Record<string, number> = {};
  entries.forEach((e) => {
    byShop[e.shop] = (byShop[e.shop] || 0) + (e.amount || 0);
  });

  return {
    mk,
    daysIn,
    dom,
    entries,
    spent,
    avgMeal,
    cover,
    planMonth,
    pace,
    dost,
    saveMonth,
    byShop,
    priced: cover > 0,
  };
}

const DAY = 86400000;

/**
 * Potrošnja po dućanu: ukupno dosad i tjedni prosjek zadnjih 6 mjeseci (26 tjedana, klizno).
 * Ako zapisi postoje kraće od 6 mjeseci, prosjek se dijeli s brojem tjedana od prvog zapisa.
 */
export function shopSpend(d: AppData, now = Date.now()) {
  const all = Object.values(d.costs).flat();
  const from = now - 182 * DAY;
  const first = all.length ? Math.min(...all.map((e) => e.t)) : now;
  const weeks = Math.max(1, (now - Math.max(from, first)) / (7 * DAY));
  const out: Record<string, { total: number; last6: number; weekly: number }> = {};
  for (const e of all) {
    const o = (out[e.shop] ||= { total: 0, last6: 0, weekly: 0 });
    o.total += e.amount || 0;
    if (e.t >= from && e.t <= now) o.last6 += e.amount || 0;
  }
  for (const o of Object.values(out)) o.weekly = o.last6 / weeks;
  return { byShop: out, weeks };
}

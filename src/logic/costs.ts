import type { AppData } from "../state/model";
import { dayCost } from "./inventory";
import { allRecipes, recipeOf } from "./recipes";
import { monthKey } from "./format";

/** Sažetak troškova za karticu Troškovi */
export function costSummary(d: AppData, now = Date.now()) {
  const mk = monthKey(now);
  const dt = new Date(now);
  const daysIn = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const dom = dt.getDate();
  const entries = d.costs[mk] || [];
  const spent = entries.reduce((s, e) => s + (e.amount || 0), 0);

  // Procjena iz plana: prosjek planiranih dana (ili svih recepata ako plan nije složen)
  const planned = d.plan.days.filter((x) => x.r && recipeOf(d, x.r)).map((x) => x.r);
  const pool = planned.length ? planned : allRecipes(d).map((r) => r.id);
  const dcs = pool.map((r) => dayCost(d, r));
  const avgFull = dcs.reduce((s, x) => s + x.full, 0) / dcs.length;
  const avgMeal = dcs.reduce((s, x) => s + x.perMeal, 0) / dcs.length;
  const cover =
    dcs.reduce((s, x) => s + x.known, 0) /
    Math.max(
      1,
      dcs.reduce((s, x) => s + x.total, 0),
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

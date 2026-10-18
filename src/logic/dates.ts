/* Datumi plana: ključevi YYYY-MM-DD po lokalnom vremenu, rolling prozor od jučer + 13 dana */
import { DAYS } from "../data";

export const PLAN_DAYS = 14;
const pad = (n: number) => String(n).padStart(2, "0");

export const dkey = (t: number | Date = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return dkey(d);
};
export const diffDays = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000);
export const todayKey = (now = Date.now()) => dkey(now);
/** Prozor plana: jučer, danas i sljedećih 12 dana */
export const windowKeys = (now = Date.now(), n = PLAN_DAYS) =>
  Array.from({ length: n }, (_, i) => addDays(dkey(now), i - 1));
/** Dani od danas za popis za kupovinu */
export const aheadKeys = (now = Date.now(), n = 7) => Array.from({ length: n }, (_, i) => addDays(dkey(now), i));
export const dayName = (k: string) => DAYS[(fromKey(k).getDay() + 6) % 7];
export const dayDate = (k: string) => fromKey(k).toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" });
/** "danas", "jučer", "sutra" ili "pon 20. 10." */
export function dayLabel(k: string, now = Date.now()) {
  const t = todayKey(now);
  if (k === t) return "danas";
  if (k === addDays(t, -1)) return "jučer";
  if (k === addDays(t, 1)) return "sutra";
  return `${dayName(k).toLowerCase()} ${dayDate(k)}`;
}

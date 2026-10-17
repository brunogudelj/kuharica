import { UNITS } from "../data";
import type { Unit, UnitId } from "../data";

export const round = (n: number) => Math.round(n * 100) / 100;

/** Količina s jedinicom, u kg i l iznad 1000 */
export function fmt(n: number, u: Unit): string {
  n = round(n);
  if (u === "g" && n >= 1000) return round(n / 1000).toLocaleString("hr-HR") + " kg";
  if (u === "ml" && n >= 1000) return round(n / 1000).toLocaleString("hr-HR") + " l";
  return n.toLocaleString("hr-HR") + " " + u;
}

export const eur = (n: number) =>
  n.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Hrvatska množina: 1 vrećica, 2–4 vrećice, 5+ vrećica (11–14 uvijek treći oblik) */
export function plural(n: number, u: UnitId): string {
  const f = UNITS[u];
  const a = Math.abs(Math.round(n));
  if (a % 10 === 1 && a % 100 !== 11) return f[0];
  if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14)) return f[1];
  return f[2];
}

export const pfmt = (n: number, u: UnitId) => `${round(n).toLocaleString("hr-HR")} ${plural(n, u)}`;

export const porcTxt = (n: number) =>
  `${n.toLocaleString("hr-HR")} ${n === 1 ? "porcija" : Number.isInteger(n) && n >= 2 && n <= 4 ? "porcije" : "porcija"}`;

/** Lijepo zaokruživanje: g i ml iznad 20 na 5, komadi kao razlomci */
export function niceNum(v: number, unit?: string): string {
  if (unit === "g" || unit === "ml") {
    if (v >= 20) return String(Math.round(v / 5) * 5);
    return (Math.round(v * 10) / 10).toLocaleString("hr-HR");
  }
  const whole = Math.floor(v + 1e-9);
  const fr = v - whole;
  const fracs: [number, string][] = [
    [0, ""],
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.5, "½"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
    [1, ""],
  ];
  let best = fracs[0];
  let d = 9;
  for (const f of fracs) {
    const dd = Math.abs(fr - f[0]);
    if (dd < d) {
      d = dd;
      best = f;
    }
  }
  if (d < 0.06) {
    const w = whole + (best[0] === 1 ? 1 : 0);
    return (w ? String(w) : "") + best[1] || "0";
  }
  return (Math.round(v * 10) / 10).toLocaleString("hr-HR");
}

const SKIP_UNITS = ["%", "°C", "min", "cm", "mm"];

/** Skalira brojeve u tekstu sastojka. Brojevi iza "po " (veličina porcije) i s jedinicama %, °C, min, cm, mm ostaju isti. */
export function scaleText(html: string, f: number): string {
  if (Math.abs(f - 1) < 1e-9) return html;
  return html
    .split(/(<[^>]+>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(
            /(\d+(?:,\d+)?|½|¼|¾)(\s*)(kg|g|ml|l|%|°C|min|cm|mm)?(?![\wčćžšđ])/g,
            (m: string, num: string, sp: string, unit: string | undefined, off: number, str: string) => {
              if (unit && SKIP_UNITS.includes(unit)) return m;
              if (str.slice(Math.max(0, off - 3), off) === "po ") return m;
              const v = num === "½" ? 0.5 : num === "¼" ? 0.25 : num === "¾" ? 0.75 : parseFloat(num.replace(",", "."));
              return niceNum(v * f, unit) + sp + (unit || "");
            },
          ),
    )
    .join("");
}

export const monthKey = (t = Date.now()) => {
  const d = new Date(t);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};
export const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
export const todayIx = (t = Date.now()) => (new Date(t).getDay() + 6) % 7;
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

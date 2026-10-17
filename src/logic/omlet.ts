import { BY, DEFAULT_OM, MAC, OFBY, OM_BASE, OM_CARB, OM_PRESETS, OM_PROT, OM_VEG, PREP_INV } from "../data";
import type { OmSel, Use } from "../data";
import type { AppData, OmDay } from "../state/model";
import { clone, defaultOmWeek } from "../state/model";
import { qty } from "./inventory";

export function validOm(v: unknown): OmSel {
  const s = v as Partial<OmSel> | null | undefined;
  if (!s || !s.base || !OM_BASE[s.base] || !s.carb || !OM_CARB[s.carb] || !Array.isArray(s.fill)) return clone(DEFAULT_OM);
  return { base: s.base, fill: s.fill.filter((x) => typeof x === "string" && OFBY[x]), carb: s.carb };
}

export const omNorm = (s: OmSel) => JSON.stringify([s.base, s.fill.slice().sort(), s.carb]);

export function omUse(sel: OmSel, f: number): Use {
  const use: Use = {};
  const add = (o: Use) => {
    for (const [id, a] of Object.entries(o)) use[id] = (use[id] || 0) + a * f;
  };
  add(OM_BASE[sel.base].use);
  sel.fill.forEach((x) => {
    if (OFBY[x]) add(OFBY[x].use);
  });
  add(OM_CARB[sel.carb].use);
  return use;
}

/** Stvarna potrošnja omleta: prilog iz prepa (pola kutije riže ili krumpira) troši se prvo */
export function omEff(sel: OmSel, f: number, pcopy: Record<string, number>) {
  const use = omUse(sel, f);
  const consumed: [string, number][] = [];
  const C = OM_CARB[sel.carb];
  if (C.prep) {
    const [pid, n] = C.prep;
    const k = Math.min(n * f, pcopy[pid] || 0);
    if (k > 0) {
      pcopy[pid] -= k;
      consumed.push([pid, k]);
      for (const [id, a] of Object.entries(PREP_INV[pid].per)) if (use[id] != null) use[id] = Math.max(0, use[id] - a * k);
    }
  }
  for (const id of Object.keys(use)) if (use[id] < 0.001) delete use[id];
  return { use, consumed };
}

export function omMacros(sel: OmSel, f: number) {
  let k = 10 * f; // ulje u spreju
  let p = 0;
  for (const [id, a] of Object.entries(omUse(sel, f))) {
    const m = MAC[id];
    if (m) {
      k += m[0] * a;
      p += m[1] * a;
    }
  }
  return { k: Math.round(k), p: Math.round(p) };
}

export function omName(sel: OmSel): string {
  const p = OM_PRESETS.find((x) => omNorm(x.sel) === omNorm(sel));
  if (p) return p.n;
  const f = sel.fill.map((x) => OFBY[x].n.toLowerCase());
  if (!f.length) return OM_BASE[sel.base].n + " omlet";
  const t = f.length > 1 ? f.slice(0, -1).join(", ") + " i " + f[f.length - 1] : f[0];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function omMissing(data: AppData, sel: OmSel, f = 1): string[] {
  return Object.entries(omEff(sel, f, { ...data.prepStock }).use)
    .filter(([id, a]) => qty(data, id) + 1e-9 < a)
    .map(([id]) => BY[id].n);
}

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Popuni nepojedene dane različitim kombinacijama; prednost imaju one za koje imaš sastojke */
export function autoOmWeek(data: AppData, keepDone: boolean, rng: () => number = Math.random): OmDay[] {
  const cur = data.plan.om && data.plan.om.length === 7 ? data.plan.om : defaultOmWeek();
  const used = new Set(keepDone ? cur.filter((o) => o.done).map((o) => omNorm(o.sel)) : []);
  const pool = shuffle(OM_PRESETS, rng)
    .filter((p) => !used.has(omNorm(p.sel)))
    .map((p) => ({ p, miss: omMissing(data, p.sel).length }))
    .sort((a, b) => a.miss - b.miss);
  let k = 0;
  return cur.map((o) => {
    if (keepDone && o.done) return o;
    const pick = pool.length ? pool[k++ % pool.length].p : OM_PRESETS[0];
    return { sel: clone(pick.sel), done: false };
  });
}

/** Nasumičan omlet: 1 protein i 2 povrća, prednost ima ono što je na zalihi */
export function surpriseSel(data: AppData, rng: () => number = Math.random): OmSel {
  const ok = (id: string) => (Object.entries(OFBY[id].use).every(([k, a]) => qty(data, k) + 1e-9 >= a) ? 1 : 0);
  const pick = (arr: string[], n: number) =>
    shuffle(arr, rng)
      .sort((a, b) => ok(b) - ok(a))
      .slice(0, n);
  const r = rng();
  return {
    base: r < 0.6 ? "protein" : r < 0.8 ? "lagani" : "klasik",
    fill: pick(OM_PROT, 1).concat(pick(OM_VEG, 2)),
    carb: "nista",
  };
}

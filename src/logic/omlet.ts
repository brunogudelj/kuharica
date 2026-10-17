import { isMass } from "./lists";
import { DEFAULT_OM, MAC, OFBY, OM_BASE, OM_CARB, OM_PRESETS, OM_PROT, OM_VEG, PREP_INV } from "../data";
import type { OmFill, OmSel, Use } from "../data";
import type { AppData, ItemsState, OmDay } from "../state/model";
import { clone, defaultOmWeek } from "../state/model";
import { qty } from "./inventory";
import { allItems, itemName, itemOf } from "./items";

/** Odabir omleta iz spremišta. Vlastiti nadjevi (c-…) se zadržavaju i kad se ne mogu odmah provjeriti. */
export function validOm(v: unknown): OmSel {
  const s = v as Partial<OmSel> | null | undefined;
  if (!s || !s.base || !OM_BASE[s.base] || !s.carb || !OM_CARB[s.carb] || !Array.isArray(s.fill))
    return clone(DEFAULT_OM);
  return {
    base: s.base,
    fill: s.fill.filter((x) => typeof x === "string" && (OFBY[x] || x.startsWith("c-"))),
    carb: s.carb,
  };
}

export const omNorm = (s: OmSel) => JSON.stringify([s.base, s.fill.slice().sort(), s.carb]);

const fillCache = new WeakMap<ItemsState, { map: Record<string, OmFill>; prot: string[]; veg: string[] }>();

/** Nadjevi: ugrađeni + vlastite namirnice označene za omlet */
function fills(d: AppData) {
  let c = fillCache.get(d.items);
  if (!c) {
    const map: Record<string, OmFill> = { ...OFBY };
    const prot = [...OM_PROT];
    const veg = [...OM_VEG];
    for (const i of allItems(d)) {
      if (!i.om || d.items.hidden.includes(i.id)) continue;
      const amt = String(i.om.amt).replace(".", ",");
      map[i.id] = {
        id: i.id,
        n: i.n,
        line: `<span class=g>${amt} ${i.u}</span> ${i.n.toLowerCase()}`,
        use: { [i.id]: i.om.amt },
        ...(i.om.pre ? { pre: i.om.pre } : { post: `${i.n} rasporedi po nadjevu.` }),
      };
      (i.om.role === "prot" ? prot : veg).push(i.id);
    }
    c = { map, prot, veg };
    fillCache.set(d.items, c);
  }
  return c;
}
export const fillOf = (d: AppData, id: string): OmFill | undefined => fills(d).map[id];
export const omProt = (d: AppData) => fills(d).prot;
export const omVeg = (d: AppData) => fills(d).veg;

/** kcal i proteini po jedinici: ugrađeno ili upisano uz vlastitu namirnicu */
export function macOf(d: AppData, id: string): [number, number] | null {
  const i = itemOf(d, id);
  const base = MAC[id] ?? null;
  if (!i || (i.kcal == null && i.prot == null)) return base;
  const k = isMass(i.u) ? 1 / 100 : 1;
  return [i.kcal != null ? i.kcal * k : (base?.[0] ?? 0), i.prot != null ? i.prot * k : (base?.[1] ?? 0)];
}

/** kcal i proteini za prikaz: na 100 g/ml ili po komadu */
export function macDisplay(d: AppData, id: string): [number | null, number | null] {
  const m = macOf(d, id);
  const i = itemOf(d, id);
  if (!m || !i) return [null, null];
  const k = isMass(i.u) ? 100 : 1;
  return [Math.round(m[0] * k), Math.round(m[1] * k * 10) / 10];
}

export function omUse(d: AppData, sel: OmSel, f: number): Use {
  const use: Use = {};
  const add = (o: Use) => {
    for (const [id, a] of Object.entries(o)) use[id] = (use[id] || 0) + a * f;
  };
  add(OM_BASE[sel.base].use);
  sel.fill.forEach((x) => {
    const F = fillOf(d, x);
    if (F) add(F.use);
  });
  add(OM_CARB[sel.carb].use);
  return use;
}

/** Stvarna potrošnja omleta: prilog iz prepa (pola kutije riže ili krumpira) troši se prvo */
export function omEff(d: AppData, sel: OmSel, f: number, pcopy: Record<string, number>) {
  const use = omUse(d, sel, f);
  const consumed: [string, number][] = [];
  const C = OM_CARB[sel.carb];
  if (C.prep) {
    const [pid, n] = C.prep;
    const k = Math.min(n * f, pcopy[pid] || 0);
    if (k > 0) {
      pcopy[pid] -= k;
      consumed.push([pid, k]);
      for (const [id, a] of Object.entries(PREP_INV[pid].per))
        if (use[id] != null) use[id] = Math.max(0, use[id] - a * k);
    }
  }
  for (const id of Object.keys(use)) if (use[id] < 0.001) delete use[id];
  return { use, consumed };
}

export function omMacros(d: AppData, sel: OmSel, f: number) {
  let k = 10 * f; // ulje u spreju
  let p = 0;
  for (const [id, a] of Object.entries(omUse(d, sel, f))) {
    const m = macOf(d, id);
    if (m) {
      k += m[0] * a;
      p += m[1] * a;
    }
  }
  return { k: Math.round(k), p: Math.round(p) };
}

export function omName(d: AppData, sel: OmSel): string {
  const p = OM_PRESETS.find((x) => omNorm(x.sel) === omNorm(sel));
  if (p) return p.n;
  const f = sel.fill.map((x) => fillOf(d, x)?.n.toLowerCase()).filter((x): x is string => !!x);
  if (!f.length) return OM_BASE[sel.base].n + " omlet";
  const t = f.length > 1 ? f.slice(0, -1).join(", ") + " i " + f[f.length - 1] : f[0];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function omMissing(data: AppData, sel: OmSel, f = 1): string[] {
  return Object.entries(omEff(data, sel, f, { ...data.prepStock }).use)
    .filter(([id, a]) => qty(data, id) + 1e-9 < a)
    .map(([id]) => itemName(data, id));
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
  const used = new Set(keepDone ? cur.filter((o) => o.done && o.sel).map((o) => omNorm(o.sel!)) : []);
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

/** Nasumičan omlet: 1 protein i 2 povrća (i vlastiti nadjevi), prednost ima ono što je na zalihi */
export function surpriseSel(data: AppData, rng: () => number = Math.random): OmSel {
  const ok = (id: string) =>
    Object.entries(fillOf(data, id)?.use ?? {}).every(([k, a]) => qty(data, k) + 1e-9 >= a) ? 1 : 0;
  const pick = (arr: string[], n: number) =>
    shuffle(arr, rng)
      .sort((a, b) => ok(b) - ok(a))
      .slice(0, n);
  const r = rng();
  return {
    base: r < 0.6 ? "protein" : r < 0.8 ? "lagani" : "klasik",
    fill: pick(omProt(data), 1).concat(pick(omVeg(data), 2)),
    carb: "nista",
  };
}

/** Sastojci omleta kao HTML redci (prije skaliranja) */
export function omIngredients(d: AppData, sel: OmSel): string[] {
  const C = OM_CARB[sel.carb];
  return [OM_BASE[sel.base].line]
    .concat(sel.fill.map((x) => fillOf(d, x)?.line).filter((x): x is string => !!x))
    .concat(C.line ? [C.line] : [])
    .concat(["sol, papar, ulje u spreju"]);
}

/** Koraci pripreme, složeni prema nadjevu i načinu (wok ili air fryer) */
export function omSteps(d: AppData, sel: OmSel, method: "wok" | "af"): string[] {
  const fs = sel.fill.map((x) => fillOf(d, x)).filter((x): x is OmFill => !!x);
  const B = OM_BASE[sel.base];
  const C = OM_CARB[sel.carb];
  const pre = fs.filter((x) => x.pre).map((x) => x.pre);
  const post = fs.filter((x) => x.post).map((x) => x.post);
  const mixin = fs.filter((x) => x.mixin).map((x) => x.mixin);
  const st: string[] = [];
  if (C.step && sel.carb === "krumpir") st.push(C.step);
  st.push(
    `U zdjelu stavi ${B.mix}, dodaj prstohvat soli i papra i snažno muti vilicom 30 s, dok smjesa ne bude ujednačena i malo pjenasta. ${mixin.join(" ")}`.trim(),
  );
  if (method === "wok") {
    if (pre.length)
      st.push("Wok zagrij na srednjoj vatri i poprskaj uljem u spreju. " + pre.join(" ") + " Nadjev izvadi na tanjur.");
    st.push("Smanji vatru na srednje nisku, ponovno poprskaj wok i ulij jaja. Ostavi 30 s da se rub stisne.");
    st.push(
      "Kuhačom privlači stisnute rubove prema sredini i naginji wok da sirova smjesa steče na vrući rub. Ponavljaj 1–2 min.",
    );
    if (fs.length)
      st.push(("Dok je gornja strana još malo vlažna, rasporedi nadjev po jednoj polovici. " + post.join(" ")).trim());
    st.push("Preklopi omlet, poklopi wok i ostavi 1 min na najmanjoj vatri da se sredina dovrši, a sir omekša.");
  } else {
    if (pre.length) st.push("Nadjev pripremi u woku na srednjoj vatri s malo ulja u spreju. " + pre.join(" "));
    st.push(
      "Mali kalup za air fryer (silikonski, ili od papira za pečenje savijenog u posudicu) poprskaj uljem i ulij jaja.",
    );
    if (fs.length) st.push(("Rasporedi nadjev po jajima. " + post.join(" ")).trim());
    st.push(
      "Peci na 160 °C 10–12 min, dok sredina nije čvrsta kad lagano protreseš kalup. Na višoj temperaturi rubovi se osuše prije nego sredina bude gotova.",
    );
    st.push("Ostavi 1 min u kalupu pa izvrni na tanjur.");
  }
  if (C.step && sel.carb !== "krumpir") st.push(C.step);
  return st;
}

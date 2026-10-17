/* Svi recepti na jednom mjestu: ručak i večera, omleti i prep, s podacima za filtere i kartice */
import { OM_CARB, OM_PRESETS, PREP, PREP_K } from "../data";
import type { OmSel, Use } from "../data";
import type { AppData } from "../state/model";
import { costOf, effUse, qty } from "./inventory";
import { allRecipes } from "./recipes";
import { allItems } from "./items";
import { macOf, omEff, omMacros, omUse } from "./omlet";

/** Jedno kuhanje (1,5 porcija) daje 2 obroka: ručak i večeru */
export const MEALS_PER_COOK = 2;

export type Kind = "meal" | "om" | "prep";
export const KIND_LABEL: Record<Kind, string> = { meal: "Ručak i večera", om: "Omlet", prep: "Prep" };

/** Skupine proteina po namirnicama iz kataloga */
export const PROT_GROUPS: [string, string[]][] = [
  ["Piletina", ["piletina", "kobasice"]],
  ["Puretina", ["pur-prsa", "pur-mlj", "sunka"]],
  ["Junetina i svinjetina", ["junetina", "svinjetina", "spek"]],
  ["Riba i plodovi mora", ["losos", "kozice", "plodovi", "tuna", "dim-losos"]],
  ["Tofu i soja", ["tofu", "tofu-dim", "edamame"]],
  ["Jaja", ["jaja", "bjelanjci"]],
  ["Sir", ["zrnati", "feta", "mozzarella"]],
  ["Mahunarke", ["crni-grah"]],
];
const GROUP_OF: Record<string, string> = Object.fromEntries(
  PROT_GROUPS.flatMap(([g, ids]) => ids.map((id) => [id, g])),
);

/** Prilog omleta kao ugljikohidrat */
const OM_CARB_LABEL: Record<string, string> = { nista: "Bez priloga", wrap: "Wrap", riza: "Riža", krumpir: "Krumpir" };
export const CARB_ORDER = ["Riža", "Krumpir", "Tjestenina", "Wrap", "Ostalo", "Bez priloga"];

export interface FeedEntry {
  key: string;
  kind: Kind;
  /** id recepta, indeks gotovog omleta ili id prepa */
  id: string;
  n: string;
  d: string;
  carb: string;
  prot: string[];
  items: string[];
  /** po obroku (omlet: cijeli, prep: cijela tura) */
  kcal: number | null;
  p: number | null;
  /** koliko sastojaka ima kcal (ako nije svima, broj je približan) */
  macKnown: number;
  cost: number | null;
  costKnown: number;
  have: number;
  total: number;
  time: number | null;
  method: string;
  custom: boolean;
  two: boolean;
  /** oznake: Omlet, Wok, Air fryer, Lonac, Varivo, Juha, Salata, Prep… */
  tags: string[];
  sel?: OmSel;
}

/** Redoslijed oznaka u filteru */
export const TAG_ORDER = [
  "Omlet",
  "Wok",
  "Air fryer",
  "Lonac",
  "Varivo",
  "Juha",
  "Salata",
  "Bez kuhanja",
  "2 u 1",
  "Prep",
];

function methodTags(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  if (t.includes("wok")) out.push("Wok");
  if (t.includes("air fryer")) out.push("Air fryer");
  if (t.includes("lonac")) out.push("Lonac");
  if (t.includes("bez kuhanja")) out.push("Bez kuhanja");
  return out;
}

export function proteinsOf(d: AppData, use: Use): string[] {
  const out = new Set<string>();
  for (const id of Object.keys(use)) {
    if (GROUP_OF[id]) out.add(GROUP_OF[id]);
    else {
      const i = allItems(d).find((x) => x.id === id);
      if (i?.om?.role === "prot") out.add(i.n);
    }
  }
  return [...out];
}

/** kcal i proteini za količine; koliko je sastojaka s poznatim vrijednostima */
export function macrosOf(d: AppData, use: Use) {
  let k = 0;
  let p = 0;
  let known = 0;
  const ids = Object.keys(use);
  for (const id of ids) {
    const m = macOf(d, id);
    if (!m) continue;
    known++;
    k += m[0] * use[id];
    p += m[1] * use[id];
  }
  return { k, p, known, total: ids.length };
}

function availability(d: AppData, use: Use) {
  const ids = Object.keys(use);
  return { have: ids.filter((id) => qty(d, id) + 1e-9 >= use[id]).length, total: ids.length };
}

const minutes = (s: string) => {
  const m = s.match(/(\d+)\s*min/);
  return m ? Number(m[1]) : null;
};

export function mealEntry(d: AppData, id: string): FeedEntry | null {
  const r = allRecipes(d).find((x) => x.id === id);
  if (!r) return null;
  const use = effUse(r, { ...d.prepStock }, false).use;
  const mac = macrosOf(d, r.use);
  const c = costOf(d, r.use);
  const av = availability(d, use);
  return {
    key: "m:" + r.id,
    kind: "meal",
    id: r.id,
    n: r.n,
    d: r.d,
    carb: r.c,
    prot: proteinsOf(d, r.use),
    items: Object.keys(r.use),
    kcal: mac.known ? Math.round(mac.k / MEALS_PER_COOK) : null,
    p: mac.known ? Math.round(mac.p / MEALS_PER_COOK) : null,
    macKnown: mac.known,
    cost: c.known ? c.c / MEALS_PER_COOK : null,
    costKnown: c.known,
    ...av,
    time: minutes(r.d),
    method: r.d.split(" · ")[0] || "",
    custom: !!r.custom,
    two: !!r.two,
    tags: [
      ...methodTags(r.d),
      ...(/gula|varivo|curry|čorb|corb/i.test(r.n) ? ["Varivo"] : []),
      ...(r.side === "juha" ? ["Juha"] : r.side === "salata" ? ["Salata"] : []),
      ...(r.two ? ["2 u 1"] : []),
    ],
  };
}

export function omEntry(d: AppData, sel: OmSel, key: string, n: string, desc: string, id = ""): FeedEntry {
  const use = omUse(d, sel, 1);
  const mac = omMacros(d, sel, 1);
  const known = Object.keys(use).filter((x) => macOf(d, x)).length;
  const c = costOf(d, use);
  const av = availability(d, omEff(d, sel, 1, { ...d.prepStock }).use);
  return {
    key,
    kind: "om",
    id,
    n,
    d: desc,
    carb: OM_CARB_LABEL[sel.carb] ?? OM_CARB[sel.carb]?.n ?? "",
    prot: proteinsOf(d, use),
    items: Object.keys(use),
    kcal: mac.k,
    p: mac.p,
    macKnown: known,
    cost: c.known ? c.c : null,
    costKnown: c.known,
    ...av,
    time: 10,
    method: "Wok ili air fryer",
    custom: false,
    two: false,
    tags: ["Omlet", "Wok", "Air fryer"],
    sel,
  };
}

export function prepEntry(d: AppData, id: string): FeedEntry | null {
  const p = PREP.find((x) => x.id === id);
  if (!p) return null;
  const mac = macrosOf(d, p.use);
  const c = costOf(d, p.use);
  return {
    key: "p:" + p.id,
    kind: "prep",
    id: p.id,
    n: p.n,
    d: p.yieldTxt.replace(/<[^>]+>/g, ""),
    carb: "",
    prot: proteinsOf(d, p.use),
    items: Object.keys(p.use),
    kcal: mac.known ? Math.round(mac.k) : null,
    p: mac.known ? Math.round(mac.p) : null,
    macKnown: mac.known,
    cost: c.known ? c.c : null,
    costKnown: c.known,
    ...availability(d, p.use),
    time: minutes(p.time),
    method: PREP_K[p.k],
    custom: false,
    two: false,
    tags: ["Prep"],
  };
}

/** Sve kartice za feed */
export function feed(d: AppData): FeedEntry[] {
  const meals = allRecipes(d)
    .map((r) => mealEntry(d, r.id))
    .filter((x): x is FeedEntry => !!x);
  const oms = OM_PRESETS.map((p, i) => omEntry(d, p.sel, "o:" + i, p.n, p.d, String(i)));
  const preps = PREP.map((p) => prepEntry(d, p.id)).filter((x): x is FeedEntry => !!x);
  return [...meals, ...oms, ...preps];
}

export interface FeedFilter {
  q: string;
  tags: string[];
  prot: string[];
  carb: string[];
  /** svi odabrani sastojci moraju biti u receptu */
  items: string[];
  /** "" = sve, "all" = imam sve, "max2" = fale najviše 2 */
  avail: "" | "all" | "max2";
  mine: boolean;
  /** najviše minuta */
  time: number;
}
export const emptyFilter = (): FeedFilter => ({
  q: "",
  tags: [],
  prot: [],
  carb: [],
  items: [],
  avail: "",
  mine: false,
  time: 0,
});

export type FacetKey = "tags" | "prot" | "carb" | "avail" | "time";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Unutar skupine filtera vrijedi "ili", između skupina "i". `skip` se ne primjenjuje (za brojeve u filterima). */
export function matches(e: FeedEntry, f: FeedFilter, d: AppData, skip?: FacetKey): boolean {
  if (f.q.trim()) {
    const q = norm(f.q.trim());
    const names = e.items.map((id) => allItems(d).find((x) => x.id === id)?.n ?? "").join(" ");
    if (!norm(`${e.n} ${e.d} ${names}`).includes(q)) return false;
  }
  if (skip !== "tags" && f.tags.length && !e.tags.some((t) => f.tags.includes(t))) return false;
  if (skip !== "prot" && f.prot.length && !e.prot.some((p) => f.prot.includes(p))) return false;
  if (skip !== "carb" && f.carb.length && !f.carb.includes(e.carb)) return false;
  if (f.items.length && !f.items.every((id) => e.items.includes(id))) return false;
  if (skip !== "avail") {
    if (f.avail === "all" && e.have < e.total) return false;
    if (f.avail === "max2" && e.total - e.have > 2) return false;
  }
  if (skip !== "time" && f.time && (e.time == null || e.time > f.time)) return false;
  if (f.mine && !e.custom) return false;
  return true;
}

export function filterFeed(list: FeedEntry[], f: FeedFilter, d: AppData) {
  return list.filter((e) => matches(e, f, d));
}

/** Broj recepata po vrijednosti, uz sve ostale aktivne filtere */
export function facetCounts(list: FeedEntry[], f: FeedFilter, d: AppData, key: "tags" | "prot" | "carb") {
  const out: Record<string, number> = {};
  for (const e of list) {
    if (!matches(e, f, d, key)) continue;
    const vals = key === "prot" ? e.prot : key === "tags" ? e.tags : [e.carb];
    for (const v of vals) if (v) out[v] = (out[v] || 0) + 1;
  }
  return out;
}

export type SortKey = "pre" | "prot" | "kcal" | "cost" | "time" | "az";
export const SORTS: [SortKey, string][] = [
  ["pre", "Preporučeno"],
  ["prot", "Najviše proteina"],
  ["kcal", "Najmanje kalorija"],
  ["cost", "Najjeftinije"],
  ["time", "Najbrže"],
  ["az", "Abecedno"],
];

export function sortFeed(list: FeedEntry[], k: SortKey): FeedEntry[] {
  const inf = (v: number | null, dir: 1 | -1) => (v == null ? (dir === 1 ? Infinity : -Infinity) : v);
  const by: Record<SortKey, (a: FeedEntry, b: FeedEntry) => number> = {
    pre: (a, b) =>
      (b.total ? b.have / b.total : 0) - (a.total ? a.have / a.total : 0) ||
      ["meal", "om", "prep"].indexOf(a.kind) - ["meal", "om", "prep"].indexOf(b.kind) ||
      inf(b.p, -1) - inf(a.p, -1),
    prot: (a, b) => inf(b.p, -1) - inf(a.p, -1),
    kcal: (a, b) => inf(a.kcal, 1) - inf(b.kcal, 1),
    cost: (a, b) => inf(a.cost, 1) - inf(b.cost, 1),
    time: (a, b) => inf(a.time, 1) - inf(b.time, 1),
    az: (a, b) => a.n.localeCompare(b.n, "hr"),
  };
  return list.slice().sort((a, b) => by[k](a, b) || a.n.localeCompare(b.n, "hr"));
}

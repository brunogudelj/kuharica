import { CATS, DEFAULT_SHOPS, GROUPS, ITEMS, OM_PRESETS } from "../data";
import { diffDays, todayKey, windowKeys } from "../logic/dates";
import type { CustomPrep, CustomRecipe, Item, OmSel, Shop } from "../data";

export interface StockEntry {
  qty: number;
  price: number | null;
}
export interface PlanDay {
  r: string;
  done: boolean;
}
export interface OmDay {
  /** omlet; null = nema omleta (prazan doručak ili doručak je recept `r`) */
  sel: OmSel | null;
  done: boolean;
  /** doručak je recept (1 porcija) umjesto omleta */
  r?: string;
}
/** Dodatni slotovi u danu: juha prije ručka, salata poslije, dva voća */
export type SlotKey = "juha" | "salata" | "voce1" | "voce2";
export const SLOT_KEYS: SlotKey[] = ["juha", "salata", "voce1", "voce2"];
export interface Slot {
  /** recept (juha, salata ili bilo koji recept kao 1 porcija) */
  r?: string;
  /** namirnica (voće) i količina */
  item?: string;
  qty?: number;
  done: boolean;
}
/** Plan po datumima (YYYY-MM-DD). Prikazuje se rolling 14 dana: jučer, danas i 12 dana unaprijed. */
export interface Plan {
  /** datum koji je 1. dan ciklusa riža → krumpir → tjestenina → riža → krumpir */
  anchor: string;
  days: Record<string, PlanDay>;
  om: Record<string, OmDay>;
  extra: Record<SlotKey, Record<string, Slot>>;
}
export const getDay = (p: Plan, k: string): PlanDay => p.days[k] ?? { r: "", done: false };
export const getOm = (p: Plan, k: string): OmDay => p.om[k] ?? { sel: null, done: false };
export const getSlot = (p: Plan, s: SlotKey, k: string): Slot => p.extra[s]?.[k] ?? { done: false };
/** Dan ciklusa (0–4) za datum */
export const cycleIx = (p: Plan, k: string) => ((diffDays(p.anchor, k) % 5) + 5) % 5;
export interface CostEntry {
  id: string;
  t: number;
  shop: string;
  amount: number;
  note: string;
  /** zapis s popisa za kupovinu (ili iz "Kupio"); zamjenjuje ga ukupni iznos s računa */
  est: boolean;
  /** namirnica i kupljena količina, za poništavanje kupnje */
  item?: string;
  qty?: number;
}
/** Vlastite namirnice, skrivene namirnice i promjene pakiranja ili minimuma */
export interface ItemsState {
  /** verzija kataloga (2 = s voćem); stariji podaci dobivaju nove namirnice skrivene ako je zaliha ispražnjena */
  v?: number;
  custom: Item[];
  hidden: string[];
  /** promjene ugrađenih namirnica (sve osim jedinice) */
  over: Record<string, Partial<Pick<Item, "n" | "cat" | "grp" | "src" | "min" | "pack" | "kcal" | "prot">>>;
}
export interface Settings {
  dostava: number;
  /** za koliko dana unaprijed plan ide na popis za kupovinu */
  shopDays: number;
  /** ugrađeni recepti, omleti i prep se prikazuju (false = kreće se od nule, samo vlastito) */
  builtin: boolean;
}
export interface UiState {
  servings: Record<string, number>;
  ture: Record<string, number>;
  tab: string;
  /** odabrani dan u kartici Omlet (0 = ponedjeljak) */
  omDay?: number;
  /** tablica namirnica za tjedan u Planu je otvorena (staro) */
  needsOpen?: boolean;
  /** prikaz u Planu: kalendar ili namirnice za tjedan */
  planView?: "cal" | "needs";
  /** Kupovina se otvara s filterom "Treba za plan" (jednokratno, iz Plana) */
  kupFocus?: "plan";
  /** kartica u Postavkama */
  psTab?: "lists" | "claude" | "sync" | "backup" | "other";
  /** kartica u Troškovima */
  trTab?: "log" | "meal" | "set";
  /** grupiranje popisa za kupovinu */
  kupGroup?: "shop" | "cat" | "none";
}
export interface AppData {
  version: 1;
  /** vrijeme zadnje promjene podataka (ms); za sinkronizaciju, zadnja promjena pobjeđuje */
  updatedAt: number;
  stock: Record<string, StockEntry>;
  prepStock: Record<string, number>;
  plan: Plan;
  hist: { r: string; t: number }[];
  /** ključ "YYYY-MM" */
  costs: Record<string, CostEntry[]>;
  settings: Settings;
  items: ItemsState;
  recipes: CustomRecipe[];
  /** vlastiti prep recepti (id "pp-…") */
  preps: CustomPrep[];
  /** popis dućana */
  shops: Shop[];
  /** mjesta spremanja, skupine i jedinice (uređuju se u Postavkama) */
  lists: Lists;
  ui: UiState;
}

/** Stavka popisa (mjesto spremanja, skupina, jedinica) */
export interface Entry {
  id: string;
  n: string;
}
export interface Lists {
  cats: Entry[];
  grps: Entry[];
  units: Entry[];
}
export const BUILTIN_UNITS: Entry[] = [
  { id: "g", n: "grami (g)" },
  { id: "ml", n: "mililitri (ml)" },
  { id: "kom", n: "komadi (kom)" },
];
export const defaultLists = (): Lists => ({
  cats: Object.entries(CATS).map(([id, n]) => ({ id, n })),
  grps: Object.entries(GROUPS).map(([id, n]) => ({ id, n })),
  units: [
    ...BUILTIN_UNITS,
    { id: "kocka", n: "kocka" },
    { id: "konzerva", n: "konzerva" },
    { id: "vrećica", n: "vrećica" },
  ],
});

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Početni plan: omleti i juha/salata od danas za 14 dana */
export function defaultPlan(now = Date.now()): Plan {
  const keys = windowKeys(now).slice(1);
  const plan: Plan = { anchor: todayKey(now), days: {}, om: {}, extra: { juha: {}, salata: {}, voce1: {}, voce2: {} } };
  keys.forEach((k, i) => {
    plan.om[k] = { sel: clone(OM_PRESETS[i % OM_PRESETS.length].sel), done: false };
    plan.extra.juha[k] = { r: "dod-miso", done: false };
    plan.extra.salata[k] = { r: "dod-salata", done: false };
  });
  return plan;
}

/** Prazan plan od danas */
export const emptyPlan = (now = Date.now()): Plan => ({
  anchor: todayKey(now),
  days: {},
  om: {},
  extra: { juha: {}, salata: {}, voce1: {}, voce2: {} },
});

/**
 * Čisto stanje: sve ugrađene namirnice skrivene, bez ugrađenih recepata, omleta i prepa,
 * prazna zaliha, pripremljeno, plan i povijest kuhanja.
 * Ostaje ono što je korisnik sam dodao (namirnice, recepti, prep), dućani, troškovi i postavke.
 */
export function cleanState(src: AppData, now = Date.now()): AppData {
  const d = clone(src);
  d.items.hidden = ITEMS.map((i) => i.id);
  d.stock = {};
  d.prepStock = {};
  d.plan = emptyPlan(now);
  d.hist = [];
  d.settings.builtin = false;
  return d;
}

export function defaultData(): AppData {
  return {
    version: 1,
    updatedAt: 0,
    stock: {},
    prepStock: {},
    plan: defaultPlan(),
    hist: [],
    costs: {},
    settings: { dostava: 12, shopDays: 7, builtin: true },
    items: { v: 2, custom: [], hidden: [], over: {} },
    recipes: [],
    preps: [],
    shops: clone(DEFAULT_SHOPS),
    lists: defaultLists(),
    ui: { servings: {}, ture: {}, tab: "plan" },
  };
}

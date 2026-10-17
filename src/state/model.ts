import { CATS, DAYS, DEFAULT_SHOPS, GROUPS, OM_PRESETS } from "../data";
import type { CustomRecipe, Item, OmSel, Shop } from "../data";

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
export interface Plan {
  /** dan ciklusa (0–4) kojim počinje tjedan */
  start: number;
  days: PlanDay[];
  om: OmDay[];
  extra: Record<SlotKey, Slot[]>;
}
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

export const defaultOmWeek = (): OmDay[] => OM_PRESETS.slice(0, 7).map((p) => ({ sel: clone(p.sel), done: false }));

export const emptyPlanDays = (): PlanDay[] => DAYS.map(() => ({ r: "", done: false }));

/** Juha i salata su po defaultu miso i velika salata, voće je prazno */
export const defaultExtra = (): Record<SlotKey, Slot[]> => ({
  juha: DAYS.map(() => ({ r: "dod-miso", done: false })),
  salata: DAYS.map(() => ({ r: "dod-salata", done: false })),
  voce1: DAYS.map(() => ({ done: false })),
  voce2: DAYS.map(() => ({ done: false })),
});

export function defaultData(): AppData {
  return {
    version: 1,
    updatedAt: 0,
    stock: {},
    prepStock: {},
    plan: { start: 0, days: emptyPlanDays(), om: defaultOmWeek(), extra: defaultExtra() },
    hist: [],
    costs: {},
    settings: { dostava: 12 },
    items: { v: 2, custom: [], hidden: [], over: {} },
    recipes: [],
    shops: clone(DEFAULT_SHOPS),
    lists: defaultLists(),
    ui: { servings: {}, ture: {}, tab: "plan" },
  };
}

import { CATS, DEFAULT_SHOPS, GROUPS, ITEMS, OM_PRESETS, omPresetId } from "../data";
import { diffDays, todayKey, windowKeys } from "../logic/dates";
import type { CustomPrep, CustomRecipe, Item, Shop } from "../data";

export interface StockEntry {
  qty: number;
  price: number | null;
}
/** Jedan obrok u planu: bilo koji recept (u porcijama) ili namirnica (npr. voće). Svi slotovi su isti. */
export interface Slot {
  id: string;
  r?: string;
  /** porcije recepta; 1 ako nije upisano */
  s?: number;
  /** namirnica i količina */
  item?: string;
  qty?: number;
  done: boolean;
}
/** Plan po datumima (YYYY-MM-DD). Prikazuje se rolling 14 dana: jučer, danas i 12 dana unaprijed. */
export interface Plan {
  /** datum koji je 1. dan ciklusa riža → krumpir → tjestenina → riža → krumpir */
  anchor: string;
  /** obroci dana, redom */
  slots: Record<string, Slot[]>;
}
export const daySlots = (p: Plan, k: string): Slot[] => p.slots[k] ?? [];
export const slotId = () => Math.random().toString(36).slice(2, 9);
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
  over: Record<
    string,
    Partial<
      Pick<
        Item,
        "n" | "cat" | "grp" | "src" | "min" | "pack" | "kcal" | "prot" | "carb" | "fat" | "brand" | "ean" | "alias"
      >
    >
  >;
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
  /** vrste jela za recepte */
  kinds: Entry[];
}
/** Vrste jela na početku; sve se mogu preimenovati, brisati i dodavati u Postavkama */
export const DEFAULT_KINDS: Entry[] = [
  { id: "juha", n: "Juha" },
  { id: "omlet", n: "Omlet" },
  { id: "wok", n: "Wok" },
  { id: "varivo", n: "Varivo" },
  { id: "curry", n: "Curry" },
  { id: "rezanci", n: "Rezanci i ramen" },
  { id: "pasta", n: "Pasta" },
  { id: "rizoto", n: "Rižoto" },
  { id: "bowl", n: "Bowl" },
  { id: "wrap", n: "Wrap" },
  { id: "hamburger", n: "Hamburger" },
  { id: "burek", n: "Burek i pita" },
  { id: "pohano", n: "Pohano" },
  { id: "pecenje", n: "Pečeno i grill" },
  { id: "salata", n: "Salata" },
  { id: "dorucak", n: "Doručak" },
];
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
  kinds: DEFAULT_KINDS.map((e) => ({ ...e })),
});

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Početni plan: doručak (omlet), juha i salata od danas za 14 dana */
export function defaultPlan(now = Date.now()): Plan {
  const plan = emptyPlan(now);
  windowKeys(now)
    .slice(1)
    .forEach((k, i) => {
      plan.slots[k] = [
        { id: slotId(), r: omPresetId(OM_PRESETS[i % OM_PRESETS.length]), done: false },
        { id: slotId(), r: "dod-miso", done: false },
        { id: slotId(), r: "dod-salata", done: false },
      ];
    });
  return plan;
}

/** Prazan plan od danas */
export const emptyPlan = (now = Date.now()): Plan => ({ anchor: todayKey(now), slots: {} });

/**
 * Namirnice od nule: sve ugrađene namirnice skrivene, prazna zaliha i pripremljeno.
 * Recepti, omleti, prep, plan, dućani, troškovi i vlastite namirnice ostaju.
 */
export function cleanState(src: AppData): AppData {
  const d = clone(src);
  d.items.hidden = ITEMS.map((i) => i.id);
  d.stock = {};
  d.prepStock = {};
  d.settings.builtin = true;
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

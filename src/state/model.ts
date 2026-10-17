import { DAYS, OM_PRESETS } from "../data";
import type { Item, OmSel } from "../data";

export interface StockEntry {
  qty: number;
  price: number | null;
}
export interface PlanDay {
  r: string;
  done: boolean;
}
export interface OmDay {
  sel: OmSel;
  done: boolean;
}
export interface Plan {
  /** dan ciklusa (0–4) kojim počinje tjedan */
  start: number;
  days: PlanDay[];
  om: OmDay[];
}
export interface CostEntry {
  id: string;
  t: number;
  shop: string;
  amount: number;
  note: string;
  /** procjena iz "Kupio", zamjenjuje je pravi račun */
  est: boolean;
}
/** Vlastite namirnice, skrivene namirnice i promjene pakiranja ili minimuma */
export interface ItemsState {
  custom: Item[];
  hidden: string[];
  over: Record<string, { min?: number; pack?: number }>;
}
export interface Settings {
  dostava: number;
}
export interface UiState {
  servings: Record<string, number>;
  ture: Record<string, number>;
  tab: string;
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
  ui: UiState;
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const defaultOmWeek = (): OmDay[] => OM_PRESETS.slice(0, 7).map((p) => ({ sel: clone(p.sel), done: false }));

export const emptyPlanDays = (): PlanDay[] => DAYS.map(() => ({ r: "", done: false }));

export function defaultData(): AppData {
  return {
    version: 1,
    updatedAt: 0,
    stock: {},
    prepStock: {},
    plan: { start: 0, days: emptyPlanDays(), om: defaultOmWeek() },
    hist: [],
    costs: {},
    settings: { dostava: 12 },
    items: { custom: [], hidden: [], over: {} },
    ui: { servings: {}, ture: {}, tab: "plan" },
  };
}

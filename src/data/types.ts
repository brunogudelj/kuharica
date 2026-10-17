export type CatId = "frz" | "fri" | "dry" | "fre";
export type ShopId = "K" | "BIO" | "AZ" | "O";
export type Unit = "g" | "ml" | "kom";
export type UnitId = "vrecica" | "kutija" | "porcija" | "kockica" | "cufta" | "muffin" | "obrok";
export type Carb = "Riža" | "Krumpir" | "Tjestenina";
export type PrepCat = "Umaci" | "Marinade" | "Baze" | "Gotovo";

/** Namirnica iz kataloga */
export interface Item {
  id: string;
  /** naziv */
  n: string;
  cat: CatId;
  src: Exclude<ShopId, "O">;
  u: Unit;
  /** minimalna zaliha */
  min: number;
  /** veličina pakiranja u jedinici `u` */
  pack: number;
  /** korak za + i − */
  step: number;
  hint: string;
}

/** Količine po id-u namirnice */
export type Use = Record<string, number>;

export interface Recipe {
  id: string;
  n: string;
  c: Carb;
  /** "2 u 1" jelo */
  two?: boolean;
  /** opis: način i vrijeme */
  d: string;
  /** potrošnja za 1,5 porcija */
  use: Use;
  /** sastojci kao HTML (brojevi u <span class=g>) */
  ing: string[];
  st: string[];
  split?: string[];
}

export interface PrepRecipe {
  id: string;
  n: string;
  k: PrepCat;
  time: string;
  yieldTxt: string;
  keep: string;
  use: Use;
  ing: string[];
  st: string[];
  tip: string;
  for: string[];
}

export interface PrepInv {
  make: number;
  unit: UnitId;
  per: Use;
}

export interface OmBase {
  n: string;
  d: string;
  use: Use;
  line: string;
  mix: string;
}

export interface OmFill {
  id: string;
  n: string;
  line: string;
  use: Use;
  pre?: string;
  post?: string;
  mixin?: string;
}

export interface OmCarb {
  n: string;
  use: Use;
  line?: string;
  step?: string;
  prep?: [string, number];
}

export interface OmSel {
  base: string;
  fill: string[];
  carb: string;
}

export interface OmPreset {
  n: string;
  d: string;
  sel: OmSel;
}

/** mjesto spremanja: ugrađena (frz, fri, dry, fre) ili vlastita (k-…) */
export type CatId = string;
/** skupina namirnice (vrsta hrane), neovisno o mjestu čuvanja */
export type GrpId = string;
/** id dućana: ugrađeni (K, BIO, AZ, O) ili vlastiti (s-…) */
export type ShopId = string;
/** g, ml, kom ili vlastita jedinica (kocka, konzerva…) koja se broji kao komad */
export type Unit = string;
export type UnitId = "vrecica" | "kutija" | "porcija" | "kockica" | "cufta" | "muffin" | "obrok";
export type Carb = "Riža" | "Krumpir" | "Tjestenina" | "Ostalo";
export type PrepCat = "Umaci" | "Marinade" | "Baze" | "Gotovo";

/** Namirnica iz kataloga */
export interface Item {
  id: string;
  /** naziv */
  n: string;
  cat: CatId;
  /** skupina: voće, povrće, meso… (ugrađene je dobivaju iz GRP_OF) */
  grp?: GrpId;
  src: ShopId;
  u: Unit;
  /** minimalna zaliha */
  min: number;
  /** veličina pakiranja u jedinici `u` */
  pack: number;
  /** korak za + i − */
  step: number;
  hint: string;
  /** vlastita namirnica kao nadjev za omlet */
  om?: { role: "prot" | "veg"; amt: number; pre?: string };
  /** kcal i proteini na 100 g/ml, ili po komadu */
  kcal?: number;
  prot?: number;
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
  /** vlastiti recept */
  custom?: boolean;
  /** dodatak uz ručak: juha (prije) ili salata (poslije); količine su za cijeli dan */
  side?: "juha" | "salata";
}

/** Vlastiti recept kako se sprema: količine su za 1,5 porcija (kao ugrađeni) */
export interface CustomRecipe {
  id: string;
  n: string;
  c: Carb;
  d: string;
  use: Use;
  /** sastojci koji se ne prate (začini i sl.) */
  extra: string[];
  st: string[];
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

/** Dućan s popisa dućana */
export interface Shop {
  id: ShopId;
  n: string;
  /** vrsta: supermarket, zdrava hrana, azijski, tržnica, online… */
  type: string;
  addr: string;
  url: string;
  note: string;
  /** korisni linkovi (kategorije u webshopu) */
  links?: { n: string; url: string }[];
}

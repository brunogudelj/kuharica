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
  /** ugljikohidrati i masti (g) na 100 g/ml, ili po komadu */
  carb?: number;
  fat?: number;
  /** marka i proizvod, npr. "Ledo" */
  brand?: string;
  /** barkod (EAN) s pakiranja */
  ean?: string;
  /** drugi nazivi po kojima se prepoznaje pri uvozu recepta (npr. "meksička mješavina", "mexican mix") */
  alias?: string[];
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
  /** pripremljeno (prep) kao sastojak vlastitog recepta: [id prepa, jedinica] za 1,5 porcija.
   * Ako prepa nema, troše se njegovi sirovi sastojci. */
  prep?: [string, number][];
  /** prep čiji su sirovi sastojci već u `use` (kao kod ugrađenih): pripremljeno ih zamjenjuje.
   * Ugrađeni recept bez `prep` koristi REC_USE_PREP. */
  prepIn?: [string, number][];
  /** vrste jela (id-evi s popisa Vrste jela) */
  kinds?: string[];
  /** recept je složen od drugih recepata: [id recepta, porcija tog recepta po 1 porciji ovog] */
  parts?: [string, number][];
  /** ugrađeni recept koji je korisnik uredio */
  edited?: boolean;
  /** za koliko porcija su napisani sastojci (`ing`), ako nije 1,5 (omlet: 1) */
  ingFor?: number;
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
  /** pripremljeno kao sastojak: id prepa → jedinice (porcije, kutije…) za 1,5 porcija */
  prep?: Record<string, number>;
  /** prep čiji su sirovi sastojci već u `use` (uređeni ugrađeni recept) */
  prepIn?: Record<string, number>;
  st: string[];
  /** vrste jela (id-evi s popisa Vrste jela) */
  kinds?: string[];
  /** drugi recepti kao dijelovi: id recepta → porcija tog recepta po 1 porciji ovog */
  parts?: Record<string, number>;
  /** dodatak uz ručak (za uređeni ugrađeni recept) */
  side?: "juha" | "salata";
  two?: boolean;
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
  /** vrste jela (id-evi s popisa Vrste jela) */
  kinds?: string[];
  /** vlastiti prep ili uređeni ugrađeni */
  custom?: boolean;
  edited?: boolean;
  /** drugi prep kao dio: [id, jedinica] za jednu turu; ako ga nema pripremljenog, troše se njegovi sirovi sastojci */
  prep?: [string, number][];
}

/** Vlastiti prep (npr. umak spremljen iz recepta s weba). `use` su sirovi sastojci za jednu turu. */
export interface CustomPrep {
  id: string;
  n: string;
  k: PrepCat;
  time: string;
  keep: string;
  /** koliko jedinica daje jedna tura */
  make: number;
  unit: UnitId;
  use: Use;
  /** sastojci koji se ne prate (začini) */
  extra: string[];
  st: string[];
  /** vrste jela */
  kinds?: string[];
  /** drugi prep kao dio: id → jedinica za jednu turu */
  prep?: Record<string, number>;
  /** savjet (uređeni ugrađeni prep) */
  tip?: string;
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

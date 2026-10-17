import { ITEMS } from "./items";
import { RECIPES } from "./recipes";
import { PREP } from "./prep";
import { OM_FILL } from "./omlet";
import type { Shop } from "./types";

export * from "./items";
export * from "./recipes";
export * from "./prep";
export * from "./omlet";
export type * from "./types";

export const BY = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const RBY = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const PBY = Object.fromEntries(PREP.map((p) => [p.id, p]));
export const OFBY = Object.fromEntries(OM_FILL.map((x) => [x.id, x]));

/** Dućani na početku. Sve se može mijenjati na stranici Dućani. */
export const DEFAULT_SHOPS: Shop[] = [
  {
    id: "K",
    n: "Kaufland",
    type: "Supermarket",
    addr: "Zagreb, više lokacija",
    url: "https://www.kaufland.hr",
    note: "Većina namirnica: meso, povrće, mliječno, riža i tjestenina.",
  },
  {
    id: "BIO",
    n: "Bio&Bio",
    type: "Zdrava hrana",
    addr: "Zagreb, više lokacija i webshop",
    url: "https://www.biobio.hr",
    note: "Miso, tofu, alge, tamari. Besplatna dostava od 50 €.",
    links: [
      { n: "Miso paste", url: "https://www.biobio.hr/proizvodi/ulja-i-zacini/miso-i-instant-juhe/" },
      { n: "Morske alge", url: "https://www.biobio.hr/proizvodi/voce-i-povrce/morske-alge/" },
      { n: "Tofu i seitan", url: "https://www.biobio.hr/proizvodi/svjeze-iz-hladnjaka/tofu-i-seitan/" },
      { n: "Soja i tamari", url: "https://www.biobio.hr/proizvodi/ulja-i-zacini/umaci-od-soje/" },
    ],
  },
  {
    id: "AZ",
    n: "Asia Store",
    type: "Azijski dućan",
    addr: "Vlaška 52, Zagreb",
    url: "https://wolt.com/hr/hrv/zagreb/venue/asia-store",
    note: "Riža za sushi, sriracha, rezanci, umaci, paste, smrznuta hrana. Dostava preko Wolta.",
  },
  {
    id: "s-pekinska",
    n: "Pekinška patka",
    type: "Azijski dućan",
    addr: "Vlaška 78, Zagreb",
    url: "https://www.google.com/search?q=Pekin%C5%A1ka+patka+Vla%C5%A1ka+78+webshop",
    note: "Vlastiti webshop s dostavom.",
  },
  {
    id: "s-ricekakis",
    n: "Rice Kakis",
    type: "Online",
    addr: "samo webshop",
    url: "https://www.google.com/search?q=Rice+Kakis+webshop+Hrvatska",
    note: "Kimchi, rezanci, panko i ostale azijske namirnice.",
  },
  { id: "O", n: "Ostalo", type: "Ostalo", addr: "", url: "", note: "Za sve što ne kupuješ na stalnom mjestu." },
];

/** Nazivi ugrađenih dućana (za stare zapise i kad dućan nije pronađen) */
export const SHOPS: Record<string, string> = Object.fromEntries(DEFAULT_SHOPS.map((s) => [s.id, s.n]));

/** Nedjeljni prep redoslijed */
export const PREP_TIMELINE: [string, string][] = [
  ["0:00", "Isperi i stavi kuhati rižu. U drugi lonac stavi vodu za krumpir."],
  ["0:05", "Teriyaki umak u malom loncu. Dok se kuha, u staklenke protresi pad thai umak i oba dresinga."],
  ["0:15", "Krumpir u kipuću vodu na 5 min. Tofu stavi pod prešu (tava s teretom)."],
  ["0:20", "Ocijedi krumpir i raširi ga da se suši. Rižu makni s vatre, neka stoji poklopljena."],
  ["0:25", "Marinade: tandoori i grčka s piletinom, bulgogi s puretinom. Sve u vrećice, plosnato u zamrzivač."],
  ["0:40", "Rižu raširi na pladanj da se hladi. Oblikuj ćufte i stavi ih na papir u zamrzivač."],
  ["0:45", "Tofu u air fryer (15 min). Za to vrijeme reži povrće za wok."],
  ["1:00", "Đumbir i češnjak u kalup za led, kiseli krastavci u staklenku, miso paketići u kutijice."],
  ["1:10", "Rižu i krumpir podijeli u kutije, ćufte prebaci u vrećicu. Zalij posuđe vodom i gotovo."],
];

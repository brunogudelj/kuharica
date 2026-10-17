import { ITEMS } from "./items";
import { RECIPES } from "./recipes";
import { PREP } from "./prep";
import { OM_FILL } from "./omlet";
import type { ShopId } from "./types";

export * from "./items";
export * from "./recipes";
export * from "./prep";
export * from "./omlet";
export type * from "./types";

export const BY = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const RBY = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const PBY = Object.fromEntries(PREP.map((p) => [p.id, p]));
export const OFBY = Object.fromEntries(OM_FILL.map((x) => [x.id, x]));

export const SHOPS: Record<ShopId, string> = { K: "Kaufland", BIO: "Bio&Bio", AZ: "Azijski dućan", O: "Ostalo" };

/** Linkovi na dućane u Zagrebu (iz prototipa) */
export const SHOP_LINKS = {
  zdravi: [
    {
      n: "Bio&Bio: miso paste",
      url: "https://www.biobio.hr/proizvodi/ulja-i-zacini/miso-i-instant-juhe/",
      d: "Velik izbor miso pasta od soje, ječma i riže. Besplatna dostava od 50 €, u Zagrebu i brza dostava.",
    },
    {
      n: "Bio&Bio: morske alge",
      url: "https://www.biobio.hr/proizvodi/voce-i-povrce/morske-alge/",
      d: "Wakame i nori za miso juhu i poke.",
    },
    {
      n: "Bio&Bio: tofu",
      url: "https://www.biobio.hr/proizvodi/svjeze-iz-hladnjaka/tofu-i-seitan/",
      d: "Običan i dimljeni tofu.",
    },
    {
      n: "Bio&Bio: soja i tamari",
      url: "https://www.biobio.hr/proizvodi/ulja-i-zacini/umaci-od-soje/",
      d: "Za rižin ocat i sezamovo ulje pogledaj i kategorije octeva i ulja.",
    },
  ],
  azijski: [
    {
      n: "Asia Store (Wolt)",
      url: "https://wolt.com/hr/hrv/zagreb/venue/asia-store",
      d: "Vlaška 52. Riža za sushi, sriracha, rezanci, umaci, paste, smrznuta hrana.",
    },
    {
      n: "Pekinška patka",
      url: "https://www.google.com/search?q=Pekin%C5%A1ka+patka+Vla%C5%A1ka+78+webshop",
      d: "Vlaška 78. Vlastiti webshop s dostavom.",
    },
    {
      n: "Rice Kakis (samo online)",
      url: "https://www.google.com/search?q=Rice+Kakis+webshop+Hrvatska",
      d: "Kimchi, rezanci, panko i ostale azijske namirnice.",
    },
  ],
};

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

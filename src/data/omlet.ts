// Generirano iz reference/kuharica-prototip.html skriptom scripts/izvuci-podatke.mjs. Podaci su preneseni doslovno.
import type { OmBase, OmFill, OmCarb, OmPreset, OmSel } from "./types";

export const OM_BASE: Record<string, OmBase> = {
  protein: {
    n: "Proteinski",
    d: "2 jaja + 150 ml bjelanjaka",
    use: {
      jaja: 2,
      bjelanjci: 150,
    },
    line: "<span class=g>2</span> jaja + <span class=g>150 ml</span> tekućih bjelanjaka (ili bjelanjci od <span class=g>4–5</span> jaja)",
    mix: "jaja i bjelanjke",
  },
  klasik: {
    n: "Klasični",
    d: "3 jaja",
    use: {
      jaja: 3,
    },
    line: "<span class=g>3</span> jaja",
    mix: "jaja",
  },
  lagani: {
    n: "Lagani",
    d: "1 jaje + 250 ml bjelanjaka",
    use: {
      jaja: 1,
      bjelanjci: 250,
    },
    line: "<span class=g>1</span> jaje + <span class=g>250 ml</span> tekućih bjelanjaka",
    mix: "jaje i bjelanjke",
  },
};

export const OM_FILL: OmFill[] = [
  {
    id: "spinat",
    n: "Špinat",
    line: "<span class=g>80 g</span> špinata (2 smrznute kockice ili šaka svježeg)",
    use: {
      spinat: 80,
    },
    pre: "Špinat stavi u wok s 2 žlice vode i miješaj 1–2 min dok ne splasne, pa ga iscijedi žlicom uz rub.",
  },
  {
    id: "gljive",
    n: "Gljive",
    line: "<span class=g>100 g</span> gljiva na listiće",
    use: {
      gljive: 100,
    },
    pre: "Gljive zapeci na suhom woku 3–4 min dok ne puste vodu i ona ne ispari.",
  },
  {
    id: "paprika",
    n: "Paprika",
    line: "<span class=g>½</span> paprike na kockice",
    use: {
      paprike: 0.5,
    },
    pre: "Papriku prži 2 min da omekša.",
  },
  {
    id: "rajcice",
    n: "Cherry rajčice",
    line: "<span class=g>80 g</span> cherry rajčica, prepolovljenih",
    use: {
      rajcice: 80,
    },
    post: "Rajčice stavi sirove na nadjev, samo se zagriju.",
  },
  {
    id: "luk",
    n: "Mladi luk",
    line: "<span class=g>2</span> stabljike mladog luka",
    use: {
      "mladi-luk": 0.25,
    },
    mixin: "Mladi luk nareži i umiješaj izravno u jaja.",
  },
  {
    id: "sunka",
    n: "Pureća šunka",
    line: "<span class=g>60 g</span> pureće šunke na trakice",
    use: {
      sunka: 60,
    },
    pre: "Šunku kratko zapeci 1 min da dobije boju.",
  },
  {
    id: "tuna",
    n: "Tuna",
    line: "<span class=g>½</span> konzerve tune, dobro ocijeđene",
    use: {
      tuna: 0.5,
    },
    post: "Tunu razmrvi vilicom i rasporedi po pola omleta.",
  },
  {
    id: "zrnati",
    n: "Zrnati sir",
    line: "<span class=g>80 g</span> zrnatog sira",
    use: {
      zrnati: 80,
    },
    post: "Zrnati sir stavi žlicom na jednu polovicu.",
  },
  {
    id: "feta",
    n: "Light feta",
    line: "<span class=g>30 g</span> light fete",
    use: {
      feta: 30,
    },
    post: "Fetu izmrvi preko nadjeva.",
  },
  {
    id: "kimchi",
    n: "Kimchi",
    line: "<span class=g>50 g</span> kimchija, sitno nasjeckanog",
    use: {
      kimchi: 50,
    },
    pre: "Kimchi prži 1 min da se karamelizira.",
  },
  {
    id: "meksicko",
    n: "Meksičko povrće",
    line: "<span class=g>100 g</span> meksičke mješavine",
    use: {
      meksicko: 100,
    },
    pre: "Meksičko povrće iz zamrzivača prži 4 min dok ne ispari voda, začini kuminom.",
  },
  {
    id: "edamame",
    n: "Edamame",
    line: "<span class=g>50 g</span> edamamea",
    use: {
      edamame: 50,
    },
    pre: "Edamame dodaj u wok zadnji, 1 min.",
  },
  {
    id: "spek",
    n: "Špek",
    line: "<span class=g>20 g</span> špeka na sitne kockice",
    use: {
      spek: 20,
    },
    pre: "Špek prži na suhom woku 2–3 min dok ne pusti mast i ne postane hrskav. Drugo ulje ti ne treba.",
  },
  {
    id: "kobasice",
    n: "Pileća kobasica",
    line: "<span class=g>1</span> pileća kobasica (<span class=g>50 g</span>) na kolutiće",
    use: {
      kobasice: 50,
    },
    pre: "Kolutiće kobasice zapeci 3 min sa svih strana.",
  },
  {
    id: "tofu",
    n: "Tofu",
    line: "<span class=g>80 g</span> tofua, izmrvljenog",
    use: {
      tofu: 80,
    },
    pre: "Tofu izmrvi prstima i prži 3 min s kapi soja umaka dok ne dobije boju.",
  },
  {
    id: "tofu-dim",
    n: "Dimljeni tofu",
    line: "<span class=g>60 g</span> dimljenog tofua na kockice",
    use: {
      "tofu-dim": 60,
    },
    pre: "Dimljeni tofu zapeci 2 min.",
  },
  {
    id: "brokula",
    n: "Brokula",
    line: "<span class=g>80 g</span> brokule na sitne cvjetiće",
    use: {
      brokula: 80,
    },
    pre: "Brokulu prži 1 min, dodaj 2 žlice vode i poklopi na 2 min da omekša na pari.",
  },
  {
    id: "tikvice",
    n: "Tikvica",
    line: "<span class=g>½</span> tikvice, naribane",
    use: {
      tikvice: 0.5,
    },
    pre: "Tikvicu naribaj, posoli, ostavi 2 min pa iscijedi šakama i prži 2 min.",
  },
  {
    id: "mozzarella",
    n: "Light mozzarella",
    line: "<span class=g>40 g</span> light mozzarelle",
    use: {
      mozzarella: 40,
    },
    post: "Mozzarellu natrgaj na komadiće preko nadjeva.",
  },
  {
    id: "dim-losos",
    n: "Dimljeni losos",
    line: "<span class=g>50 g</span> dimljenog lososa",
    use: {
      "dim-losos": 50,
    },
    post: "Losos natrgaj na trake i stavi tek pri preklapanju, ne smije se kuhati.",
  },
  {
    id: "crni-grah",
    n: "Crni grah",
    line: "<span class=g>60 g</span> crnog graha, ispranog",
    use: {
      "crni-grah": 60,
    },
    pre: "Grah isperi, ocijedi i zagrij 1 min s ostalim nadjevom.",
  },
  {
    id: "rikola",
    n: "Rikola",
    line: "šaka rikole (<span class=g>20 g</span>)",
    use: {
      rikola: 20,
    },
    post: "Rikolu stavi na gotov omlet.",
  },
];

export const OM_PROT: string[] = [
  "sunka",
  "tuna",
  "zrnati",
  "feta",
  "spek",
  "kobasice",
  "tofu",
  "tofu-dim",
  "mozzarella",
  "dim-losos",
  "crni-grah",
  "edamame",
];
export const OM_VEG: string[] = [
  "spinat",
  "gljive",
  "paprika",
  "rajcice",
  "luk",
  "kimchi",
  "meksicko",
  "brokula",
  "tikvice",
  "rikola",
];

export const OM_CARB: Record<string, OmCarb> = {
  nista: {
    n: "Bez priloga",
    use: {},
  },
  wrap: {
    n: "1 wrap",
    use: {
      wrap: 1,
    },
    line: "<span class=g>1</span> tortilja wrap (66 g)",
    step: "Wrap zagrij 20 s na suhom woku, stavi omlet na njega i zarolaj kao burrito.",
  },
  riza: {
    n: "½ kutije riže",
    prep: ["riza", 0.5],
    use: {
      basmati: 35,
    },
    line: "½ kutije riže iz prepa (ili <span class=g>35 g</span> suhe riže)",
    step: "Rižu iz kutije podgrij 1 min u mikrovalnoj sa žlicom vode i posluži omlet preko nje.",
  },
  krumpir: {
    n: "½ kutije krumpira",
    prep: ["krumpir", 0.5],
    use: {
      krumpir: 150,
    },
    line: "½ kutije krumpira iz prepa (ili <span class=g>150 g</span> krumpira)",
    step: "Krumpir iz kutije stavi u air fryer na 200 °C 12 min čim počneš mutiti jaja, pa bude gotov zajedno s omletom.",
  },
};

export const OM_PRESETS: OmPreset[] = [
  {
    n: "Zeleni proteinski",
    d: "špinat, zrnati sir, mladi luk",
    sel: {
      base: "protein",
      fill: ["spinat", "zrnati", "luk"],
      carb: "nista",
    },
  },
  {
    n: "Meksički burrito",
    d: "u wrapu, meksičko povrće i paprika",
    sel: {
      base: "protein",
      fill: ["meksicko", "paprika"],
      carb: "wrap",
    },
  },
  {
    n: "Azijski s rižom",
    d: "kimchi, edamame, mladi luk",
    sel: {
      base: "protein",
      fill: ["kimchi", "edamame", "luk"],
      carb: "riza",
    },
  },
  {
    n: "Grčki",
    d: "špinat, rajčice, light feta",
    sel: {
      base: "protein",
      fill: ["spinat", "rajcice", "feta"],
      carb: "nista",
    },
  },
  {
    n: "Šunka i gljive",
    d: "klasik od 3 jaja",
    sel: {
      base: "klasik",
      fill: ["sunka", "gljive"],
      carb: "nista",
    },
  },
  {
    n: "Tuna omlet",
    d: "najviše proteina, malo kalorija",
    sel: {
      base: "lagani",
      fill: ["tuna", "luk", "rajcice"],
      carb: "nista",
    },
  },
  {
    n: "Talijanski",
    d: "rajčice, mozzarella, rikola",
    sel: {
      base: "protein",
      fill: ["rajcice", "mozzarella", "rikola"],
      carb: "nista",
    },
  },
  {
    n: "Seljački",
    d: "malo špeka, mladi luk, krumpir iz prepa",
    sel: {
      base: "klasik",
      fill: ["spek", "luk"],
      carb: "krumpir",
    },
  },
  {
    n: "Kobasica i paprika",
    d: "pileća kobasica, paprika, mladi luk",
    sel: {
      base: "protein",
      fill: ["kobasice", "paprika", "luk"],
      carb: "nista",
    },
  },
  {
    n: "Tofu i gljive",
    d: "za dan bez mesa",
    sel: {
      base: "lagani",
      fill: ["tofu", "gljive", "luk"],
      carb: "nista",
    },
  },
  {
    n: "Losos i rikola",
    d: "dimljeni losos, zrnati sir, rikola",
    sel: {
      base: "protein",
      fill: ["dim-losos", "zrnati", "rikola"],
      carb: "nista",
    },
  },
  {
    n: "Brokula i feta",
    d: "brokula na pari, light feta",
    sel: {
      base: "protein",
      fill: ["brokula", "feta"],
      carb: "nista",
    },
  },
  {
    n: "Tikvice i mozzarella",
    d: "naribana tikvica, rajčice",
    sel: {
      base: "protein",
      fill: ["tikvice", "mozzarella", "rajcice"],
      carb: "nista",
    },
  },
  {
    n: "Dimljeni tofu",
    d: "dimljeni tofu, paprika, špinat",
    sel: {
      base: "lagani",
      fill: ["tofu-dim", "paprika", "spinat"],
      carb: "nista",
    },
  },
  {
    n: "Meksički s grahom",
    d: "crni grah, meksičko povrće, paprika",
    sel: {
      base: "protein",
      fill: ["crni-grah", "meksicko", "paprika"],
      carb: "nista",
    },
  },
];

export const DEFAULT_OM: OmSel = {
  base: "protein",
  fill: ["spinat", "zrnati", "luk"],
  carb: "nista",
};

/** kcal i proteini po jedinici namirnice (g, ml ili kom) */
export const MAC: Record<string, [number, number]> = {
  jaja: [72, 6.3],
  bjelanjci: [0.5, 0.11],
  spinat: [0.23, 0.029],
  gljive: [0.22, 0.031],
  paprike: [40, 1.5],
  rajcice: [0.18, 0.009],
  "mladi-luk": [32, 1.8],
  sunka: [1.05, 0.19],
  tuna: [125, 28],
  zrnati: [0.95, 0.12],
  feta: [1.8, 0.17],
  kimchi: [0.2, 0.012],
  meksicko: [0.75, 0.035],
  edamame: [1.2, 0.11],
  wrap: [200, 6],
  basmati: [3.5, 0.075],
  krumpir: [0.77, 0.02],
  spek: [3.6, 0.15],
  kobasice: [1.8, 0.14],
  tofu: [1.2, 0.13],
  "tofu-dim": [1.6, 0.16],
  brokula: [0.34, 0.028],
  tikvice: [43, 3],
  mozzarella: [1.6, 0.18],
  "dim-losos": [1.17, 0.18],
  "crni-grah": [1.3, 0.085],
  rikola: [0.25, 0.026],
};

/** Id ugrađenog omleta kao recepta ("Zeleni proteinski" → "om-zeleni-proteinski") */
export const omPresetId = (p: OmPreset) =>
  "om-" +
  p.n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

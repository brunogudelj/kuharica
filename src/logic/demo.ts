/* Demo podaci za isprobavanje dizajna: izmišljene cijene, kalorije, zalihe i troškovi.
 * Spremaju se odvojeno od pravih podataka i ne sinkroniziraju se. */
import { ITEMS, MAC } from "../data";
import type { AppData } from "../state/model";
import { clone, daySlots, defaultData } from "../state/model";
import { autoFillPlan } from "./actions";
import { monthKey, round } from "./format";
import { windowKeys } from "./dates";

/** Ponovljiv slučajni broj (isti demo svaki put) */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Izmišljena cijena pakiranja (€) */
const PRICE: Record<string, number> = {
  banana: 1.49,
  naranca: 1.99,
  kivi: 1.79,
  kruska: 1.99,
  mandarina: 1.69,
  borovnice: 3.49,
  piletina: 8.99,
  "pur-prsa": 6.49,
  "pur-mlj": 4.99,
  junetina: 7.99,
  svinjetina: 6.49,
  losos: 9.99,
  kozice: 6.99,
  plodovi: 5.49,
  gyoze: 6.9,
  edamame: 3.99,
  grasak: 1.69,
  mahune: 1.79,
  brokula: 1.99,
  dumbir: 0.89,
  miso: 6.49,
  kimchi: 4.5,
  tofu: 2.79,
  "tofu-dim": 3.19,
  posni: 1.29,
  jogurt: 1.19,
  mlijeko: 1.09,
  jaja: 2.99,
  mrkva: 1.29,
  kupus: 0.99,
  oyster: 2.9,
  curry: 2.5,
  basmati: 2.99,
  jasmin: 3.49,
  tjestenina: 1.49,
  rizini: 1.99,
  ramen: 1.79,
  tuna: 4.49,
  kokos: 1.69,
  temeljac: 1.19,
  koncentrat: 0.99,
  soja: 2.49,
  "rizin-ocat": 3.29,
  sriracha: 3.2,
  sezamovo: 5.99,
  sezam: 1.29,
  wakame: 4.99,
  med: 5.49,
  gustin: 1.19,
  kikiriki: 1.49,
  ulje: 8.99,
  krumpir: 1.99,
  luk: 1.09,
  cesnjak: 0.99,
  salata: 0.89,
  krastavci: 0.59,
  rajcice: 2.49,
  paprike: 1.99,
  tikvice: 0.69,
  gljive: 2.29,
  klice: 1.49,
  "mladi-luk": 0.69,
  karfiol: 1.79,
  patlidzan: 0.99,
  limun: 0.35,
  limeta: 0.45,
  avokado: 1.29,
  jabuka: 0.3,
  bjelanjci: 2.99,
  zrnati: 1.39,
  feta: 2.29,
  sunka: 2.49,
  wrap: 2.29,
  spinat: 1.49,
  meksicko: 1.89,
  spek: 2.79,
  kobasice: 2.99,
  mozzarella: 0.99,
  "dim-losos": 3.49,
  rikola: 1.29,
  "crni-grah": 0.99,
};

/** Izmišljene kcal i proteini (na 100 g/ml ili po komadu) za namirnice bez ugrađenih vrijednosti */
const NUTR: Record<string, [number, number]> = {
  piletina: [110, 23],
  "pur-prsa": [105, 24],
  "pur-mlj": [150, 20],
  junetina: [130, 21],
  svinjetina: [120, 22],
  losos: [200, 20],
  kozice: [85, 19],
  plodovi: [75, 15],
  gyoze: [45, 2],
  grasak: [80, 5],
  mahune: [30, 2],
  dumbir: [80, 2],
  miso: [200, 12],
  oyster: [110, 2],
  curry: [120, 2],
  jasmin: [355, 7],
  tjestenina: [350, 13],
  rizini: [360, 6],
  ramen: [440, 10],
  kokos: [75, 0.7],
  temeljac: [15, 1],
  koncentrat: [85, 4],
  soja: [55, 8],
  "rizin-ocat": [20, 0],
  sriracha: [95, 2],
  sezamovo: [880, 0],
  sezam: [570, 18],
  wakame: [45, 3],
  med: [300, 0],
  gustin: [350, 0],
  kikiriki: [590, 26],
  ulje: [880, 0],
  luk: [40, 1],
  cesnjak: [4, 0.2],
  salata: [60, 5],
  krastavci: [45, 2],
  mrkva: [25, 0.6],
  kupus: [25, 1.3],
  posni: [180, 30],
  jogurt: [45, 4],
  mlijeko: [47, 3.4],
  klice: [30, 3],
  "mladi-luk": [5, 0.3],
  karfiol: [150, 11],
  patlidzan: [75, 3],
  limun: [20, 0.8],
  limeta: [20, 0.5],
  avokado: [240, 3],
  jabuka: [80, 0.4],
};

/** Gdje se što kupuje u demu */
const SHOP_OF: Record<string, string> = {
  salata: "s-dolac",
  krastavci: "s-dolac",
  rajcice: "s-dolac",
  paprike: "s-dolac",
  tikvice: "s-dolac",
  gljive: "s-dolac",
  "mladi-luk": "s-dolac",
  karfiol: "s-dolac",
  patlidzan: "s-dolac",
  limun: "s-dolac",
  rikola: "s-dolac",
  kupus: "s-dolac",
  mrkva: "s-dolac",
  posni: "s-lidl",
  jogurt: "s-lidl",
  mlijeko: "s-lidl",
  zrnati: "s-lidl",
  jaja: "s-lidl",
  bjelanjci: "s-lidl",
  kimchi: "s-ricekakis",
  gyoze: "s-pekinska",
  curry: "s-pekinska",
};

export function makeDemo(now = Date.now()): AppData {
  const r = rng(787);
  const d = defaultData();
  d.shops.splice(
    d.shops.findIndex((s) => s.id === "O"),
    0,
    {
      id: "s-lidl",
      n: "Lidl",
      type: "Supermarket",
      addr: "Zagreb, više lokacija",
      url: "https://www.lidl.hr",
      note: "Mliječno i jaja, često na akciji.",
    },
    {
      id: "s-dolac",
      n: "Tržnica Dolac",
      type: "Tržnica",
      addr: "Dolac 9, Zagreb",
      url: "",
      note: "Svježe povrće i voće, subotom ujutro.",
    },
  );

  for (const i of ITEMS) {
    const o: AppData["items"]["over"][string] = {};
    if (SHOP_OF[i.id]) o.src = SHOP_OF[i.id];
    if (!MAC[i.id] && NUTR[i.id]) [o.kcal, o.prot] = NUTR[i.id];
    if (Object.keys(o).length) d.items.over[i.id] = o;

    // zaliha: dio pun, dio nisko, dio prazno
    const x = r();
    const full = Math.max(i.min * 1.5, i.pack);
    const q = x < 0.5 ? full * (1 + Math.floor(r() * 2)) : x < 0.7 ? i.min * 0.5 : 0;
    d.stock[i.id] = { qty: round(i.u === "kom" ? Math.round(q) : q), price: PRICE[i.id] ?? null };
  }
  // dovoljno za piletinu i rižu, da barem nekoliko recepata može odmah
  for (const id of ["piletina", "basmati", "jaja", "spinat", "zrnati", "luk", "cesnjak", "soja", "brokula", "paprike"])
    d.stock[id].qty = Math.max(d.stock[id].qty, ITEMS.find((i) => i.id === id)!.pack * 2);
  for (const [id, q] of [
    ["banana", 4],
    ["jabuka", 3],
    ["kivi", 5],
    ["borovnice", 400],
    ["mandarina", 0],
  ] as [string, number][]) {
    d.stock[id] = { qty: q, price: d.stock[id]?.price ?? null };
    d.items.over[id] = { ...(d.items.over[id] || {}), src: id === "borovnice" ? "K" : "s-dolac" };
  }
  d.prepStock = { riza: 2, krumpir: 1, "teriyaki-umak": 3, "miso-paketi": 4, "egg-muffini": 6, "dumbir-kocke": 10 };

  // plan: 14 dana od jučer, jučer sve pojedeno, jedan dan prazan, a jedan s tunom za doručak
  const day = 86400000;
  d.plan.slots = {};
  let filled = autoFillPlan(d, now - day, r);
  filled = autoFillPlan(filled, now, r);
  d.plan = clone(filled.plan);
  const keys = windowKeys(now);
  const y = keys[0];
  for (const x of daySlots(d.plan, y)) x.done = true;
  delete d.plan.slots[keys[4]];
  const t = daySlots(d.plan, keys[3]);
  if (t[0]) t[0] = { ...t[0], r: "tuna", done: false };

  // troškovi ovaj i prošli mjesec
  const shops = ["K", "K", "K", "s-lidl", "s-dolac", "BIO", "AZ"];
  const notes: Record<string, string> = {
    K: "Tjedna kupovina",
    "s-lidl": "Jaja i mliječno",
    "s-dolac": "Povrće s tržnice",
    BIO: "Miso i tofu",
    AZ: "Rezanci i umaci",
  };
  for (let k = 0; k < 46; k++) {
    const tt = now - (k * 4 + 1) * day;
    const shop = shops[k % shops.length];
    const mk = monthKey(tt);
    const amount = round(shop === "K" ? 35 + r() * 30 : 6 + r() * 18);
    (d.costs[mk] ||= []).push({ id: "demo" + k, t: tt, shop, amount, note: notes[shop], est: false });
  }
  d.hist = daySlots(d.plan, y)
    .filter((x) => x.r)
    .map((x) => ({ r: x.r!, t: now - day }));
  d.updatedAt = now;
  return d;
}

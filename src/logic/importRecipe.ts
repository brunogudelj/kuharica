/* Recept iz linka: većina stranica s receptima ima schema.org/Recipe podatke (JSON-LD).
   Iz njih se uzimaju naziv, sastojci, koraci, vrijeme i broj porcija, a sastojci se spajaju s namirnicama iz zalihe. */
import type { Carb, CustomRecipe, Item } from "../data";
import type { AppData } from "../state/model";
import { allItems } from "./items";
import { newRecipeId } from "./recipes";
import { BASE_SERVINGS } from "./inventory";
import { isMass } from "./lists";

export interface ParsedRecipe {
  n: string;
  ingredients: string[];
  steps: string[];
  minutes: number | null;
  servings: number | null;
  kcal: number | null;
  prot: number | null;
  url: string;
}

export interface IngLine {
  raw: string;
  /** količina u jedinici namirnice, za cijeli recept */
  amount: number | null;
  unit: string;
  name: string;
  item: Item | null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** ISO 8601 trajanje (PT1H20M) u minute */
export function isoMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const t = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return t > 0 ? t : null;
}

const firstNum = (v: unknown): number | null => {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const m = s.replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

function isRecipe(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== "object") return false;
  const t = (o as Record<string, unknown>)["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const x of node) {
      const r = findRecipe(x);
      if (r) return r;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isRecipe(node)) return node;
  const o = node as Record<string, unknown>;
  for (const k of ["@graph", "mainEntity", "itemListElement"]) {
    const r = findRecipe(o[k]);
    if (r) return r;
  }
  return null;
}

function steps(v: unknown): string[] {
  if (typeof v === "string")
    return v
      .split(/\n+|(?<=\.)\s+(?=[A-ZČĆŠŽĐ])/)
      .map(stripHtml)
      .filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(steps);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return steps(o.itemListElement);
    if (typeof o.text === "string") return [stripHtml(o.text)];
    if (typeof o.name === "string") return [stripHtml(o.name)];
  }
  return [];
}

/** Iz HTML-a stranice izvuci recept. Najprije JSON-LD, onda popis s "ingredient" u klasi. */
export function parseRecipeHtml(html: string, url = ""): ParsedRecipe | null {
  const scripts = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const s of scripts) {
    let j: unknown;
    try {
      j = JSON.parse(s.trim());
    } catch {
      continue;
    }
    const r = findRecipe(j);
    if (!r) continue;
    const nut = (r.nutrition || {}) as Record<string, unknown>;
    const ing = (
      Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : []
    )
      .filter((x): x is string => typeof x === "string")
      .map(stripHtml)
      .filter(Boolean);
    return {
      n: stripHtml(String(r.name ?? "")) || "Recept s weba",
      ingredients: ing,
      steps: steps(r.recipeInstructions),
      minutes: isoMinutes(r.totalTime) ?? ((isoMinutes(r.prepTime) ?? 0) + (isoMinutes(r.cookTime) ?? 0) || null),
      servings: firstNum(r.recipeYield),
      kcal: firstNum(nut.calories),
      prot: firstNum(nut.proteinContent),
      url,
    };
  }
  // bez JSON-LD: <li> unutar elementa kojem klasa sadrži "ingredient"
  const block = html.match(/class="[^"]*ingredient[^"]*"[\s\S]*?<\/(ul|ol|div)>/i);
  const ing = block
    ? [...block[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripHtml(m[1])).filter(Boolean)
    : [];
  if (!ing.length) return null;
  const title =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<title>([^<]+)<\/title>/i)?.[1] ??
    "";
  return {
    n: stripHtml(title) || "Recept s weba",
    ingredients: ing,
    steps: [],
    minutes: null,
    servings: null,
    kcal: null,
    prot: null,
    url,
  };
}

/** Zalijepljeni tekst: redovi s brojem na početku su sastojci, dulji ostali redovi su koraci */
export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text
    .split(/\n+/)
    .map((x) => x.replace(/^[-•*·\s]+/, "").trim())
    .filter(Boolean);
  const ing: string[] = [];
  const st: string[] = [];
  for (const l of lines.slice(1)) {
    if (/porcij|osob|serving|\d+\s*min\b/i.test(l) && l.length < 40) continue;
    if (/^(\d|½|¼|¾)/.test(l) && l.length < 90) ing.push(l);
    else if (l.length > 25) st.push(l.replace(/^\d+[.)]\s*/, ""));
  }
  const serv = text.match(/(\d+)\s*(porcij|osob|serving)/i);
  const min = text.match(/(\d+)\s*min/i);
  return {
    n: lines[0] ?? "Recept",
    ingredients: ing,
    steps: st,
    minutes: min ? Number(min[1]) : null,
    servings: serv ? Number(serv[1]) : null,
    kcal: null,
    prot: null,
    url: "",
  };
}

/** Jedinice: koliko grama/ml je jedna (za žlice i šalice približno) */
const UNITS: [RegExp, string, number][] = [
  [/^(kg|kila|kilograma?)$/, "g", 1000],
  [/^(dag|dkg|deka)$/, "g", 10],
  [/^(g|gr|grama?|grams?)$/, "g", 1],
  [/^(l|lit|litra?|litre?|liters?)$/, "ml", 1000],
  [/^(dl|decilitra?)$/, "ml", 100],
  [/^(ml|mililitara?)$/, "ml", 1],
  [/^(zlica|zlice|zlicu|tbsp|tablespoons?)$/, "ml", 15],
  [/^(zlicica|zlicice|zlicicu|tsp|teaspoons?)$/, "ml", 5],
  [/^(salica|salice|salicu|casa|case|casu|cups?)$/, "ml", 240],
  [/^(oz|ounces?)$/, "g", 28],
  [/^(lb|lbs|pounds?)$/, "g", 454],
  [/^(kom|komad|komada|kriska|kriske|cesanj|cesnja|rezanj|rezanjs|pieces?|cloves?)$/, "kom", 1],
];

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/** Engleski i česti hrvatski nazivi koji se ne poklapaju po početku riječi */
const SYN: [RegExp, string][] = [
  [/chicken|piletin|pilec|pileca/, "piletina"],
  [/ground turkey|mljeven.*puret/, "pur-mlj"],
  [/turkey|puretin|purec/, "pur-prsa"],
  [/beef|junetin|govedin|junec/, "junetina"],
  [/pork|svinj/, "svinjetina"],
  [/salmon|losos|pastrv/, "losos"],
  [/shrimp|prawn|kozic|skamp/, "kozice"],
  [/tuna|tunj/, "tuna"],
  [/rice vinegar|rizin.*ocat/, "rizin-ocat"],
  [/rice noodle|rizin.*rezanc|rice stick/, "rizini"],
  [/ramen|noodle|rezanc/, "ramen"],
  [/jasmine|sushi rice/, "jasmin"],
  [/\brice\b|\briz[aeiu]\b|basmati/, "basmati"],
  [/pasta|tjestenin|spaget|penne|fusill/, "tjestenina"],
  [/potato|krumpir/, "krumpir"],
  [/egg white|bjelanj/, "bjelanjci"],
  [/\beggs?\b|\bjaj[ae]?\b/, "jaja"],
  [/spring onion|scallion|green onion|mlad.*luk/, "mladi-luk"],
  [/onion|\bluk\b|\bluka\b/, "luk"],
  [/garlic|cesnjak|cesnja/, "cesnjak"],
  [/ginger|dumbir/, "dumbir"],
  [/soy sauce|soja umak|soy|umak od soje|\bsoj[ae]\b/, "soja"],
  [/sesame oil|sezamov.*ulj/, "sezamovo"],
  [/sesame|sezam/, "sezam"],
  [/olive oil|maslinov|\bulj[ae]\b|\boil\b/, "ulje"],
  [/coconut milk|kokosov/, "kokos"],
  [/broccoli|brokul/, "brokula"],
  [/bell pepper|paprik|\bpeppers?\b/, "paprike"],
  [/carrot|mrkv/, "mrkva"],
  [/spinach|spinat/, "spinat"],
  [/tomato paste|koncentrat/, "koncentrat"],
  [/tomato|rajcic|paradajz/, "rajcice"],
  [/cucumber|krastav/, "krastavci"],
  [/zucchini|courgette|tikvic/, "tikvice"],
  [/mushroom|gljiv|sampinjon/, "gljive"],
  [/cauliflower|karfiol|cvjetac/, "karfiol"],
  [/eggplant|aubergine|patlidzan/, "patlidzan"],
  [/cabbage|kupus/, "kupus"],
  [/peas|grasak|graska/, "grasak"],
  [/green beans|mahun/, "mahune"],
  [/black beans|crn.*grah/, "crni-grah"],
  [/edamame/, "edamame"],
  [/smoked tofu|dimljen.*tofu/, "tofu-dim"],
  [/tofu/, "tofu"],
  [/honey|\bmed\b|\bmeda\b/, "med"],
  [/lime|limet/, "limeta"],
  [/lemon|limun/, "limun"],
  [/feta/, "feta"],
  [/mozzarell/, "mozzarella"],
  [/cottage|zrnat/, "zrnati"],
  [/yogh?urt|jogurt/, "jogurt"],
  [/milk|mlijek/, "mlijeko"],
  [/peanut|kikiriki/, "kikiriki"],
  [/sriracha/, "sriracha"],
  [/oyster/, "oyster"],
  [/curry paste|curry pasta/, "curry"],
  [/miso/, "miso"],
  [/kimchi/, "kimchi"],
  [/wakame/, "wakame"],
  [/stock|broth|temeljac|bujon/, "temeljac"],
  [/cornstarch|corn starch|gustin|skrob/, "gustin"],
  [/avocado|avokad/, "avokado"],
  [/rocket|arugula|rikol/, "rikola"],
  [/lettuce|zelena salata/, "salata"],
  [/tortilla|wrap/, "wrap"],
  [/bacon|pancett|spek/, "spek"],
  [/sausage|kobasic/, "kobasice"],
  [/\bham\b|sunk/, "sunka"],
  [/apple|jabuk/, "jabuka"],
  [/banana/, "banana"],
  [/blueberr|borovnic/, "borovnice"],
];

/** Pronađi namirnicu iz zalihe za naziv sastojka */
export function matchItem(d: AppData, name: string): Item | null {
  const n = norm(name);
  if (!n) return null;
  const items = allItems(d);
  for (const [re, id] of SYN) if (re.test(n)) return items.find((i) => i.id === id) ?? null;
  // vlastite i ostale namirnice: početak riječi (padeži: "piletine" ~ "piletina")
  const words = n.split(" ").filter((w) => w.length >= 3);
  let best: Item | null = null;
  let score = 0;
  for (const i of items) {
    const iw = norm(i.n)
      .split(" ")
      .filter((w) => w.length >= 3);
    let s = 0;
    for (const w of iw)
      if (
        words.some((x) => x.slice(0, Math.min(5, x.length, w.length)) === w.slice(0, Math.min(5, x.length, w.length)))
      )
        s++;
    const sc = iw.length ? s / iw.length : 0;
    if (sc > score) {
      score = sc;
      best = i;
    }
  }
  return score >= 0.5 ? best : null;
}

/** "200 g pilećih prsa" → količina, jedinica, naziv, namirnica */
export function parseIngredient(d: AppData, raw: string): IngLine {
  const t = raw.replace(/\(.*?\)/g, " ").trim();
  const m = t.match(
    /^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\s*\/\s*\d+|\d*\s*[½¼¾⅓⅔])\s*([^\s\d]+)?\s*(.*)$/,
  );
  let amount: number | null = null;
  let unit = "";
  let rest = t;
  if (m) {
    const q = m[1].replace(",", ".").trim();
    if (/\//.test(q)) {
      const [a, b] = q.split("/").map((x) => Number(x.trim()));
      amount = b ? a / b : null;
    } else if (/[½¼¾⅓⅔]/.test(q)) {
      const whole = Number(q.replace(/[½¼¾⅓⅔]/, "").trim() || 0);
      amount = whole + FRACTIONS[q.slice(-1)];
    } else amount = Number(q.split(/[-–]/).pop()!.trim());
    const u = norm(m[2] ?? "").replace(/\s/g, "");
    const hit = UNITS.find(([re]) => re.test(u));
    if (hit) {
      unit = hit[1];
      amount = amount != null ? amount * hit[2] : null;
      rest = m[3];
    } else rest = `${m[2] ?? ""} ${m[3]}`.trim();
  }
  const item = matchItem(d, rest);
  if (item && amount != null) {
    // jedinica namirnice: komadi ostaju komadi; grami za komade → 1 komad na ~100 g
    if (!isMass(item.u) && unit && unit !== "kom") amount = Math.max(1, Math.round(amount / 100));
    // bez jedinice za grame/ml: npr. "1 piletina" → oko 100 g po komadu
    if (isMass(item.u) && (!unit || unit === "kom")) amount = amount * 100;
  }
  return { raw, amount, unit: unit || (item ? item.u : ""), name: rest, item };
}

/** Pretpostavka priloga iz sastojaka */
function guessCarb(lines: IngLine[]): Carb {
  const ids = lines.map((l) => l.item?.id);
  if (ids.some((x) => x === "basmati" || x === "jasmin")) return "Riža";
  if (ids.includes("krumpir")) return "Krumpir";
  if (ids.some((x) => x === "tjestenina" || x === "rizini" || x === "ramen")) return "Tjestenina";
  return "Ostalo";
}

function guessMethod(p: ParsedRecipe): string {
  const t = norm([p.n, ...p.steps].join(" "));
  if (/air ?fryer|airfryer|friteza na vruci zrak/.test(t)) return "Air fryer";
  if (/\bwok/.test(t)) return "Wok";
  if (/pecnic|oven|bake/.test(t)) return "Pećnica";
  if (/lonac|lonc|pot\b|simmer|krcka/.test(t)) return "Lonac";
  return "Tava";
}

/** Nacrt vlastitog recepta: količine po 1,5 porcije (kao u aplikaciji), neprepoznato ide u "ostalo" */
export function toDraft(
  d: AppData,
  p: ParsedRecipe,
  pre?: { lines: IngLine[]; method?: string; carb?: string },
): { draft: CustomRecipe; lines: IngLine[]; matched: number } {
  const lines = pre?.lines ?? p.ingredients.map((x) => parseIngredient(d, x));
  const serv = p.servings && p.servings > 0 ? p.servings : 2;
  const use: Record<string, number> = {};
  const extra: string[] = [];
  for (const l of lines) {
    if (l.item && l.amount != null && l.amount > 0) {
      const a = (l.amount / serv) * BASE_SERVINGS;
      use[l.item.id] = Math.round(((use[l.item.id] || 0) + a) * 10) / 10;
    } else extra.push(l.raw);
  }
  const method = pre?.method || guessMethod(p);
  const carb = (["Riža", "Krumpir", "Tjestenina", "Ostalo"] as Carb[]).find((c) => c === pre?.carb) ?? guessCarb(lines);
  return {
    draft: {
      id: newRecipeId(p.n),
      n: p.n,
      c: carb,
      d: `${method}${p.minutes ? ` · ${p.minutes} min` : ""}`,
      use,
      extra: p.url ? [...extra, `Izvor: ${p.url}`] : extra,
      st: p.steps,
    },
    lines,
    matched: Object.keys(use).length,
  };
}

/** Dohvati stranicu. Preglednik ne smije čitati tuđe stranice izravno (CORS), pa ide preko javnog posrednika. */
export async function fetchPage(url: string, signal?: AbortSignal): Promise<string> {
  const tries = [
    url,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];
  let last: unknown = null;
  for (const u of tries) {
    try {
      const r = await fetch(u, { signal });
      if (r.ok) {
        const t = await r.text();
        if (t.length > 200) return t;
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Stranica se ne može dohvatiti.");
}

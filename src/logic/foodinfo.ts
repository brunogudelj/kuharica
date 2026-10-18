/* Podaci o namirnici iz baze proizvoda: Open Food Facts (besplatno, bez ključa, puno proizvoda iz hrvatskih dućana)
   i Claude s pretragom weba kad proizvoda nema u bazi. Vrijednosti su na 100 g/ml, kao na deklaraciji. */
import type { Item } from "../data";
import { ClaudeError } from "./claude";
import { CLAUDE_MODEL } from "./claude";

export interface FoodHit {
  name: string;
  brand: string;
  ean: string;
  /** veličina pakiranja i jedinica s deklaracije (npr. 400 g) */
  pack: number | null;
  unit: "g" | "ml" | null;
  quantity: string;
  kcal: number | null;
  prot: number | null;
  carb: number | null;
  fat: number | null;
  img: string;
  url: string;
  source: "off" | "claude";
}

const OFF = "https://world.openfoodfacts.org";
const FIELDS =
  "code,product_name,product_name_hr,generic_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,image_front_small_url";

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return typeof x === "number" && isFinite(x) ? Math.round(x * 10) / 10 : null;
};

/** "400 g", "0,5 l", "1 kg", "6 x 100 g" → količina u g ili ml */
export function parseQuantity(q: string): { pack: number; unit: "g" | "ml" } | null {
  const t = q.toLowerCase().replace(",", ".");
  const multi = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|dl|l)\b/);
  const m = multi ? null : t.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|dl|l)\b/);
  const val = multi ? Number(multi[1]) * Number(multi[2]) : m ? Number(m[1]) : NaN;
  const u = multi ? multi[3] : m?.[2];
  if (!u || !(val > 0)) return null;
  const f: Record<string, [number, "g" | "ml"]> = {
    g: [1, "g"],
    kg: [1000, "g"],
    ml: [1, "ml"],
    cl: [10, "ml"],
    dl: [100, "ml"],
    l: [1000, "ml"],
  };
  const [k, unit] = f[u];
  return { pack: Math.round(val * k * 10) / 10, unit };
}

type OffProduct = Record<string, unknown> & { nutriments?: Record<string, unknown> };

export function fromOff(p: OffProduct): FoodHit | null {
  const name = String(p.product_name_hr || p.product_name || p.generic_name || "").trim();
  const code = String(p.code ?? "");
  if (!name && !code) return null;
  const nu = p.nutriments ?? {};
  const kj = n(nu["energy_100g"]);
  const qty = String(p.quantity ?? "");
  const pq = n(p.product_quantity);
  const pu = String(p.product_quantity_unit ?? "").toLowerCase();
  const parsed =
    parseQuantity(qty) ?? (pq && (pu === "g" || pu === "ml") ? { pack: pq, unit: pu as "g" | "ml" } : null);
  return {
    name: name || code,
    brand: String(p.brands ?? "")
      .split(",")[0]
      .trim(),
    ean: code,
    pack: parsed?.pack ?? null,
    unit: parsed?.unit ?? null,
    quantity: qty,
    kcal: n(nu["energy-kcal_100g"]) ?? (kj != null ? Math.round(kj / 4.184) : null),
    prot: n(nu["proteins_100g"]),
    carb: n(nu["carbohydrates_100g"]),
    fat: n(nu["fat_100g"]),
    img: String(p.image_front_small_url ?? ""),
    url: code ? `${OFF}/product/${code}` : "",
    source: "off",
  };
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(url, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error("Baza proizvoda trenutno nije dostupna. Provjeri internet ili pokušaj kasnije.");
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Baza proizvoda je vratila grešku ${r.status}. Pokušaj malo kasnije.`);
  return r.json();
}

/** Proizvod po barkodu */
export async function offBarcode(ean: string, signal?: AbortSignal): Promise<FoodHit | null> {
  const code = ean.replace(/\D/g, "");
  if (code.length < 6) return null;
  const j = (await getJson(`${OFF}/api/v2/product/${code}.json?fields=${FIELDS}`, signal)) as {
    status?: number;
    product?: OffProduct;
  } | null;
  return j?.status === 1 && j.product ? fromOff({ code, ...j.product }) : null;
}

/** Pretraga po nazivu i marki; prvo proizvodi iz Hrvatske, pa ostali */
export async function offSearch(q: string, signal?: AbortSignal): Promise<FoodHit[]> {
  const term = q.trim();
  if (!term) return [];
  if (/^\d{8,14}$/.test(term)) {
    const one = await offBarcode(term, signal);
    return one ? [one] : [];
  }
  const base = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=15&sort_by=unique_scans_n&fields=${FIELDS}`;
  const run = async (url: string) => {
    const j = (await getJson(url, signal)) as { products?: OffProduct[] } | null;
    return (j?.products ?? []).map(fromOff).filter((x): x is FoodHit => !!x);
  };
  const hr = await run(`${base}&tagtype_0=countries&tag_contains_0=contains&tag_0=croatia`);
  if (hr.length >= 3) return hr;
  const world = await run(base);
  const seen = new Set(hr.map((h) => h.ean));
  return [...hr, ...world.filter((h) => !seen.has(h.ean))].slice(0, 15);
}

/** Claude s pretragom weba: za proizvod kojeg nema u bazi (npr. nova mješavina iz Kauflanda) */
export async function claudeFood(key: string, q: string, signal?: AbortSignal): Promise<FoodHit[]> {
  const prompt = `Pronađi na webu nutritivne vrijednosti s deklaracije za proizvod: "${q}" (kupuje se u Hrvatskoj, npr. Kaufland, Konzum, Lidl, Spar).
Traži stranicu proizvođača ili trgovine. Vrati do 3 najbliža proizvoda, vrijednosti na 100 g ili 100 ml.
Vrati SAMO JSON, bez drugog teksta:
{"products": [{"name": "puni naziv proizvoda", "brand": "marka", "ean": "barkod ili prazno", "quantity": "npr. 400 g", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "url": "izvor"}]}
Ako vrijednost ne nađeš, upiši null. Ako proizvod ne postoji, vrati {"products": []}.`;
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ClaudeError("Nema veze s Claudeom. Provjeri internet.");
  }
  if (res.status === 401) throw new ClaudeError("Claude API ključ nije ispravan. Provjeri ga u Postavkama.");
  if (!res.ok) throw new ClaudeError(`Claude je vratio grešku ${res.status}.`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  return fromClaudeFood(text);
}

export function fromClaudeFood(text: string): FoodHit[] {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let j: { products?: Record<string, unknown>[] };
  try {
    j = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new ClaudeError("Claude nije vratio podatke u očekivanom obliku. Pokušaj ponovno.");
  }
  return (j.products ?? []).map((p) => {
    const quantity = String(p.quantity ?? "");
    const q = parseQuantity(quantity);
    return {
      name: String(p.name ?? "").trim(),
      brand: String(p.brand ?? "").trim(),
      ean: String(p.ean ?? "").replace(/\D/g, ""),
      pack: q?.pack ?? null,
      unit: q?.unit ?? null,
      quantity,
      kcal: n(p.kcal),
      prot: n(p.protein),
      carb: n(p.carbs),
      fat: n(p.fat),
      img: "",
      url: String(p.url ?? ""),
      source: "claude" as const,
    };
  });
}

/** Što se iz pogotka upisuje u namirnicu. Kalorije samo za g/ml (deklaracija je na 100). */
export function hitPatch(
  item: Pick<Item, "u" | "alias" | "n">,
  h: FoodHit,
): Partial<Pick<Item, "kcal" | "prot" | "carb" | "fat" | "brand" | "ean" | "pack" | "alias">> {
  const mass = item.u === "g" || item.u === "ml";
  const alias = [...(item.alias ?? [])];
  const full = [h.brand, h.name].filter(Boolean).join(" ").trim();
  if (full && full.toLowerCase() !== item.n.toLowerCase() && !alias.some((a) => a.toLowerCase() === full.toLowerCase()))
    alias.push(full);
  return {
    ...(mass && h.kcal != null ? { kcal: h.kcal } : {}),
    ...(mass && h.prot != null ? { prot: h.prot } : {}),
    ...(mass && h.carb != null ? { carb: h.carb } : {}),
    ...(mass && h.fat != null ? { fat: h.fat } : {}),
    ...(h.brand ? { brand: h.brand } : {}),
    ...(h.ean ? { ean: h.ean } : {}),
    ...(h.pack && h.unit === item.u ? { pack: h.pack } : {}),
    ...(alias.length ? { alias } : {}),
  };
}

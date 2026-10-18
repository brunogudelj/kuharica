/* Recepti za korisnika: ugrađeni (s njegovim izmjenama) + vlastiti.
   Recept može biti složen od drugih recepata ("tuna steak s krumpirom" = tuna steak + hrskavi krumpir + miso juha):
   dijelovi se razlažu na namirnice i prep, pa kuhanje, kupovina, cijena i kalorije rade kao za običan recept. */
import { RBY, RECIPES, REC_USE_PREP } from "../data";
import { prepInv, prepName } from "./preps";
import { plural, round } from "./format";
import type { CustomRecipe, Recipe, Use } from "../data";
import type { AppData } from "../state/model";
import { itemOf } from "./items";

/** Broj za tekst sastojka (decimalni zarez, bez razmaka tisućica, da ga scaleText može skalirati) */
const num = (a: number) => String(Math.round(a * 100) / 100).replace(".", ",");

export const isBuiltinRecipe = (id: string) => id in RBY;

/** Vrste jela ugrađenih recepata, iz naziva i načina pripreme */
const KIND_RULES: [RegExp, string][] = [
  [/juha|miso|temeljac|čorb|corb/i, "juha"],
  [/omlet|fritat/i, "omlet"],
  [/\bwok\b|pad thai|bulgogi|teriyaki|pržen|przen/i, "wok"],
  [/gula|varivo|grah|čobanac/i, "varivo"],
  [/curry|kari/i, "curry"],
  [/rezan|ramen|udon|champon|pad thai|soba|noodle/i, "rezanci"],
  [/tjesten|pasta|špaget|spaget|penne|lazanj/i, "pasta"],
  [/rižot|rizot/i, "rizoto"],
  [/poke|bowl/i, "bowl"],
  [/wrap|tortilj|burrito/i, "wrap"],
  [/burger/i, "hamburger"],
  [/burek|pita\b|zeljanica|sirnica/i, "burek"],
  [/pohan|panko|schnitzel/i, "pohano"],
  [/tandoori|pečen|pecen|grill|roštilj|rostilj|losos s/i, "pecenje"],
  [/salat/i, "salata"],
];

export function guessKinds(n: string, d = ""): string[] {
  const t = `${n} ${d.split(" · ")[0]}`;
  return [...new Set(KIND_RULES.filter(([re]) => re.test(t)).map(([, k]) => k))];
}

/** Namirnice i prep recepta: `prep` dodaje sirove sastojke kad ga nema, `prepIn` ih zamjenjuje kad ga ima */
function ownForm(r: Recipe): { use: Use; prep: Record<string, number>; prepIn: Record<string, number> } {
  if (r.prep)
    return { use: { ...r.use }, prep: Object.fromEntries(r.prep), prepIn: Object.fromEntries(r.prepIn ?? []) };
  return { use: { ...r.use }, prep: {}, prepIn: Object.fromEntries(REC_USE_PREP[r.id] ?? []) };
}

/** Faktor dijela: porcije dijela po porciji složenog recepta → množitelj njegovih količina (za 1,5 porcija) */
const partFactor = (sub: Recipe, k: number) => (sub.side ? k * 1.5 : k);

function toRecipeDeep(d: AppData, r: CustomRecipe, seen: Set<string>): Recipe {
  const use: Use = { ...r.use };
  const prep: Record<string, number> = { ...(r.prep ?? {}) };
  const prepIn: Record<string, number> = { ...(r.prepIn ?? {}) };
  const parts: [string, number][] = [];
  const next = new Set(seen).add(r.id);
  for (const [pid, k] of Object.entries(r.parts ?? {})) {
    if (!(k > 0) || next.has(pid) || next.size > 6) continue;
    const sub = resolve(d, pid, next);
    if (!sub) continue;
    parts.push([pid, k]);
    const f = partFactor(sub, k);
    const o = ownForm(sub);
    for (const [id, a] of Object.entries(o.use)) use[id] = round((use[id] || 0) + a * f);
    for (const [id, a] of Object.entries(o.prep)) prep[id] = round((prep[id] || 0) + a * f);
    for (const [id, a] of Object.entries(o.prepIn)) prepIn[id] = round((prepIn[id] || 0) + a * f);
  }
  const ownIng = Object.entries(r.use).map(([id, a]) => {
    const it = itemOf(d, id);
    if (!it) return `<span class=g>${num(a)}</span> (obrisana namirnica)`;
    return `<span class=g>${num(a)} ${it.u === "kom" ? "kom" : it.u}</span> ${it.n}`;
  });
  const prepList = Object.entries(prep).filter(([p, n]) => prepInv(d, p) && n > 0);
  const ownPrep = Object.entries(r.prep ?? {}).filter(([p, n]) => prepInv(d, p) && n > 0);
  const ingPrep = ownPrep.map(
    ([p, n]) => `<span class=g>${num(n)} ${plural(n, prepInv(d, p)!.unit)}</span> ${prepName(d, p)} (prep)`,
  );
  // dijelovi u sastojcima: količina je za 1,5 porcija, kao i ostalo
  const ingParts = parts.map(([pid, k]) => {
    const n = k * 1.5;
    return `<span class=g>${num(n)} ${plural(n, "porcija")}</span> ${resolve(d, pid, next)?.n ?? "recept"} (recept)`;
  });
  return {
    id: r.id,
    n: r.n,
    c: r.c,
    d: r.d,
    use,
    ing: [...ingParts, ...ingPrep, ...ownIng, ...r.extra],
    st: r.st,
    custom: true,
    // vlastiti recept uvijek ima prep popis (i prazan), da se ne miješa s ugrađenim REC_USE_PREP
    prep: prepList,
    ...(Object.keys(prepIn).length
      ? { prepIn: Object.entries(prepIn).filter(([p, n]) => prepInv(d, p) && n > 0) }
      : {}),
    kinds: r.kinds ?? [],
    ...(parts.length ? { parts } : {}),
    ...(r.side ? { side: r.side } : {}),
    ...(r.two ? { two: true } : {}),
    ...(isBuiltinRecipe(r.id) ? { edited: true } : {}),
  };
}

/** Recept po id-u, bez predmemorije (za dijelove složenih recepata) */
function resolve(d: AppData, id: string, seen: Set<string>): Recipe | undefined {
  const own = d.recipes.find((x) => x.id === id);
  if (own) return toRecipeDeep(d, own, seen);
  const b = RBY[id];
  return b && d.settings.builtin !== false ? { ...b, kinds: guessKinds(b.n, b.d) } : undefined;
}

export function toRecipe(d: AppData, r: CustomRecipe): Recipe {
  return toRecipeDeep(d, r, new Set());
}

/** Ugrađeni recept kao vlastiti, za uređivanje (količine i prep ostaju, ostali sastojci idu u "ostalo") */
export function toCustom(d: AppData, r: Recipe): CustomRecipe {
  const own = d.recipes.find((x) => x.id === r.id);
  if (own) return own;
  // korijeni riječi praćenih namirnica ("Basmati riža" → "basm", "riž"), da se ne ponove u "ostalo"
  const roots = Object.keys(r.use).flatMap((id) =>
    (itemOf(d, id)?.n ?? "")
      .toLowerCase()
      .split(/[^a-zčćđšž]+/)
      .filter((w) => w.length >= 4)
      .map((w) => w.slice(0, Math.min(4, w.length - 1))),
  );
  const extra = r.ing
    .map((x) => x.replace(/<[^>]+>/g, "").trim())
    .filter(
      (x) =>
        x &&
        !x
          .toLowerCase()
          .split(/[^a-zčćđšž]+/)
          .some((w) => roots.some((p) => w.startsWith(p))),
    );
  return {
    id: r.id,
    n: r.n,
    c: r.c,
    d: r.d,
    use: { ...r.use },
    ...(r.prep?.length ? { prep: Object.fromEntries(r.prep) } : {}),
    ...(!r.prep && REC_USE_PREP[r.id] ? { prepIn: Object.fromEntries(REC_USE_PREP[r.id]) } : {}),
    extra,
    st: r.st,
    kinds: r.kinds ?? guessKinds(r.n, r.d),
    ...(r.side ? { side: r.side } : {}),
    ...(r.two ? { two: true } : {}),
  };
}

const cache = new WeakMap<
  CustomRecipe[],
  { items: unknown; builtin: boolean; all: Recipe[]; map: Map<string, Recipe> }
>();

/** Ugrađeni recepti (ako nisu isključeni u Postavkama; uređeni zamjenjuju original) + vlastiti */
export function allRecipes(d: AppData): Recipe[] {
  const builtin = d.settings.builtin !== false;
  let c = cache.get(d.recipes);
  if (!c || c.items !== d.items || c.builtin !== builtin) {
    const own = new Map(d.recipes.map((r) => [r.id, toRecipe(d, r)]));
    const base = builtin ? RECIPES.map((r) => own.get(r.id) ?? { ...r, kinds: guessKinds(r.n, r.d) }) : [];
    const all = base.concat(d.recipes.filter((r) => !builtin || !isBuiltinRecipe(r.id)).map((r) => own.get(r.id)!));
    c = { items: d.items, builtin, all, map: new Map(all.map((r) => [r.id, r])) };
    cache.set(d.recipes, c);
  }
  return c.all;
}

export function recipeOf(d: AppData, id: string): Recipe | undefined {
  allRecipes(d);
  return cache.get(d.recipes)!.map.get(id);
}

export const recipeName = (d: AppData, id: string) => recipeOf(d, id)?.n ?? "Obrisani recept";

/** Recepti koji koriste ovaj recept kao dio */
export const usedIn = (d: AppData, id: string) => allRecipes(d).filter((r) => r.parts?.some(([p]) => p === id));

export function newRecipeId(n: string) {
  const slug = n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `r-${slug || "recept"}-${Math.random().toString(36).slice(2, 6)}`;
}

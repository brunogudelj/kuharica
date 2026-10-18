/* Prep recepti: ugrađeni (s izmjenama korisnika) + vlastiti. Prep je recept kao i ostali (namirnice, koraci,
   vrste jela, dijelovi), samo što se radi unaprijed i daje zalihu pripremljenog (npr. 3 porcije umaka). */
import { PBY, PREP, PREP_INV } from "../data";
import type { CustomPrep, PrepInv, PrepRecipe, UnitId } from "../data";
import type { AppData } from "../state/model";
import { clone } from "../state/model";
import { itemOf } from "./items";
import { plural, round } from "./format";

export const isCustomPrep = (id: string) => id.startsWith("pp-");
export const isBuiltinPrep = (id: string) => id in PBY;

const num = (a: number) => String(round(a)).replace(".", ",");

export function toPrep(d: AppData | undefined, c: CustomPrep): PrepRecipe {
  const ing = Object.entries(c.use).map(([id, a]) => {
    const it = d ? itemOf(d, id) : undefined;
    return it
      ? `<span class=g>${num(a)} ${it.u}</span> ${it.n}`
      : `<span class=g>${num(a)}</span> (obrisana namirnica)`;
  });
  const base = PBY[c.id];
  return {
    id: c.id,
    n: c.n,
    k: c.k,
    time: c.time || "",
    yieldTxt: `${num(c.make)} ${plural(c.make, c.unit)}`,
    keep: c.keep || "",
    use: c.use,
    ing: [...ing, ...c.extra],
    st: c.st,
    tip: c.tip ?? base?.tip ?? "",
    for: base?.for ?? [],
    kinds: c.kinds ?? [],
    custom: true,
    ...(base ? { edited: true } : {}),
    ...(c.prep && Object.keys(c.prep).length ? { prep: Object.entries(c.prep).filter(([, n]) => n > 0) } : {}),
  };
}

const cache = new WeakMap<CustomPrep[], { items: unknown; builtin: boolean; all: PrepRecipe[] }>();

/** Svi prep recepti: ugrađeni (ako nisu isključeni u Postavkama; uređeni zamjenjuju original) + vlastiti */
export function allPreps(d?: AppData): PrepRecipe[] {
  const builtin = d?.settings.builtin !== false;
  const base = builtin ? PREP : [];
  if (!d?.preps?.length) return base;
  let c = cache.get(d.preps);
  if (!c || c.items !== d.items || c.builtin !== builtin) {
    const own = new Map(d.preps.map((x) => [x.id, toPrep(d, x)]));
    const all = [
      ...base.map((p) => own.get(p.id) ?? p),
      ...d.preps.filter((x) => !builtin || !isBuiltinPrep(x.id)).map((x) => own.get(x.id)!),
    ];
    c = { items: d.items, builtin, all };
    cache.set(d.preps, c);
  }
  return c.all;
}

export function prepOf(d: AppData | undefined, id: string): PrepRecipe | undefined {
  return allPreps(d).find((p) => p.id === id);
}

/** Inventar prepa: koliko jedinica daje tura i koje sirove sastojke zamjenjuje jedna jedinica */
export function prepInv(d: AppData | undefined, id: string): PrepInv | undefined {
  const c = d?.preps?.find((x) => x.id === id);
  if (!c) return PREP_INV[id];
  const make = c.make > 0 ? c.make : 1;
  const per: Record<string, number> = Object.fromEntries(Object.entries(c.use).map(([k, a]) => [k, a / make]));
  // dio (drugi prep) bez pripremljenog troši svoje sirove sastojke
  for (const [sub, n] of Object.entries(c.prep ?? {})) {
    if (sub === id || !d) continue;
    const sp = prepInvShallow(d, sub);
    if (sp) for (const [k, a] of Object.entries(sp.per)) per[k] = (per[k] || 0) + (a * n) / make;
  }
  return { make, unit: c.unit, per };
}

/** Bez dijelova (da dio dijela ne ide u beskonačnost) */
function prepInvShallow(d: AppData, id: string): PrepInv | undefined {
  const c = d.preps.find((x) => x.id === id);
  if (!c) return PREP_INV[id];
  const make = c.make > 0 ? c.make : 1;
  return { make, unit: c.unit, per: Object.fromEntries(Object.entries(c.use).map(([k, a]) => [k, a / make])) };
}

export const prepName = (d: AppData | undefined, id: string) => prepOf(d, id)?.n ?? "Obrisani prep";
export const prepUnit = (d: AppData | undefined, id: string): UnitId => prepInv(d, id)?.unit ?? "porcija";

/** Ugrađeni prep kao vlastiti, za uređivanje */
export function toCustomPrep(d: AppData, p: PrepRecipe): CustomPrep {
  const own = d.preps.find((x) => x.id === p.id);
  if (own) return own;
  const inv = prepInv(d, p.id);
  const roots = Object.keys(p.use).flatMap((id) =>
    (itemOf(d, id)?.n ?? "")
      .toLowerCase()
      .split(/[^a-zčćđšž]+/)
      .filter((w) => w.length >= 4)
      .map((w) => w.slice(0, Math.min(4, w.length - 1))),
  );
  const extra = p.ing
    .map((x) => x.replace(/<[^>]+>/g, "").trim())
    .filter(
      (x) =>
        x &&
        !x
          .toLowerCase()
          .split(/[^a-zčćđšž]+/)
          .some((w) => roots.some((r) => w.startsWith(r))),
    );
  return {
    id: p.id,
    n: p.n,
    k: p.k,
    time: p.time,
    keep: p.keep,
    make: inv?.make ?? 1,
    unit: inv?.unit ?? "porcija",
    use: { ...p.use },
    extra,
    st: p.st,
    kinds: p.kinds ?? [],
    ...(p.tip ? { tip: p.tip } : {}),
    ...(p.prep?.length ? { prep: Object.fromEntries(p.prep) } : {}),
  };
}

export function newPrepId(n: string) {
  const slug = n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `pp-${slug || "prep"}-${Math.random().toString(36).slice(2, 6)}`;
}

export function saveCustomPrep(src: AppData, p: CustomPrep): { data: AppData; msg: string } {
  const d = clone(src);
  const i = d.preps.findIndex((x) => x.id === p.id);
  if (i >= 0) d.preps[i] = p;
  else d.preps.push(p);
  return { data: d, msg: i >= 0 || isBuiltinPrep(p.id) ? `${p.n} je spremljen.` : `${p.n} je dodan u prep.` };
}

/** Obriši vlastiti prep i njegovo pripremljeno; recepti koji ga koriste prelaze na sirove sastojke.
 * Za uređeni ugrađeni prep samo vrati original. */
export function removeCustomPrep(src: AppData, id: string): { data: AppData; msg: string } {
  const d = clone(src);
  const p = d.preps.find((x) => x.id === id);
  if (!p) return { data: src, msg: "" };
  d.preps = d.preps.filter((x) => x.id !== id);
  if (isBuiltinPrep(id)) return { data: d, msg: `${p.n} je vraćen na original.` };
  const per = (a: number) => a / (p.make || 1);
  delete d.prepStock[id];
  d.recipes = d.recipes.map((r) => {
    const k = r.prep?.[id];
    if (!k) return r;
    const use = { ...r.use };
    for (const [iid, a] of Object.entries(p.use)) use[iid] = round((use[iid] || 0) + per(a) * k);
    const prep = { ...r.prep };
    delete prep[id];
    return { ...r, use, prep };
  });
  d.preps = d.preps.map((x) => {
    const k = x.prep?.[id];
    if (!k) return x;
    const use = { ...x.use };
    for (const [iid, a] of Object.entries(p.use)) use[iid] = round((use[iid] || 0) + per(a) * k);
    const prep = { ...x.prep };
    delete prep[id];
    return { ...x, use, prep };
  });
  return { data: d, msg: `${p.n} je obrisan. Recepti koji su ga koristili sada imaju njegove sastojke.` };
}

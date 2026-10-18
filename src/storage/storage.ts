import { del, get, set } from "idb-keyval";
import { ITEMS, NEW_ITEMS, OM_PRESETS, PBY, RBY, UNITS, omPresetId } from "../data";
import { isBuiltin } from "../logic/lists";
import type { Carb, CatId, GrpId, PrepCat, Shop, Unit, UnitId } from "../data";
import type { AppData, Plan, Slot } from "../state/model";
import { cleanState, defaultData, slotId } from "../state/model";
import { addDays, dkey } from "../logic/dates";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
import { omNorm, validOm } from "../logic/omlet";

/** Sučelje spremanja. Kasnije se može dodati sinkronizacija (npr. Supabase) kao druga implementacija. */
export interface Storage {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

const KEY = "kuharica-podaci";

export const indexedDbStorage: Storage = {
  async load() {
    const raw = await get(KEY);
    return raw ? fromStored(raw, true) : cleanState(defaultData());
  },
  async save(data) {
    await set(KEY, data);
  },
};

/** Demo način: izmišljeni podaci u zasebnom spremištu, bez sinkronizacije. Tvoji podaci ostaju netaknuti. */
const DEMO_KEY = "kuharica-demo";
const DEMO_FLAG = "kuharica-demo-nacin";

export function isDemo(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Uključi ili isključi demo način i ponovno učitaj aplikaciju */
export async function setDemo(on: boolean, fresh = false) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, "1");
    else localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* bez spremišta ostaje kako je */
  }
  if (fresh || !on) await del(DEMO_KEY).catch(() => undefined);
  location.reload();
}

export function demoStorage(make: () => AppData): Storage {
  return {
    async load() {
      const raw = await get(DEMO_KEY);
      // demo spremljen prije postavke "builtin" se slaže ispočetka
      return raw && obj(obj(raw).settings).builtin !== undefined ? migrate(raw) : make();
    },
    async save(data) {
      await set(DEMO_KEY, data);
    },
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Podaci s uređaja ili s GitHuba. Stariji podaci (prije postavke "builtin") jednom kreću od nule s namirnicama:
 * sve ugrađene namirnice skrivene i prazna zaliha. Recepti, plan i vlastite namirnice ostaju.
 */
export function fromStored(raw: unknown, bump = false): AppData {
  const d = migrate(raw);
  if (obj(obj(raw).settings).builtin !== undefined) return d;
  const c = cleanState(d);
  // na uređaju: novije od starog stanja na GitHubu, da se čisto stanje pošalje dalje
  if (bump) c.updatedAt = Date.now();
  return c;
}

/** Marka, barkod, drugi nazivi, ugljikohidrati i masti namirnice */
function itemInfo(x: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const brand = str(x.brand);
  const ean = str(x.ean);
  const alias = Array.isArray(x.alias)
    ? x.alias.filter((a): a is string => typeof a === "string" && !!a.trim()).slice(0, 30)
    : [];
  return {
    ...(typeof x.carb === "number" ? { carb: x.carb } : {}),
    ...(typeof x.fat === "number" ? { fat: x.fat } : {}),
    ...(brand ? { brand } : {}),
    ...(ean ? { ean } : {}),
    ...(alias.length ? { alias } : {}),
  };
}

/** Plan: novi oblik (obroci po danu) ili stari (doručak, juha, ručak, salata, voće po danu) */
function parsePlan(p: Record<string, unknown>, updatedAt: number): Plan {
  // zapisi stariji od 60 dana se ne čuvaju
  const old = addDays(dkey(Date.now()), -60);
  const fresh = (k: string) => DATE.test(k) && k >= old;
  const plan: Plan = {
    anchor: typeof p.anchor === "string" && DATE.test(p.anchor) ? p.anchor : dkey(Date.now()),
    slots: {},
  };
  const slotOf = (x: unknown, s?: number): Slot | null => {
    const o = obj(x);
    const id = typeof o.id === "string" && o.id ? o.id : slotId();
    const done = !!o.done;
    if (typeof o.r === "string" && o.r) {
      const sv = num(o.s, s ?? 1);
      return { id, r: o.r, ...(sv !== 1 && sv > 0 ? { s: Math.min(6, sv) } : {}), done };
    }
    if (typeof o.item === "string" && o.item) return { id, item: o.item, qty: Math.max(0, num(o.qty, 1)), done };
    // stari omlet: ugrađeni je sada recept
    if (o.sel) {
      const sel = validOm(o.sel);
      const preset = OM_PRESETS.find((y) => omNorm(y.sel) === omNorm(sel));
      if (preset) return { id, r: omPresetId(preset), done };
    }
    return null;
  };
  if (p.slots && typeof p.slots === "object") {
    for (const [k, v] of Object.entries(obj(p.slots)))
      if (fresh(k) && Array.isArray(v)) {
        const list = v.map((x) => slotOf(x)).filter((x): x is Slot => !!x);
        if (list.length) plan.slots[k] = list;
      }
    return plan;
  }
  // stari oblik
  const days: Record<string, unknown> = {};
  const om: Record<string, unknown> = {};
  const extra: Record<string, Record<string, unknown>> = {};
  if (Array.isArray(p.days) || Array.isArray(p.om)) {
    // pon–ned tjedna u kojem je zadnja promjena → datumi
    const t = new Date(updatedAt || Date.now());
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const mon = dkey(t);
    plan.anchor = addDays(mon, -(num(p.start, 0) % 5));
    if (Array.isArray(p.days)) p.days.slice(0, 7).forEach((x, i) => (days[addDays(mon, i)] = x));
    if (Array.isArray(p.om)) p.om.slice(0, 7).forEach((x, i) => (om[addDays(mon, i)] = x));
    const ex = obj(p.extra);
    for (const k of OLD_SLOTS) {
      extra[k] = {};
      if (Array.isArray(ex[k])) (ex[k] as unknown[]).slice(0, 7).forEach((x, i) => (extra[k][addDays(mon, i)] = x));
    }
  } else {
    Object.assign(days, obj(p.days));
    Object.assign(om, obj(p.om));
    const ex = obj(p.extra);
    for (const k of OLD_SLOTS) extra[k] = obj(ex[k]);
  }
  const keys = new Set([...Object.keys(days), ...Object.keys(om), ...OLD_SLOTS.flatMap((k) => Object.keys(extra[k]))]);
  for (const k of keys) {
    if (!fresh(k)) continue;
    // redoslijed dana: doručak, juha, ručak i večera (1,5 porcija), salata, voće
    const list = [
      slotOf(om[k]),
      slotOf(extra.juha[k]),
      slotOf(days[k], 1.5),
      slotOf(extra.salata[k]),
      slotOf(extra.voce1[k]),
      slotOf(extra.voce2[k]),
    ].filter((x): x is Slot => !!x);
    if (list.length) plan.slots[k] = list;
  }
  return plan;
}
const OLD_SLOTS = ["juha", "salata", "voce1", "voce2"];

/** Provjeri i dopuni podatke (iz spremišta ili uvoza). Nepoznata polja se odbacuju. */
export function migrate(raw: unknown): AppData {
  const r = obj(raw);
  const d = defaultData();
  if (r.version !== undefined && r.version !== 1) throw new Error("Nepoznata verzija podataka: " + String(r.version));

  for (const [id, v] of Object.entries(obj(r.stock))) {
    const e = obj(v);
    d.stock[id] = { qty: Math.max(0, num(e.qty, 0)), price: typeof e.price === "number" ? e.price : null };
  }
  for (const [id, v] of Object.entries(obj(r.prepStock))) d.prepStock[id] = Math.max(0, num(v, 0));

  d.plan = parsePlan(obj(r.plan), num(r.updatedAt, 0));

  if (Array.isArray(r.hist))
    d.hist = r.hist
      .map(obj)
      .filter((h) => typeof h.r === "string" && typeof h.t === "number")
      .map((h) => ({ r: h.r as string, t: h.t as number }))
      .slice(0, 30);

  for (const [mk, list] of Object.entries(obj(r.costs))) {
    if (!/^\d{4}-\d{2}$/.test(mk) || !Array.isArray(list)) continue;
    d.costs[mk] = list.map(obj).map((e) => ({
      id: String(e.id ?? Math.random().toString(36).slice(2)),
      t: num(e.t, Date.now()),
      shop: String(e.shop ?? "O"),
      amount: num(e.amount, 0),
      note: String(e.note ?? ""),
      est: !!e.est,
      ...(typeof e.item === "string" ? { item: e.item } : {}),
      ...(typeof e.qty === "number" ? { qty: e.qty } : {}),
    }));
  }

  d.settings.dostava = num(obj(r.settings).dostava, 12);
  d.settings.shopDays = Math.min(14, Math.max(1, Math.round(num(obj(r.settings).shopDays, 7))));
  const builtin = obj(r.settings).builtin;
  d.settings.builtin = typeof builtin === "boolean" ? builtin : true;
  d.updatedAt = num(r.updatedAt, 0);

  const ls = obj(r.lists);
  for (const k of ["cats", "grps", "units", "kinds"] as const) {
    if (!Array.isArray(ls[k])) continue;
    const got = (ls[k] as unknown[])
      .map(obj)
      .filter((e) => typeof e.id === "string" && e.id && typeof e.n === "string" && (e.n as string).trim())
      .map((e) => ({ id: e.id as string, n: e.n as string }));
    // ugrađene stavke uvijek postoje (mogu biti preimenovane)
    const base = d.lists[k].filter((b) => isBuiltin(k, b.id) && !got.some((g) => g.id === b.id));
    d.lists[k] = [...base, ...got];
  }
  const hasCat = (v: unknown) => typeof v === "string" && d.lists.cats.some((c) => c.id === v);
  const hasGrp = (v: unknown) => typeof v === "string" && d.lists.grps.some((c) => c.id === v);
  const hasUnit = (v: unknown) =>
    typeof v === "string" && (d.lists.units.some((c) => c.id === v) || ["g", "ml", "kom"].includes(v));

  const it = obj(r.items);
  if (Array.isArray(it.custom))
    d.items.custom = it.custom
      .map(obj)
      .filter(
        (x) =>
          typeof x.id === "string" &&
          x.id.startsWith("c-") &&
          typeof x.n === "string" &&
          hasCat(x.cat) &&
          typeof x.src === "string" &&
          hasUnit(x.u),
      )
      .map((x) => ({
        id: x.id as string,
        n: x.n as string,
        cat: x.cat as CatId,
        ...(hasGrp(x.grp) ? { grp: x.grp as GrpId } : {}),
        src: x.src as string,
        u: x.u as Unit,
        pack: Math.max(0.01, num(x.pack, 1)),
        min: Math.max(0, num(x.min, 0)),
        step: Math.max(0.01, num(x.step, 1)),
        hint: typeof x.hint === "string" ? x.hint : "",
        ...(x.om && ["prot", "veg"].includes(obj(x.om).role as string) && num(obj(x.om).amt, 0) > 0
          ? {
              om: {
                role: obj(x.om).role as "prot" | "veg",
                amt: num(obj(x.om).amt, 0),
                ...(typeof obj(x.om).pre === "string" && (obj(x.om).pre as string).trim()
                  ? { pre: obj(x.om).pre as string }
                  : {}),
              },
            }
          : {}),
        ...(typeof x.kcal === "number" ? { kcal: x.kcal } : {}),
        ...(typeof x.prot === "number" ? { prot: x.prot } : {}),
        ...itemInfo(x),
      }));
  if (Array.isArray(r.recipes))
    d.recipes = r.recipes
      .map(obj)
      .filter(
        (x) =>
          typeof x.id === "string" &&
          (x.id.startsWith("r-") || x.id.startsWith("om-") || x.id in RBY) &&
          typeof x.n === "string",
      )
      .map((x) => ({
        id: x.id as string,
        n: x.n as string,
        c: (["Riža", "Krumpir", "Tjestenina", "Ostalo"].includes(x.c as string) ? x.c : "Ostalo") as Carb,
        d: typeof x.d === "string" ? x.d : "",
        use: Object.fromEntries(
          Object.entries(obj(x.use)).filter(([, a]) => typeof a === "number" && a > 0) as [string, number][],
        ),
        ...(x.prep && typeof x.prep === "object"
          ? {
              prep: Object.fromEntries(
                Object.entries(obj(x.prep)).filter(([, a]) => typeof a === "number" && a > 0) as [string, number][],
              ),
            }
          : {}),
        ...(x.prepIn && typeof x.prepIn === "object"
          ? {
              prepIn: Object.fromEntries(
                Object.entries(obj(x.prepIn)).filter(([, a]) => typeof a === "number" && a > 0) as [string, number][],
              ),
            }
          : {}),
        extra: Array.isArray(x.extra) ? x.extra.filter((s): s is string => typeof s === "string") : [],
        st: Array.isArray(x.st) ? x.st.filter((s): s is string => typeof s === "string") : [],
        ...(Array.isArray(x.kinds) ? { kinds: x.kinds.filter((s): s is string => typeof s === "string") } : {}),
        ...(x.parts && typeof x.parts === "object"
          ? {
              parts: Object.fromEntries(
                Object.entries(obj(x.parts)).filter(([, a]) => typeof a === "number" && a > 0) as [string, number][],
              ),
            }
          : {}),
        ...(x.side === "juha" || x.side === "salata" ? { side: x.side as "juha" | "salata" } : {}),
        ...(x.two === true ? { two: true } : {}),
      }));
  if (Array.isArray(r.preps))
    d.preps = r.preps
      .map(obj)
      .filter((x) => typeof x.id === "string" && (x.id.startsWith("pp-") || x.id in PBY) && typeof x.n === "string")
      .map((x) => ({
        id: x.id as string,
        n: x.n as string,
        k: (["Umaci", "Marinade", "Baze", "Gotovo"].includes(x.k as string) ? x.k : "Umaci") as PrepCat,
        time: typeof x.time === "string" ? x.time : "",
        keep: typeof x.keep === "string" ? x.keep : "",
        make: Math.max(0.01, num(x.make, 1)),
        unit: ((x.unit as string) in UNITS ? x.unit : "porcija") as UnitId,
        use: Object.fromEntries(
          Object.entries(obj(x.use)).filter(([, a]) => typeof a === "number" && a > 0) as [string, number][],
        ),
        extra: Array.isArray(x.extra) ? x.extra.filter((v): v is string => typeof v === "string") : [],
        st: Array.isArray(x.st) ? x.st.filter((v): v is string => typeof v === "string") : [],
        ...(Array.isArray(x.kinds) ? { kinds: x.kinds.filter((v): v is string => typeof v === "string") } : {}),
        ...(x.prep && typeof x.prep === "object"
          ? {
              prep: Object.fromEntries(
                Object.entries(obj(x.prep)).filter(([, a]) => typeof a === "number" && a > 0) as [string, number][],
              ),
            }
          : {}),
        ...(typeof x.tip === "string" && x.tip ? { tip: x.tip } : {}),
      }));
  if (Array.isArray(it.hidden)) {
    d.items.hidden = it.hidden.filter((x): x is string => typeof x === "string");
    // tko je ispraznio zalihu ("kreni od nule"), ne treba vidjeti ni naknadno dodane ugrađene namirnice
    const old = ITEMS.filter((i) => !NEW_ITEMS.includes(i.id));
    if (it.v !== 2 && old.every((i) => d.items.hidden.includes(i.id)))
      d.items.hidden = [...new Set([...d.items.hidden, ...NEW_ITEMS])];
  }
  for (const [id, v] of Object.entries(obj(it.over))) {
    const o = obj(v);
    d.items.over[id] = {
      ...(typeof o.min === "number" ? { min: Math.max(0, o.min) } : {}),
      ...(typeof o.pack === "number" && o.pack > 0 ? { pack: o.pack } : {}),
      ...(typeof o.n === "string" && o.n.trim() ? { n: o.n } : {}),
      ...(hasCat(o.cat) ? { cat: o.cat as CatId } : {}),
      ...(hasGrp(o.grp) ? { grp: o.grp as GrpId } : {}),
      ...(typeof o.src === "string" && o.src ? { src: o.src } : {}),
      ...(typeof o.kcal === "number" ? { kcal: o.kcal } : {}),
      ...(typeof o.prot === "number" ? { prot: o.prot } : {}),
      ...itemInfo(o),
    };
  }
  if (Array.isArray(r.shops)) {
    const shops = r.shops
      .map(obj)
      .filter((x) => typeof x.id === "string" && x.id && typeof x.n === "string")
      .map((x): Shop => ({
        id: x.id as string,
        n: x.n as string,
        type: typeof x.type === "string" ? x.type : "",
        addr: typeof x.addr === "string" ? x.addr : "",
        url: typeof x.url === "string" ? x.url : "",
        note: typeof x.note === "string" ? x.note : "",
        ...(Array.isArray(x.links)
          ? {
              links: x.links
                .map(obj)
                .filter((l) => typeof l.n === "string" && typeof l.url === "string")
                .map((l) => ({ n: l.n as string, url: l.url as string })),
            }
          : {}),
      }));
    // "Ostalo" uvijek postoji, na njega idu namirnice obrisanog dućana
    if (!shops.some((s) => s.id === "O")) shops.push(d.shops.find((s) => s.id === "O")!);
    d.shops = shops;
  }
  const ui = obj(r.ui);
  for (const [k, v] of Object.entries(obj(ui.servings))) d.ui.servings[k] = num(v, 1);
  for (const [k, v] of Object.entries(obj(ui.ture))) d.ui.ture[k] = num(v, 1);
  if (typeof ui.tab === "string") d.ui.tab = ui.tab;
  if (typeof ui.omDay === "number" && ui.omDay >= 0 && ui.omDay < 7) d.ui.omDay = ui.omDay;
  if (typeof ui.needsOpen === "boolean") d.ui.needsOpen = ui.needsOpen;
  if (ui.kupGroup === "shop" || ui.kupGroup === "cat" || ui.kupGroup === "none") d.ui.kupGroup = ui.kupGroup;
  if (ui.planView === "cal" || ui.planView === "needs") d.ui.planView = ui.planView;
  if (typeof ui.psTab === "string" && ["lists", "claude", "sync", "backup", "other"].includes(ui.psTab))
    d.ui.psTab = ui.psTab as typeof d.ui.psTab;
  if (ui.trTab === "log" || ui.trTab === "meal" || ui.trTab === "set") d.ui.trTab = ui.trTab;
  return d;
}

/** Izvoz u JSON datoteku */
export function exportJson(data: AppData): Blob {
  return new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], {
    type: "application/json",
  });
}

export async function importJson(file: File): Promise<AppData> {
  const text = await file.text();
  return migrate(JSON.parse(text));
}

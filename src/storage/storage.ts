import { get, set } from "idb-keyval";
import { CATS, DAYS, SHOPS } from "../data";
import type { CatId, ShopId, Unit } from "../data";
import type { AppData } from "../state/model";
import { defaultData, defaultOmWeek } from "../state/model";
import { validOm } from "../logic/omlet";

/** Sučelje spremanja. Kasnije se može dodati sinkronizacija (npr. Supabase) kao druga implementacija. */
export interface Storage {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

const KEY = "kuharica-podaci";

export const indexedDbStorage: Storage = {
  async load() {
    const raw = await get(KEY);
    return raw ? migrate(raw) : null;
  },
  async save(data) {
    await set(KEY, data);
  },
};

const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

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

  const p = obj(r.plan);
  d.plan.start = num(p.start, 0) % 5;
  if (Array.isArray(p.days) && p.days.length === DAYS.length)
    d.plan.days = p.days.map((x) => ({
      r: typeof obj(x).r === "string" ? (obj(x).r as string) : "",
      done: !!obj(x).done,
    }));
  d.plan.om =
    Array.isArray(p.om) && p.om.length === 7
      ? p.om.map((x) => ({ sel: validOm(obj(x).sel), done: !!obj(x).done }))
      : defaultOmWeek();

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
    }));
  }

  d.settings.dostava = num(obj(r.settings).dostava, 12);
  d.updatedAt = num(r.updatedAt, 0);

  const it = obj(r.items);
  if (Array.isArray(it.custom))
    d.items.custom = it.custom
      .map(obj)
      .filter(
        (x) =>
          typeof x.id === "string" &&
          x.id.startsWith("c-") &&
          typeof x.n === "string" &&
          (x.cat as string) in CATS &&
          (x.src as string) in SHOPS &&
          ["g", "ml", "kom"].includes(x.u as string),
      )
      .map((x) => ({
        id: x.id as string,
        n: x.n as string,
        cat: x.cat as CatId,
        src: x.src as ShopId,
        u: x.u as Unit,
        pack: Math.max(0.01, num(x.pack, 1)),
        min: Math.max(0, num(x.min, 0)),
        step: Math.max(0.01, num(x.step, 1)),
        hint: typeof x.hint === "string" ? x.hint : "",
      }));
  if (Array.isArray(it.hidden)) d.items.hidden = it.hidden.filter((x): x is string => typeof x === "string");
  for (const [id, v] of Object.entries(obj(it.over))) {
    const o = obj(v);
    d.items.over[id] = {
      ...(typeof o.min === "number" ? { min: Math.max(0, o.min) } : {}),
      ...(typeof o.pack === "number" && o.pack > 0 ? { pack: o.pack } : {}),
    };
  }
  const ui = obj(r.ui);
  for (const [k, v] of Object.entries(obj(ui.servings))) d.ui.servings[k] = num(v, 1);
  for (const [k, v] of Object.entries(obj(ui.ture))) d.ui.ture[k] = num(v, 1);
  if (typeof ui.tab === "string") d.ui.tab = ui.tab;
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

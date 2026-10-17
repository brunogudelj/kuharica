// Jednokratna skripta: izvlači podatke iz prototipa (reference/kuharica-prototip.html) u src/data/*.ts
// Pokretanje: node scripts/izvuci-podatke.mjs
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../reference/kuharica-prototip.html", import.meta.url), "utf8");
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const data = js.split("/* ---------- Stanje")[0];
const names = ["ITEMS","CATS","SRC","DAILY","RECIPES","CYCLE","DAYS","PREP","PREP_K","REC_PREP","UNITS","PREP_INV","REC_USE_PREP","DAILY_PREP",
  "OM_BASE","OM_FILL","OM_PROT","OM_VEG","OM_CARB","OM_PRESETS","DEFAULT_OM","MAC"];
const out = new Function(data + "; return {" + names.join(",") + "};")();

const j = (v) => JSON.stringify(v, null, 2);
const head = "// Generirano iz reference/kuharica-prototip.html skriptom scripts/izvuci-podatke.mjs. Podaci su preneseni doslovno.\n";
const files = {
  "items.ts": `import type { Item, CatId, ShopId } from "./types";\n\nexport const ITEMS: Item[] = ${j(out.ITEMS)};\n\nexport const CATS: Record<CatId, string> = ${j(out.CATS)};\n\nexport const SRC: Record<Exclude<ShopId, "O">, string> = ${j(out.SRC)};\n\n/** Što se troši svaki dan uz recept: miso juha, posni sir, dvije salate */\nexport const DAILY: Record<string, number> = ${j(out.DAILY)};\n`,
  "recipes.ts": `import type { Recipe } from "./types";\n\nexport const RECIPES: Recipe[] = ${j(out.RECIPES)};\n\nexport const CYCLE = ${j(out.CYCLE)} as const;\nexport const DAYS = ${j(out.DAYS)} as const;\n`,
  "prep.ts": `import type { PrepRecipe, PrepInv, PrepCat, UnitId } from "./types";\n\nexport const PREP: PrepRecipe[] = ${j(out.PREP)};\n\nexport const PREP_K: Record<PrepCat, string> = ${j(out.PREP_K)};\n\n/** Koji prep ubrzava koji recept */\nexport const REC_PREP: Record<string, string[]> = ${j(out.REC_PREP)};\n\nexport const UNITS: Record<UnitId, [string, string, string]> = ${j(out.UNITS)};\n\n/** Inventar pripremljenog: koliko jedinica prep daje i koje sirove sastojke jedna jedinica zamjenjuje */\nexport const PREP_INV: Record<string, PrepInv> = ${j(out.PREP_INV)};\n\n/** Što recept troši iz pripremljenog: [prep, broj jedinica] */\nexport const REC_USE_PREP: Record<string, [string, number][]> = ${j(out.REC_USE_PREP)};\n\nexport const DAILY_PREP: [string, number][] = ${j(out.DAILY_PREP)};\n`,
  "omlet.ts": `import type { OmBase, OmFill, OmCarb, OmPreset, OmSel } from "./types";\n\nexport const OM_BASE: Record<string, OmBase> = ${j(out.OM_BASE)};\n\nexport const OM_FILL: OmFill[] = ${j(out.OM_FILL)};\n\nexport const OM_PROT: string[] = ${j(out.OM_PROT)};\nexport const OM_VEG: string[] = ${j(out.OM_VEG)};\n\nexport const OM_CARB: Record<string, OmCarb> = ${j(out.OM_CARB)};\n\nexport const OM_PRESETS: OmPreset[] = ${j(out.OM_PRESETS)};\n\nexport const DEFAULT_OM: OmSel = ${j(out.DEFAULT_OM)};\n\n/** kcal i proteini po jedinici namirnice (g, ml ili kom) */\nexport const MAC: Record<string, [number, number]> = ${j(out.MAC)};\n`,
};
for (const [f, body] of Object.entries(files)) writeFileSync(new URL("../src/data/" + f, import.meta.url), head + body);
console.log("Izvučeno:", names.map((n) => `${n}=${Array.isArray(out[n]) ? out[n].length : Object.keys(out[n]).length}`).join(", "));

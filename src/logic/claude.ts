/* Uvoz recepta preko Claudea: Claude sam dohvati stranicu (web_fetch na Anthropicovim poslužiteljima,
   pa nema CORS problema) i vrati recept u formatu kuharice, sa sastojcima spojenim na namirnice iz zalihe.
   Ključ se čuva samo na ovom uređaju (localStorage), kao token za sinkronizaciju. */
import type { AppData } from "../state/model";
import { allItems, itemOf } from "./items";
import { allPreps, prepInv } from "./preps";
import { plural } from "./format";
import type { IngLine, ParsedRecipe } from "./importRecipe";

const KEY = "kuharica-claude";
export const CLAUDE_MODEL = "claude-sonnet-5-5";

export function loadClaudeKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function saveClaudeKey(k: string) {
  try {
    if (k.trim()) localStorage.setItem(KEY, k.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* bez spremišta: ključ vrijedi samo do zatvaranja */
  }
}

export interface ClaudeRecipe {
  ok: boolean;
  error?: string;
  n?: string;
  servings?: number | null;
  minutes?: number | null;
  method?: string;
  carb?: string;
  ingredients?: { raw: string; item: string | null; amount: number | null; group?: string | null }[];
  steps?: string[];
  kcal?: number | null;
  protein?: number | null;
}

export class ClaudeError extends Error {}

function prompt(d: AppData, src: { url?: string; text?: string }) {
  const catalog = [
    ...allItems(d).map(
      (i) =>
        `${i.id} | ${i.n}${i.brand ? ` (${i.brand})` : ""} | ${i.u}${i.alias?.length ? ` | zove se i: ${i.alias.join(", ")}` : ""}`,
    ),
    ...allPreps(d).map(
      (p) => `p:${p.id} | ${p.n} (pripremljeno, prep) | ${plural(2, prepInv(d, p.id)?.unit ?? "porcija")}`,
    ),
  ].join("\n");
  return `${src.url ? `Dohvati recept s ove stranice: ${src.url}` : `Ovo je tekst recepta:\n"""\n${src.text}\n"""`}

Pretvori recept u JSON za aplikaciju kuharica. Pravila:
- Naziv i koraci na hrvatskom (prevedi ako je recept na drugom jeziku). Koraci kratki, jedan korak = jedna radnja.
- Prednost imaju namirnice s markom i drugim nazivima ("zove se i"): ako se sastojak tako zove ili je to isti proizvod, poveži ga s tom namirnicom.
- Svaki sastojak poveži s namirnicom iz kataloga ispod (polje "item" = id iz kataloga) ako je to ista namirnica ili vrlo bliska (npr. "pileća prsa" = piletina, "basmati riža" = basmati). Ako nema odgovarajuće, "item": null.
- "amount" je količina za CIJELI recept, u jedinici namirnice iz kataloga (g, ml, kom ili druga). Pretvori žlice, šalice, kg, l itd. (1 žlica ≈ 15 g/ml, 1 žličica ≈ 5, 1 šalica ≈ 240 ml). Za "kom" broji komade. Ako količina nije navedena (sol, papar po želji), "amount": null.
- "raw" je izvorni redak sastojka.
- Ako recept koristi nešto što u katalogu postoji kao pripremljeno (id počinje s "p:", npr. teriyaki umak), poveži taj sastojak s tim prepom i "amount" upiši u njegovoj jedinici (obično 1 porcija za cijeli recept). Tada sirove sastojke tog umaka ne navodi zasebno.
- "group": ako recept dijeli sastojke u skupine (npr. "Za umak:", "Marinada", "Dresing"), upiši naziv skupine na hrvatskom ("Umak", "Marinada", "Dresing"…), inače null. Glavni sastojci jela imaju null.
- "method": jedno od Wok, Air fryer, Lonac, Pećnica, Tava, Bez kuhanja.
- "carb": Riža, Krumpir, Tjestenina ili Ostalo, prema glavnom prilogu.
- "minutes": ukupno vrijeme; "servings": broj porcija; "kcal" i "protein": po porciji ako su navedeni, inače null.
- Ako stranicu ne možeš dohvatiti ili na njoj nema recepta, vrati {"ok": false, "error": "kratko objašnjenje na hrvatskom"}.

Vrati SAMO JSON, bez ikakvog drugog teksta:
{"ok": true, "n": "...", "servings": 2, "minutes": 25, "method": "Wok", "carb": "Riža", "ingredients": [{"raw": "400 g pilećih prsa", "item": "piletina", "amount": 400, "group": null}, {"raw": "2 žlice soja umaka", "item": "soja", "amount": 30, "group": "Umak"}], "steps": ["..."], "kcal": null, "protein": null}

Katalog namirnica (id | naziv | jedinica):
${catalog}`;
}

/** Pošalji link ili tekst Claudeu i vrati recept s povezanim namirnicama */
export async function claudeRecipe(
  d: AppData,
  key: string,
  src: { url?: string; text?: string },
  signal?: AbortSignal,
): Promise<{ parsed: ParsedRecipe; lines: IngLine[]; method?: string; carb?: string }> {
  const messages: { role: string; content: unknown }[] = [{ role: "user", content: prompt(d, src) }];
  const call = async () => {
    try {
      return await fetch("https://api.anthropic.com/v1/messages", {
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
          max_tokens: 4000,
          messages,
          ...(src.url
            ? { tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, max_content_tokens: 40000 }] }
            : {}),
        }),
      });
    } catch {
      throw new ClaudeError("Nema veze s Claudeom. Provjeri internet.");
    }
  };
  let res = await call();
  if (res.status === 401) throw new ClaudeError("Claude API ključ nije ispravan. Provjeri ga u Postavkama.");
  if (res.status === 429)
    throw new ClaudeError("Previše zahtjeva ili je potrošen kredit na Claude računu. Pokušaj malo kasnije.");
  if (!res.ok) {
    let msg = "";
    try {
      msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      /* bez tijela */
    }
    throw new ClaudeError(`Claude je vratio grešku ${res.status}${msg ? `: ${msg}` : ""}.`);
  }
  let body = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  // dugi dohvat stranice: poslužitelj zastane, nastavlja se istim razgovorom
  for (let k = 0; k < 3 && body.stop_reason === "pause_turn"; k++) {
    messages.push({ role: "assistant", content: body.content });
    res = await call();
    if (!res.ok) throw new ClaudeError(`Claude je vratio grešku ${res.status}.`);
    body = (await res.json()) as typeof body;
  }
  const text = (body.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  return fromClaudeText(d, text, src.url ?? "");
}

/** Odgovor u JSON-u → recept i retci sastojaka (izdvojeno radi testova) */
export function fromClaudeText(d: AppData, text: string, url: string) {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let j: ClaudeRecipe;
  try {
    j = JSON.parse(text.slice(a, b + 1)) as ClaudeRecipe;
  } catch {
    throw new ClaudeError("Claude nije vratio recept u očekivanom obliku. Pokušaj ponovno ili zalijepi tekst recepta.");
  }
  if (!j.ok) throw new ClaudeError(j.error || "Claude na stranici nije našao recept.");
  const ings = Array.isArray(j.ingredients) ? j.ingredients : [];
  const lines: IngLine[] = ings.map((x) => {
    const pid =
      typeof x.item === "string" && x.item.startsWith("p:") && prepInv(d, x.item.slice(2))
        ? x.item.slice(2)
        : undefined;
    const item = !pid && typeof x.item === "string" ? (itemOf(d, x.item) ?? null) : null;
    const amount = typeof x.amount === "number" && x.amount > 0 ? x.amount : null;
    const group = typeof x.group === "string" && x.group.trim() ? x.group.trim() : undefined;
    return {
      raw: String(x.raw ?? ""),
      amount,
      unit: item?.u ?? "",
      name: String(x.raw ?? ""),
      item,
      ...(pid ? { prep: pid } : {}),
      ...(group ? { group } : {}),
    };
  });
  const parsed: ParsedRecipe = {
    n: j.n?.trim() || "Recept",
    ingredients: lines.map((l) => l.raw),
    steps: Array.isArray(j.steps) ? j.steps.filter((s): s is string => typeof s === "string" && !!s.trim()) : [],
    minutes: typeof j.minutes === "number" ? j.minutes : null,
    servings: typeof j.servings === "number" && j.servings > 0 ? j.servings : null,
    kcal: typeof j.kcal === "number" ? j.kcal : null,
    prot: typeof j.protein === "number" ? j.protein : null,
    url,
  };
  return { parsed, lines, method: j.method, carb: j.carb };
}

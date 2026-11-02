/* Račun s fotografije: Claude pročita stavke i poveže ih s namirnicama iz zalihe.
   Rezultat ide u tablicu za provjeru, a odatle sve odjednom u zalihu i troškove. */
import type { AppData } from "../state/model";
import { allItems, itemOf } from "./items";
import { CLAUDE_MODEL, ClaudeError } from "./claude";

export interface ReceiptLine {
  /** redak s računa */
  raw: string;
  /** čist naziv proizvoda, za novu namirnicu */
  name: string;
  /** namirnica iz zalihe ili null */
  item: string | null;
  /** ukupna količina u jedinici namirnice (npr. 2 × 400 g = 800) */
  amount: number | null;
  /** iznos retka u eurima */
  price: number | null;
}
export interface Receipt {
  shop: string;
  /** datum s računa (YYYY-MM-DD) ili prazno */
  date: string;
  total: number | null;
  lines: ReceiptLine[];
}

/** Smanji fotografiju (najviše 1600 px) i vrati base64 JPEG, da zahtjev bude manji i brži */
export async function shrinkImage(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Slika se ne može otvoriti."));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function prompt(d: AppData) {
  const catalog = allItems(d)
    .map(
      (i) =>
        `${i.id} | ${i.n}${i.brand ? ` (${i.brand})` : ""} | ${i.u} | pakiranje ${i.pack} ${i.u}${i.alias?.length ? ` | zove se i: ${i.alias.join(", ")}` : ""}`,
    )
    .join("\n");
  const shops = d.shops.map((s) => s.n).join(", ");
  return `Ovo je fotografija računa iz trgovine u Hrvatskoj. Pročitaj sve kupljene stavke.

Pravila:
- Svaku stavku poveži s namirnicom iz kataloga ispod ("item" = id) ako je to ista ili vrlo bliska namirnica. Kratice s računa razriješi (npr. "PIL.PRSA" = pileća prsa, "MLIJ.TR. 2,8%" = mlijeko). Ako nema odgovarajuće, "item": null.
- "amount" je UKUPNA kupljena količina u jedinici namirnice iz kataloga (g, ml, kom ili druga). Ako je kupljeno 2 komada po 400 g, a namirnica se mjeri u g, amount = 800. Za vagane proizvode uzmi težinu s računa (npr. 0,734 kg = 734 g). Ako ne znaš veličinu pakiranja, uzmi pakiranje iz kataloga. Za stavke bez kataloga procijeni u g, ml ili kom.
- "price" je iznos retka u eurima (nakon popusta ako je naveden uz stavku).
- "name" je čist naziv proizvoda na hrvatskom, s markom ako je vidljiva (npr. "Ledo meksička mješavina").
- "raw" je redak s računa kako piše.
- Preskoči povratnu naknadu, vrećice, popuste kao zasebne retke (oduzmi ih od stavke), međuzbrojeve i plaćanje.
- "shop": naziv trgovine (moji dućani: ${shops}). "date": datum s računa kao YYYY-MM-DD ili "". "total": ukupno za platiti.
- Ako na slici nije račun ili se ne može pročitati, vrati {"ok": false, "error": "kratko objašnjenje na hrvatskom"}.

Vrati SAMO JSON:
{"ok": true, "shop": "Kaufland", "date": "2026-11-02", "total": 23.45, "lines": [{"raw": "LEDO MEKS.MJES 400G", "name": "Ledo meksička mješavina", "item": null, "amount": 400, "price": 2.49}]}

Katalog namirnica (id | naziv | jedinica | pakiranje):
${catalog}`;
}

/** Pošalji fotografiju računa Claudeu */
export async function claudeReceipt(
  d: AppData,
  key: string,
  jpegBase64: string,
  signal?: AbortSignal,
): Promise<Receipt> {
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
        max_tokens: 6000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
              { type: "text", text: prompt(d) },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ClaudeError("Nema veze s Claudeom. Provjeri internet.");
  }
  if (res.status === 401) throw new ClaudeError("Claude API ključ nije ispravan. Provjeri ga u Postavkama.");
  if (res.status === 429) throw new ClaudeError("Previše zahtjeva ili je potrošen kredit na Claude računu.");
  if (!res.ok) throw new ClaudeError(`Claude je vratio grešku ${res.status}.`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
  return fromReceiptText(d, text);
}

const numOr = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);

/** Odgovor u JSON-u → račun (izdvojeno radi testova) */
export function fromReceiptText(d: AppData, text: string): Receipt {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new ClaudeError("Claude nije vratio račun u očekivanom obliku. Pokušaj s oštrijom fotografijom.");
  }
  if (j.ok === false) throw new ClaudeError(String(j.error || "Na slici nije pronađen račun."));
  const lines = (Array.isArray(j.lines) ? j.lines : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const item = typeof x.item === "string" && itemOf(d, x.item) ? x.item : null;
      return {
        raw: String(x.raw ?? x.name ?? ""),
        name: String(x.name ?? x.raw ?? "").trim(),
        item,
        amount: numOr(x.amount),
        price: numOr(x.price),
      };
    })
    .filter((l) => l.raw || l.name);
  return {
    shop: typeof j.shop === "string" ? j.shop : "",
    date: typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : "",
    total: numOr(j.total),
    lines,
  };
}

/** Dućan s popisa po nazivu s računa ("KAUFLAND HRVATSKA k.d." → Kaufland) */
export function matchShop(d: AppData, name: string): string {
  const n = name.toLowerCase().trim();
  if (!n) return "O";
  const s = d.shops.find((x) => n.includes(x.n.toLowerCase()) || x.n.toLowerCase().includes(n.split(" ")[0] || "#"));
  return s?.id ?? "O";
}

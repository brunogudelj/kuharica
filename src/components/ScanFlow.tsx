/* Skeniraj proizvod: poznati barkod odmah dodaje u zalihu, nepoznati se potraži u bazi proizvoda
   (Open Food Facts) i sprema kao nova namirnica s markom, pakiranjem i kalorijama.
   Barkod se pamti na namirnici, pa se idući put prepozna sam. */
import { useState } from "react";
import type { FormEvent } from "react";
import { useApp } from "../state/AppContext";
import { allItems, itemByEan } from "../logic/items";
import { editItem, purchase } from "../logic/actions";
import { offBarcode, hitPatch } from "../logic/foodinfo";
import type { FoodHit } from "../logic/foodinfo";
import { qty } from "../logic/inventory";
import { fmt } from "../logic/format";
import type { Item } from "../data";
import { Scanner } from "./Scanner";
import { ItemForm } from "./ItemForm";

type St =
  | { t: "scan" }
  | { t: "busy"; code: string }
  | { t: "known"; code: string; id: string }
  | { t: "new"; code: string; hit: FoodHit | null; err?: string };

const parse = (s: string) => parseFloat(s.replace(",", "."));

export function ScanFlow({ onDone }: { onDone: () => void }) {
  const { data, apply } = useApp();
  const [st, setSt] = useState<St>({ t: "scan" });
  const [manual, setManual] = useState("");
  const [amt, setAmt] = useState("");
  const [link, setLink] = useState("");

  const lookup = async (raw: string) => {
    const code = raw.replace(/\D/g, "");
    if (code.length < 8) return;
    const known = itemByEan(data, code);
    if (known) {
      setAmt(String(known.pack).replace(".", ","));
      return setSt({ t: "known", code, id: known.id });
    }
    setSt({ t: "busy", code });
    try {
      setSt({ t: "new", code, hit: await offBarcode(code) });
    } catch (e) {
      setSt({ t: "new", code, hit: null, err: e instanceof Error ? e.message : "Baza proizvoda nije dostupna." });
    }
  };
  const again = () => {
    setManual("");
    setLink("");
    setSt({ t: "scan" });
  };

  const addKnown = (i: Item) => {
    const a = parse(amt);
    if (!(a > 0)) return;
    const r = purchase(data, i.id, a, null);
    apply(r.data, r.msg);
    again();
  };

  return (
    <section className="confirm scanflow" aria-label="Skeniraj proizvod">
      <div className="rowspread">
        <b>Skeniraj proizvod</b>
        <button type="button" className="btn ghost small" onClick={onDone}>
          Zatvori
        </button>
      </div>

      {st.t === "scan" && (
        <>
          <Scanner onCode={lookup} />
          <form
            className="inlineform"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              lookup(manual);
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="ili upiši barkod"
              aria-label="Barkod"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button type="submit" className="btn small" disabled={manual.replace(/\D/g, "").length < 8}>
              Traži
            </button>
          </form>
          <p className="sub">
            Usmjeri kameru na barkod. Poznat proizvod odmah dodaješ u zalihu, a novi se potraži u bazi proizvoda i
            spremi s markom, pakiranjem i kalorijama.
          </p>
        </>
      )}

      {st.t === "busy" && <p className="sub">Tražim {st.code} u bazi proizvoda…</p>}

      {st.t === "known" &&
        (() => {
          const i = allItems(data).find((x) => x.id === st.id)!;
          return (
            <div className="scanres">
              <p>
                <b>{i.n}</b>
                {i.brand ? <span className="muted"> · {i.brand}</span> : null}
                <br />
                <span className="muted">
                  Imaš {fmt(qty(data, i.id), i.u)} · barkod {st.code}
                  {data.items.hidden.includes(i.id) ? " · bila je skrivena, vratit će se u zalihu" : ""}
                </span>
              </p>
              <div className="inlineform">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Koliko dodaješ (${i.u})`}
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                />
                <span className="unit">{i.u}</span>
                <button type="button" className="btn" onClick={() => addKnown(i)}>
                  Dodaj u zalihu
                </button>
              </div>
              <button type="button" className="linkbtn" onClick={again}>
                Skeniraj sljedeće
              </button>
            </div>
          );
        })()}

      {st.t === "new" && (
        <>
          <p className="sub">
            {st.hit ? (
              <>
                Pronađeno u bazi proizvoda: <b>{[st.hit.brand, st.hit.name].filter(Boolean).join(" ")}</b>
                {st.hit.quantity ? `, ${st.hit.quantity}` : ""}. Provjeri podatke i spremi.
              </>
            ) : (
              <>
                {st.err ?? `Barkoda ${st.code} nema u bazi proizvoda.`} Upiši naziv i vrijednosti s deklaracije ili
                probaj „Pitaj Claudea”.
              </>
            )}
          </p>
          <div className="inlineform">
            <select
              aria-label="Ili poveži s namirnicom koju već imaš"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            >
              <option value="">… ili je to namirnica koju već imam</option>
              {allItems(data)
                .filter((i) => !i.ean)
                .sort((a, b) => a.n.localeCompare(b.n, "hr"))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.n}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn small"
              disabled={!link}
              onClick={() => {
                const it = allItems(data).find((i) => i.id === link)!;
                const patch = st.hit ? hitPatch(it, st.hit) : {};
                const d = editItem(data, link, { ...patch, ean: st.code });
                apply(d, `${it.n}: barkod zapamćen.`);
                setAmt(String(it.pack).replace(".", ","));
                setSt({ t: "known", code: st.code, id: link });
              }}
            >
              Poveži
            </button>
          </div>
          <ItemForm
            key={st.code}
            initial={{
              n: st.hit?.name ?? "",
              u: st.hit?.unit ?? "g",
              pack: st.hit?.pack ?? undefined,
              have: st.hit?.pack ?? undefined,
              info: {
                ean: st.code,
                ...(st.hit ? hitPatch({ n: st.hit.name, u: st.hit.unit ?? "g" }, st.hit) : {}),
              },
            }}
            onDone={(item) => (item ? again() : onDone())}
          />
        </>
      )}
    </section>
  );
}

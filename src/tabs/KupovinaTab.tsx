import { useRef, useState } from "react";
import { SHOP_LINKS, SHOPS } from "../data";
import type { ShopId } from "../data";
import { useApp } from "../state/AppContext";
import { shopping } from "../logic/inventory";
import type { ShopRow } from "../logic/inventory";
import { buy } from "../logic/actions";
import { eur, fmt } from "../logic/format";
import { Note } from "../components/ui";

export function KupovinaTab() {
  const { data, apply } = useApp();
  const [copyMsg, setCopyMsg] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const list = shopping(data);
  const groups: Record<ShopId, ShopRow[]> = { K: [], BIO: [], AZ: [], O: [] };
  list.forEach((x) => groups[x.i.src].push(x));
  let total = 0;
  let priced = 0;
  list.forEach((x) => {
    if (x.cost != null) {
      total += x.cost;
      priced++;
    }
  });
  const txt =
    (Object.entries(groups) as [ShopId, ShopRow[]][])
      .filter(([, a]) => a.length)
      .map(
        ([s, a]) =>
          SHOPS[s].toUpperCase() + "\n" + a.map((x) => `- ${x.i.n}: ${x.packs} × ${fmt(x.i.pack, x.i.u)}`).join("\n"),
      )
      .join("\n\n") || "Ništa ne fali.";

  const copy = () => {
    const fallback = () => {
      ta.current?.focus();
      ta.current?.select();
      setCopyMsg("Označeno, kopiraj ručno");
    };
    try {
      navigator.clipboard.writeText(txt).then(() => setCopyMsg("Kopirano"), fallback);
    } catch {
      fallback();
    }
  };

  return (
    <section id="kupovina" role="tabpanel" aria-labelledby="tab-kupovina">
      <Note>
        <strong>Popis se računa sam:</strong> ono što fali za planirane dane i omlete, plus dopuna do minimalne zalihe.
        Količine su zaokružene na cijela pakiranja. Kad kupiš, stisni <strong>Kupio</strong> i zaliha se poveća.
      </Note>

      {list.length ? (
        <div className="group">
          {(Object.entries(groups) as [ShopId, ShopRow[]][])
            .filter(([, a]) => a.length)
            .map(([s, arr]) => {
              const sub = arr.reduce((t, x) => t + (x.cost ?? 0), 0);
              return (
                <div key={s} className="group">
                  <div className="ghead">
                    <h2>{SHOPS[s]}</h2>
                    <span className="count">
                      {arr.length} stavki{sub ? ` · ${eur(sub)}` : ""}
                    </span>
                  </div>
                  <div className="list">
                    {arr.map((x) => (
                      <div key={x.i.id} className="srow">
                        <div className="sn">
                          <b>{x.i.n}</b>
                          <small>
                            {x.forPlan ? "za plan" : "dopuna zalihe"} · fali {fmt(x.short, x.i.u)}
                          </small>
                        </div>
                        <div className="sq">
                          {x.packs} × {fmt(x.i.pack, x.i.u)}
                          {x.cost != null && (
                            <>
                              <br />
                              {eur(x.cost)}
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          className="cookbtn"
                          onClick={() => {
                            const r = buy(data, x.i.id, x.packs);
                            apply(r.data, r.msg);
                          }}
                        >
                          Kupio
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          {priced ? (
            <p className="total">
              Procjena: {eur(total)}{" "}
              <span className="count">
                ({priced} od {list.length} stavki ima cijenu)
              </span>
            </p>
          ) : (
            <p className="sub">Upiši cijene u Zalihi (dodir na naziv) i ovdje ćeš vidjeti procjenu troška.</p>
          )}
        </div>
      ) : (
        <Note>
          <strong>Ništa ne fali.</strong> Imaš sve za plan i minimalnu zalihu.
        </Note>
      )}

      <div className="group">
        <h2>Kopiraj popis</h2>
        <div className="btnrow">
          <button className="btn" type="button" onClick={copy}>
            Kopiraj popis
          </button>
          <span className="count" aria-live="polite">
            {copyMsg}
          </span>
        </div>
        <textarea ref={ta} readOnly value={txt} aria-label="Popis za kupovinu kao tekst" />
      </div>

      <div className="group">
        <h2>Zdravi dućani</h2>
        <div className="shops">
          {SHOP_LINKS.zdravi.map((s) => (
            <div key={s.url} className="shop">
              <a href={s.url} target="_blank" rel="noopener">
                {s.n}
              </a>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="group">
        <h2>Azijski dućani u Zagrebu</h2>
        <div className="shops">
          {SHOP_LINKS.azijski.map((s) => (
            <div key={s.url} className="shop">
              <a href={s.url} target="_blank" rel="noopener">
                {s.n}
              </a>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

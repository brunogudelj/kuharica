import { useState } from "react";
import { allRecipes } from "../logic/recipes";
import { useApp } from "../state/AppContext";
import { shopName, shopOpts } from "../logic/shops";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { costSummary } from "../logic/costs";
import { dayCost } from "../logic/inventory";
import { editCost, removeCost } from "../logic/actions";
import { itemOf } from "../logic/items";
import { NumCell, SelectCell, TextCell } from "../components/Cells";
import { eur, fmt, monthKey, round } from "../logic/format";
import { exportJson, importJson } from "../storage/storage";
import { SyncPanel } from "../components/SyncPanel";


function Backup() {
  const { data, apply, notify } = useApp();
  const [pending, setPending] = useState<AppData | null>(null);
  const [err, setErr] = useState("");

  const doExport = () => {
    const url = URL.createObjectURL(exportJson(data));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kuharica-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Podaci izvezeni.");
  };

  return (
    <div className="group">
      <h2>Backup podataka</h2>
      <p className="sub">
        Izvezi sve (zalihu, plan, troškove) u JSON datoteku i čuvaj je za svaki slučaj, ili je uvezi na drugom uređaju.
      </p>
      <div className="btnrow">
        <button type="button" className="btn" onClick={doExport}>
          Izvezi podatke
        </button>
        <label className="btn ghost file-label">
          Uvezi podatke
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setPending(await importJson(f));
                setErr("");
              } catch (ex) {
                setErr(
                  "Datoteku nije moguće učitati: " +
                    (ex instanceof Error ? ex.message : "neispravan JSON") +
                    ". Odaberi datoteku koju je izvezla ova aplikacija.",
                );
              }
            }}
          />
        </label>
      </div>
      {err && <p className="miss">{err}</p>}
      {pending && (
        <div className="confirm" role="alertdialog" aria-label="Potvrda uvoza">
          <b>Zamijeniti sve trenutne podatke uvezenima?</b>
          <span className="sub">
            Uvoz sadrži {Object.keys(pending.stock).length} namirnica na zalihi i{" "}
            {Object.values(pending.costs).reduce((s, l) => s + l.length, 0)} zapisa troškova. Trenutni podaci bit će
            zamijenjeni, a poništiti možeš odmah nakon uvoza.
          </span>
          <div className="btnrow">
            <button
              type="button"
              className="btn"
              onClick={() => {
                apply(pending, "Podaci uvezeni.");
                setPending(null);
              }}
            >
              Zamijeni podatke
            </button>
            <button type="button" className="btn ghost" onClick={() => setPending(null)}>
              Odustani
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TroskoviTab() {
  const { data, apply, update } = useApp();
  const s = costSummary(data);
  const d = new Date();
  const [month, setMonth] = useState(s.mk);
  const [dostDraft, setDostDraft] = useState<string | null>(null);

  const months = Array.from(new Set([s.mk, ...Object.keys(data.costs)]))
    .sort()
    .reverse();
  const cur = months.includes(month) ? month : s.mk;
  const log = (data.costs[cur] || []).slice().sort((a, b) => b.t - a.t);
  const max = Math.max(1, ...Object.values(s.byShop));
  const pct = Math.round(s.cover * 100);

  return (
    <section id="troskovi" aria-labelledby="tab-troskovi">
      <div className="summary four">
        <div>
          <b>{eur(s.spent)}</b>
          <span>potrošeno ovaj mjesec ({d.toLocaleDateString("hr-HR", { month: "long" })})</span>
          <small>{s.entries.length} zapisa</small>
        </div>
        <div>
          <b>{s.priced ? eur(s.pace ?? s.planMonth) : "–"}</b>
          <span>procjena za mjesec</span>
          <small>
            {s.pace ? "prema dosadašnjem tempu" : "prema planu"}
            {s.pace && s.priced ? ` · plan: ${eur(s.planMonth)}` : ""}
          </small>
        </div>
        <div>
          <b>{s.priced ? eur(s.avgMeal) : "–"}</b>
          <span>prosječan obrok</span>
          <small>dostava: {eur(s.dost)}</small>
        </div>
        <div>
          <b className="save">{s.priced ? eur(Math.max(0, s.saveMonth)) : "–"}</b>
          <span>ušteda mjesečno</span>
          <small>ručak i večera vs dostava</small>
        </div>
      </div>
      <div className="note">
        {!s.priced ? (
          <>
            <strong>Još nema cijena.</strong> U Zalihi dodirni naziv namirnice i upiši cijenu pakiranja. Kreni od mesa,
            riže i krumpira, jer one najviše utječu na trošak. Potrošnja se bilježi kad u Kupovini označiš kupljeno.
          </>
        ) : (
          <>
            Izračun po obroku uključuje recept, miso juhu, posni sir i salate. Cijene su poznate za{" "}
            <strong>{pct} %</strong> sastojaka
            {pct < 80 ? ", pa je stvarni trošak nešto veći. Dopuni cijene u Zalihi za točniju procjenu" : ""}. Mjesečna
            procjena uključuje i omlet za doručak.
          </>
        )}
      </div>

      <div className="group">
        <div className="ghead">
          <h2>Po dućanu ovaj mjesec</h2>
        </div>
        <div className="list">
          {Object.keys(s.byShop).length ? (
            Object.entries(s.byShop)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <div key={k} className="bar">
                  <span>{shopName(data, k)}</span>
                  <div className="track">
                    <div className="fill" style={{ width: `${Math.max(3, (v / max) * 100)}%` }} />
                  </div>
                  <span className="num">{eur(v)}</span>
                </div>
              ))
          ) : (
            <div className="empty">Ovaj mjesec još nema zapisa. Kvačicom u Kupovini zapisuješ kupljeno i cijenu.</div>
          )}
        </div>
      </div>

      <div className="group">
        <div className="ghead">
          <h2>Cijena po obroku</h2>
          <span className="count">recept ÷ 2 obroka</span>
        </div>
        <div className="tablewrap">
          <table className="grid" aria-label="Cijena po obroku">
            <thead>
              <tr>
                <th className="sticky">Recept</th>
                <th>Ugljikohidrat</th>
                <th className="num">Po obroku</th>
                <th className="num">Dostava</th>
                <th className="num">Ušteda</th>
                <th className="num">Cijene poznate</th>
              </tr>
            </thead>
            <tbody>
              {allRecipes(data)
                .map((r) => ({ r, c: dayCost(data, r.id) }))
                .sort((a, b) => a.c.perMeal - b.c.perMeal)
                .map(({ r, c }) => (
                  <tr key={r.id}>
                    <td className="sticky txt">
                      <b>{r.n}</b>
                    </td>
                    <td className="txt">
                      <span className={`chip cc-${r.c}`}>{r.c}</span>
                    </td>
                    <td className="txt num">{c.known ? eur(c.perMeal) : "–"}</td>
                    <td className="txt num">{eur(s.dost)}</td>
                    <td className="txt num save">{c.known ? eur(Math.max(0, s.dost - c.perMeal)) : "–"}</td>
                    <td className="txt num">
                      {c.known}/{c.total}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="group">
        <h2>Postavke usporedbe</h2>
        <div className="edit">
          <label htmlFor="setDostava">
            Prosječna dostava po obroku (€)
            <input
              id="setDostava"
              type="text"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={dostDraft ?? String(data.settings.dostava)}
              onChange={(e) => setDostDraft(e.target.value)}
              onBlur={() => {
                const v = parseFloat((dostDraft ?? "").replace(",", "."));
                if (!isNaN(v) && v >= 0)
                  update((x) => {
                    const n = clone(x);
                    n.settings.dostava = round(v);
                    return n;
                  });
                setDostDraft(null);
              }}
            />
          </label>
        </div>
        <p className="sub">
          Upiši koliko te inače stoji obrok s dostavom i napojnicom. Doručak se računa iz cijena omleta u tjednom planu.
        </p>
      </div>

      <div className="group">
        <div className="ghead">
          <h2>Zapisi</h2>
          <select id="costMonth" aria-label="Mjesec" value={cur} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => {
              const [y, mo] = m.split("-");
              const tot = (data.costs[m] || []).reduce((t, e) => t + (e.amount || 0), 0);
              return (
                <option key={m} value={m}>
                  {new Date(+y, +mo - 1, 1).toLocaleDateString("hr-HR", { month: "long", year: "numeric" })} ·{" "}
                  {eur(tot)}
                </option>
              );
            })}
          </select>
        </div>
        {log.length ? (
          <div className="tablewrap">
            <table className="grid" aria-label="Zapisi troškova">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className="sticky">Opis</th>
                  <th>Dućan</th>
                  <th className="num">Količina</th>
                  <th className="num">Iznos €</th>
                  <th>Vrsta</th>
                  <th>
                    <span className="sr-only">Obriši</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {log.map((e) => {
                  const it = e.item ? itemOf(data, e.item) : undefined;
                  const mk = monthKey(e.t);
                  return (
                    <tr key={e.id}>
                      <td className="txt">
                        {new Date(e.t).toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" })}
                      </td>
                      <td className="sticky" style={{ minWidth: 160 }}>
                        <TextCell label="Opis" value={e.note || shopName(data, e.shop)} onCommit={(v) => update((x) => editCost(x, mk, e.id, { note: v }))} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <SelectCell<string>
                          label="Dućan"
                          value={data.shops.some((x) => x.id === e.shop) ? e.shop : "O"}
                          options={shopOpts(data)}
                          onChange={(v) => update((x) => editCost(x, mk, e.id, { shop: v }))}
                        />
                      </td>
                      <td className="txt num">{it && e.qty ? fmt(e.qty, it.u) : "–"}</td>
                      <td style={{ width: 96 }}>
                        <NumCell label="Iznos" value={e.amount} onCommit={(v) => update((x) => editCost(x, mk, e.id, { amount: v ?? 0 }))} />
                      </td>
                      <td className="txt">
                        <span className={"chip " + (e.est ? "p-low" : "p-ok")}>{e.est ? "s popisa" : "račun"}</span>
                      </td>
                      <td className="c">
                        <button type="button" className="rowbtn" aria-label="Obriši zapis" onClick={() => apply(removeCost(data, mk, e.id), "Zapis obrisan.")}>
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="tblfoot">
              <span>{log.length} zapisa</span>
              <span>Ukupno: {eur(log.reduce((t, e) => t + (e.amount || 0), 0))}</span>
            </div>
          </div>
        ) : (
          <div className="empty">Nema zapisa za ovaj mjesec.</div>
        )}
      </div>

      <SyncPanel />
      <Backup />
    </section>
  );
}

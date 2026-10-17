import { useState } from "react";
import type { FormEvent } from "react";
import { RECIPES, SHOPS } from "../data";
import type { ShopId } from "../data";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { costSummary } from "../logic/costs";
import { dayCost } from "../logic/inventory";
import { addReceipt, removeCost } from "../logic/actions";
import { eur, monthKey, round } from "../logic/format";
import { exportJson, importJson } from "../storage/storage";

const shopName = (s: string) => SHOPS[s as ShopId] || s;
const todayInput = () => {
  const now = Date.now();
  return new Date(now - new Date(now).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

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
  const { data, apply, update, notify } = useApp();
  const s = costSummary(data);
  const d = new Date();
  const [shop, setShop] = useState<ShopId>("K");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput);
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(s.mk);
  const [dostDraft, setDostDraft] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      notify("Upiši iznos računa veći od 0.");
      return;
    }
    const now = new Date();
    const t = date
      ? new Date(
          `${date}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        ).getTime()
      : Date.now();
    const r = addReceipt(data, { shop, amount: amt, t, note: note.trim() || "Račun " + SHOPS[shop] });
    apply(r.data, `Račun ${eur(round(amt))} spremljen${r.replaced ? `, zamijenjeno ${r.replaced} procjena` : ""}.`);
    setAmount("");
    setNote("");
  };

  const months = Array.from(new Set([s.mk, ...Object.keys(data.costs)]))
    .sort()
    .reverse();
  const cur = months.includes(month) ? month : s.mk;
  const log = (data.costs[cur] || []).slice().sort((a, b) => b.t - a.t);
  const max = Math.max(1, ...Object.values(s.byShop));
  const pct = Math.round(s.cover * 100);

  return (
    <section id="troskovi" role="tabpanel" aria-labelledby="tab-troskovi">
      <div className="summary four">
        <div>
          <b>{eur(s.spent)}</b>
          <span>potrošeno u {d.toLocaleDateString("hr-HR", { month: "long" })}</span>
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
            riže i krumpira, jer one najviše utječu na trošak. Potrošnja se bilježi već sada, kad upišeš račun.
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
        <h2>Upiši račun</h2>
        <form className="edit" onSubmit={submit}>
          <label htmlFor="rcShop">
            Dućan
            <select id="rcShop" value={shop} onChange={(e) => setShop(e.target.value as ShopId)}>
              {(Object.entries(SHOPS) as [ShopId, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="rcAmount">
            Iznos (€)
            <input
              id="rcAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="npr. 47,30"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label htmlFor="rcDate">
            Datum
            <input id="rcDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label htmlFor="rcNote">
            Napomena
            <input
              id="rcNote"
              type="text"
              placeholder="tjedna kupovina"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button type="submit" className="btn">
            Spremi račun
          </button>
        </form>
        <p className="sub">
          Račun zamjenjuje procjene koje je <strong>Kupio</strong> zabilježio za taj dućan i dan, pa se ništa ne broji
          dvaput.
        </p>
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
                  <span>{shopName(k)}</span>
                  <div className="track">
                    <div className="fill" style={{ width: `${Math.max(3, (v / max) * 100)}%` }} />
                  </div>
                  <span className="num">{eur(v)}</span>
                </div>
              ))
          ) : (
            <div className="empty">Ovaj mjesec još nema zapisa. Upiši račun ili stisni Kupio u Kupovini.</div>
          )}
        </div>
      </div>

      <div className="group">
        <div className="ghead">
          <h2>Cijena po obroku</h2>
          <span className="count">recept ÷ 2 obroka</span>
        </div>
        <div className="list">
          {RECIPES.map((r) => ({ r, c: dayCost(data, r.id) }))
            .sort((a, b) => a.c.perMeal - b.c.perMeal)
            .map(({ r, c }) => (
              <div key={r.id} className="crow">
                <div>
                  <b>{r.n}</b>
                  <small>{c.known ? `${c.known}/${c.total} sastojaka ima cijenu` : "nema cijena"}</small>
                </div>
                <span className="num">{c.known ? eur(c.perMeal) : "–"}</span>
                <span className="num save">{c.known ? "−" + eur(Math.max(0, s.dost - c.perMeal)) : ""}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="group">
        <h2>Postavke usporedbe</h2>
        <div className="edit">
          <label htmlFor="setDostava">
            Prosječna dostava po obroku (€)
            <input
              id="setDostava"
              type="number"
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
        <div className="list">
          {log.length ? (
            log.map((e) => (
              <div key={e.id} className="lrow">
                <div className="ln">
                  <b>{e.note || shopName(e.shop)}</b>
                  <small>
                    {new Date(e.t).toLocaleDateString("hr-HR", { weekday: "short", day: "numeric", month: "numeric" })}{" "}
                    · {shopName(e.shop)}
                    {e.est ? " · procjena iz Kupio" : " · račun"}
                  </small>
                </div>
                <span className="num">{eur(e.amount || 0)}</span>
                <button
                  type="button"
                  className="del"
                  aria-label="Obriši zapis"
                  onClick={() => apply(removeCost(data, monthKey(e.t), e.id), "Zapis obrisan.")}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="empty">Nema zapisa za ovaj mjesec.</div>
          )}
        </div>
      </div>

      <Backup />
    </section>
  );
}

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
import { eur, fmt, monthKey } from "../logic/format";
import { exportJson, importJson } from "../storage/storage";
import { FCheck, FGroup, Page, toggle } from "../components/Page";
import type { Chip } from "../components/Page";
import { Icon } from "../components/icons";

export function Backup() {
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

type TTab = "log" | "meal" | "set";

export function TroskoviTab() {
  const { data, apply, update } = useApp();
  const s = costSummary(data);
  const tab: TTab = data.ui.trTab === "meal" ? "meal" : "log";
  const setTab = (t: TTab) =>
    update((x) => {
      const n = clone(x);
      n.ui.trTab = t;
      return n;
    });
  const [month, setMonth] = useState(s.mk);
  const [fShop, setFShop] = useState<string[]>([]);
  const [fKind, setFKind] = useState<("est" | "rac")[]>([]);
  const [fCarb, setFCarb] = useState<string[]>([]);

  const months = Array.from(new Set([s.mk, ...Object.keys(data.costs)]))
    .sort()
    .reverse();
  const cur = months.includes(month) ? month : s.mk;
  const all = (data.costs[cur] || []).slice().sort((a, b) => b.t - a.t);
  const kindOf = (e: (typeof all)[number]) => (e.est ? "est" : "rac");
  const pass = (e: (typeof all)[number], skip?: "shop" | "kind") =>
    (skip === "shop" || !fShop.length || fShop.includes(e.shop)) &&
    (skip === "kind" || !fKind.length || fKind.includes(kindOf(e)));
  const log = all.filter((e) => pass(e));
  const logSum = log.reduce((t, e) => t + (e.amount || 0), 0);
  const byShop = log.reduce<Record<string, number>>(
    (m, e) => ((m[e.shop] = (m[e.shop] || 0) + (e.amount || 0)), m),
    {},
  );
  const max = Math.max(1, ...Object.values(byShop));
  const pct = Math.round(s.cover * 100);
  const monthName = (m: string) => {
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1, 1).toLocaleDateString("hr-HR", { month: "long", year: "numeric" });
  };

  const meals = allRecipes(data)
    .filter((r) => !r.side && (!fCarb.length || fCarb.includes(r.c)))
    .map((r) => ({ r, c: dayCost(data, r.id) }))
    .sort((a, b) => a.c.perMeal - b.c.perMeal);
  const carbs = [
    ...new Set(
      allRecipes(data)
        .filter((r) => !r.side)
        .map((r) => r.c),
    ),
  ];

  const chips: Chip[] =
    tab === "log"
      ? [
          ...fShop.map((x): Chip => [shopName(data, x), () => setFShop(toggle(fShop, x))]),
          ...fKind.map((x): Chip => [x === "est" ? "S popisa" : "Račun", () => setFKind(toggle(fKind, x))]),
        ]
      : tab === "meal"
        ? fCarb.map((x): Chip => [x, () => setFCarb(toggle(fCarb, x))])
        : [];

  const filters =
    tab === "log" ? (
      <>
        <FGroup title="Mjesec">
          {months.map((m) => (
            <FCheck key={m} radio on={cur === m} label={monthName(m)} count={undefined} onChange={() => setMonth(m)} />
          ))}
        </FGroup>
        <FGroup title="Dućan" count={fShop.length}>
          {data.shops
            .filter((sh) => all.some((e) => e.shop === sh.id))
            .map((sh) => (
              <FCheck
                key={sh.id}
                on={fShop.includes(sh.id)}
                label={sh.n}
                count={all.filter((e) => pass(e, "shop") && e.shop === sh.id).length}
                onChange={() => setFShop(toggle(fShop, sh.id))}
              />
            ))}
          {!all.length && <p className="fhint">Ovaj mjesec nema zapisa.</p>}
        </FGroup>
        <FGroup title="Vrsta zapisa" count={fKind.length}>
          <FCheck
            on={fKind.includes("est")}
            label="S popisa za kupovinu"
            count={all.filter((e) => pass(e, "kind") && e.est).length}
            onChange={() => setFKind(toggle(fKind, "est"))}
          />
          <FCheck
            on={fKind.includes("rac")}
            label="Račun"
            count={all.filter((e) => pass(e, "kind") && !e.est).length}
            onChange={() => setFKind(toggle(fKind, "rac"))}
          />
        </FGroup>
      </>
    ) : tab === "meal" ? (
      <FGroup title="Ugljikohidrat" count={fCarb.length}>
        {carbs.map((c) => (
          <FCheck
            key={c}
            on={fCarb.includes(c)}
            label={c}
            dot={`cc-${c}`}
            count={allRecipes(data).filter((r) => !r.side && r.c === c).length}
            onChange={() => setFCarb(toggle(fCarb, c))}
          />
        ))}
      </FGroup>
    ) : undefined;

  return (
    <Page
      id="troskovi"
      title="Troškovi"
      count={
        tab === "log" ? (
          <>
            <b>{eur(logSum)}</b> · {monthName(cur)}
          </>
        ) : tab === "meal" ? (
          <>
            <b>{meals.length}</b> recepata
          </>
        ) : undefined
      }
      filters={filters}
      active={chips.length}
      onClear={() => {
        setFShop([]);
        setFKind([]);
        setFCarb([]);
      }}
      chips={chips}
      tabs={
        <div className="seg" role="tablist" aria-label="Prikaz troškova">
          {(
            [
              ["log", "Zapisi"],
              ["meal", "Cijena po obroku"],
            ] as [TTab, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
            >
              {l}
            </button>
          ))}
        </div>
      }
    >
      {
        <div className="kpis">
          <div>
            <span className="lbl">Potrošeno ovaj mjesec</span>
            <b>{eur(s.spent)}</b>
            <small>{s.entries.length} zapisa</small>
          </div>
          <div>
            <span className="lbl">Procjena za mjesec</span>
            <b>{s.priced ? eur(s.pace ?? s.planMonth) : "–"}</b>
            <small>
              {s.pace ? "prema tempu" : "prema planu"}
              {s.pace && s.priced ? ` · plan ${eur(s.planMonth)}` : ""}
            </small>
          </div>
          <div>
            <span className="lbl">Prosječan obrok</span>
            <b>{s.priced ? eur(s.avgMeal) : "–"}</b>
            <small>dostava {eur(s.dost)}</small>
          </div>
          <div>
            <span className="lbl">Ušteda mjesečno</span>
            <b className="save">{s.priced ? eur(Math.max(0, s.saveMonth)) : "–"}</b>
            <small>ručak i večera vs dostava</small>
          </div>
        </div>
      }

      {tab === "log" && (
        <>
          {Object.keys(byShop).length > 0 && (
            <div className="list shopbars">
              {Object.entries(byShop)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k} className="bar">
                    <span>{shopName(data, k)}</span>
                    <div className="track">
                      <div className="fill" style={{ width: `${Math.max(3, (v / max) * 100)}%` }} />
                    </div>
                    <span className="num">{eur(v)}</span>
                  </div>
                ))}
            </div>
          )}
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
                        <td className="txt muted">
                          {new Date(e.t).toLocaleDateString("hr-HR", {
                            weekday: "short",
                            day: "numeric",
                            month: "numeric",
                          })}
                        </td>
                        <td className="sticky" style={{ minWidth: 160 }}>
                          <div className="namecell">
                            <TextCell
                              label="Opis"
                              value={e.note || shopName(data, e.shop)}
                              onCommit={(v) => update((x) => editCost(x, mk, e.id, { note: v }))}
                            />
                          </div>
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
                          <NumCell
                            label="Iznos"
                            value={e.amount}
                            onCommit={(v) => update((x) => editCost(x, mk, e.id, { amount: v ?? 0 }))}
                          />
                        </td>
                        <td className="txt">
                          <span className={"chip " + (e.est ? "" : "p-ok")}>{e.est ? "s popisa" : "račun"}</span>
                        </td>
                        <td className="c">
                          <button
                            type="button"
                            className="rowbtn"
                            aria-label="Obriši zapis"
                            onClick={() => apply(removeCost(data, mk, e.id), "Zapis obrisan.")}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="tblfoot">
                <span>{log.length} zapisa</span>
                <span className="tblsum">
                  Ukupno: <b>{eur(logSum)}</b>
                </span>
              </div>
            </div>
          ) : (
            <div className="empty">
              <b>Nema zapisa.</b>
              <span>Kvačicom u Kupovini zapisuješ kupljeno i cijenu.</span>
            </div>
          )}
        </>
      )}

      {tab === "meal" && (
        <>
          <p className="sub">
            {!s.priced ? (
              <>
                <strong>Još nema cijena.</strong> U Zalihi upiši cijenu pakiranja, kreni od mesa, riže i krumpira.
              </>
            ) : (
              <>
                Po obroku uključuje recept, miso juhu, posni sir i salate (recept ÷ 2 obroka). Cijene su poznate za{" "}
                <strong>{pct} %</strong> sastojaka{pct < 80 ? ", pa je stvarni trošak nešto veći" : ""}.
              </>
            )}
          </p>
          <div className="tablewrap">
            <table className="grid rows" aria-label="Cijena po obroku">
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
                {meals.map(({ r, c }) => (
                  <tr key={r.id}>
                    <td className="sticky">
                      <span className="iname">{r.n}</span>
                    </td>
                    <td className="txt">
                      <span className={`chip carb-chip cc-${r.c}`}>{r.c}</span>
                    </td>
                    <td className="txt num strong">{c.known ? eur(c.perMeal) : "–"}</td>
                    <td className="txt num muted">{eur(s.dost)}</td>
                    <td className="txt num save">{c.known ? eur(Math.max(0, s.dost - c.perMeal)) : "–"}</td>
                    <td className="txt num muted">
                      {c.known}/{c.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Page>
  );
}

import { Fragment, useState } from "react";
import type { FormEvent } from "react";
import { useApp } from "../state/AppContext";
import { visibleItems } from "../logic/items";
import { shopping } from "../logic/inventory";
import { addShop, editShop, removeShop } from "../logic/shops";
import { eur, monthKey } from "../logic/format";
import { shopSpend } from "../logic/costs";
import { TextCell } from "../components/Cells";
import { Icon } from "../components/icons";
import { FCheck, FGroup, FSearch, Page, toggle } from "../components/Page";
import type { Chip } from "../components/Page";

const TYPES = ["Supermarket", "Zdrava hrana", "Azijski dućan", "Tržnica", "Mesnica", "Pekara", "Online", "Ostalo"];

function AddShop({ onDone }: { onDone: () => void }) {
  const { data, apply } = useApp();
  const [n, setN] = useState("");
  const [type, setType] = useState("Supermarket");
  const [addr, setAddr] = useState("");
  const [url, setUrl] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!n.trim()) return;
    const r = addShop(data, { n, type, addr: addr.trim(), url: url.trim(), note: "" });
    apply(r.data, r.msg);
    onDone();
  };
  return (
    <form className="formcard" onSubmit={submit} aria-label="Novi dućan">
      <h3>Novi dućan</h3>
      <div className="formgrid">
        <label>
          Naziv
          <input value={n} onChange={(e) => setN(e.target.value)} placeholder="npr. Konzum Savska" autoFocus />
        </label>
        <label>
          Vrsta
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Adresa
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="ulica ili webshop" />
        </label>
        <label>
          Web
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
        </label>
      </div>
      <div className="btnrow">
        <button type="submit" className="btn" disabled={!n.trim()}>
          Dodaj
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          Odustani
        </button>
      </div>
    </form>
  );
}

export function DucaniTab() {
  const { data, apply, update } = useApp();
  const [adding, setAdding] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const items = visibleItems(data);
  const toBuy = shopping(data);
  const spent = (data.costs[monthKey()] || []).reduce<Record<string, number>>(
    (m, e) => ((m[e.shop] = (m[e.shop] || 0) + e.amount), m),
    {},
  );
  const sp = shopSpend(data);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState<string[]>([]);
  const [fBuy, setFBuy] = useState(false);
  const term = q.trim().toLowerCase();
  const pass = (s: (typeof data.shops)[number], skip?: "type") =>
    (!term || `${s.n} ${s.addr}`.toLowerCase().includes(term)) &&
    (skip === "type" || !fType.length || fType.includes(s.type)) &&
    (!fBuy || toBuy.some((x) => x.i.src === s.id));
  const shops = data.shops.filter((s) => pass(s));
  const types = [...new Set([...TYPES, ...data.shops.map((s) => s.type)])].filter((t) =>
    data.shops.some((s) => s.type === t),
  );
  const chips: Chip[] = [
    ...fType.map((t): Chip => [t, () => setFType(toggle(fType, t))]),
    ...(fBuy ? [["Ima nešto za kupiti", () => setFBuy(false)] as Chip] : []),
  ];

  const filters = (
    <>
      <FSearch value={q} onChange={setQ} placeholder="Traži dućan" />
      <FGroup title="Vrsta" count={fType.length}>
        {types.map((t) => (
          <FCheck
            key={t}
            on={fType.includes(t)}
            label={t}
            count={data.shops.filter((s) => pass(s, "type") && s.type === t).length}
            onChange={() => setFType(toggle(fType, t))}
          />
        ))}
      </FGroup>
      <FGroup title="Kupovina" count={fBuy ? 1 : 0}>
        <FCheck
          on={fBuy}
          label="Ima nešto za kupiti"
          count={data.shops.filter((s) => toBuy.some((x) => x.i.src === s.id)).length}
          onChange={() => setFBuy(!fBuy)}
        />
      </FGroup>
      <p className="fhint">
        Svaka namirnica ima svoj dućan (mijenjaš ga u Zalihi), pa se po njemu slaže popis za kupovinu.
      </p>
    </>
  );

  return (
    <Page
      id="ducani"
      title="Dućani"
      count={
        <>
          <b>{shops.length}</b> od {data.shops.length}
        </>
      }
      filters={filters}
      active={chips.length}
      onClear={() => {
        setFType([]);
        setFBuy(false);
      }}
      chips={chips}
      actions={
        !adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Dodaj dućan
          </button>
        )
      }
    >
      {adding && <AddShop onDone={() => setAdding(false)} />}

      <div className="tablewrap">
        <table className="grid shops-table">
          <thead>
            <tr>
              <th className="sticky">Dućan</th>
              <th>Vrsta</th>
              <th>Adresa</th>
              <th>Web</th>
              <th className="num">Namirnica</th>
              <th className="num">Za kupiti</th>
              <th className="num">Ovaj mjesec</th>
              <th className="num">Dosad ukupno</th>
              <th className="num" title="Klizni prosjek zadnjih 26 tjedana">
                Tjedno (6 mj.)
              </th>
              <th className="c">
                <span className="sr-only">Više</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => {
              const its = items.filter((i) => i.src === s.id);
              const buy = toBuy.filter((x) => x.i.src === s.id);
              const buyCost = buy.reduce((t, x) => t + (x.cost ?? 0), 0);
              const isOpen = openRow === s.id;
              const ed = (p: Parameters<typeof editShop>[2]) => update((d) => editShop(d, s.id, p));
              return (
                <Fragment key={s.id}>
                  <tr>
                    <td className="sticky">
                      <div className="ent">
                        <span className="thumb shop" aria-hidden="true">
                          {s.n.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="namecell grow">
                          <TextCell label={`Naziv: ${s.n}`} value={s.n} onCommit={(v) => ed({ n: v })} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="cellsel"
                        aria-label={`Vrsta: ${s.n}`}
                        value={s.type}
                        onChange={(e) => ed({ type: e.target.value })}
                      >
                        {[...new Set([...TYPES, s.type])].filter(Boolean).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <TextCell label={`Adresa: ${s.n}`} value={s.addr} onCommit={(v) => ed({ addr: v })} />
                    </td>
                    <td className="c">
                      {s.url ? (
                        <a className="mini" href={s.url} target="_blank" rel="noopener" aria-label={`Web: ${s.n}`}>
                          <Icon name="link" size={16} />
                        </a>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                    <td className="num">{its.length || "–"}</td>
                    <td className="num">
                      {buy.length ? (
                        <>
                          <b>{buy.length}</b>
                          {buyCost > 0 && <span className="muted"> · ≈ {eur(buyCost)}</span>}
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="num">{spent[s.id] ? eur(spent[s.id]) : "–"}</td>
                    <td className="num">{sp.byShop[s.id]?.total ? eur(sp.byShop[s.id].total) : "–"}</td>
                    <td className="num strong">{sp.byShop[s.id]?.weekly ? eur(sp.byShop[s.id].weekly) : "–"}</td>
                    <td className="c">
                      <button
                        type="button"
                        className="mini"
                        aria-expanded={isOpen}
                        aria-label={`Više o dućanu ${s.n}`}
                        onClick={() => setOpenRow(isOpen ? null : s.id)}
                      >
                        <Icon name="more" size={16} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="detailrow">
                      <td colSpan={10}>
                        <div className="shopdetail">
                          <label className="wide">
                            Bilješka
                            <input
                              defaultValue={s.note}
                              onBlur={(e) => e.target.value !== s.note && ed({ note: e.target.value })}
                              placeholder="radno vrijeme, akcije, što tamo kupuješ…"
                            />
                          </label>
                          <label className="wide">
                            Web adresa
                            <input
                              defaultValue={s.url}
                              inputMode="url"
                              onBlur={(e) => e.target.value !== s.url && ed({ url: e.target.value.trim() })}
                              placeholder="https://…"
                            />
                          </label>
                          {s.links && s.links.length > 0 && (
                            <div className="wide">
                              <h4>Korisni linkovi</h4>
                              <div className="chips">
                                {s.links.map((l) => (
                                  <a key={l.url} className="chip linkchip" href={l.url} target="_blank" rel="noopener">
                                    {l.n} <Icon name="link" size={12} />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="wide">
                            <h4>Namirnice iz ovog dućana</h4>
                            {its.length ? (
                              <div className="chips">
                                {its.map((i) => (
                                  <span
                                    key={i.id}
                                    className={"chip" + (buy.some((x) => x.i.id === i.id) ? " warn" : "")}
                                  >
                                    {i.n}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="sub">Još nijedna. Dućan namirnici biraš u Zalihi.</p>
                            )}
                          </div>
                          {s.id !== "O" && (
                            <div className="btnrow wide">
                              {confirm === s.id ? (
                                <>
                                  <span className="count">
                                    {its.length ? `${its.length} namirnica prelazi na Ostalo.` : "Sigurno?"}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn danger"
                                    onClick={() => {
                                      const r = removeShop(data, s.id);
                                      apply(r.data, r.msg);
                                      setConfirm(null);
                                      setOpenRow(null);
                                    }}
                                  >
                                    Da, obriši
                                  </button>
                                  <button type="button" className="btn ghost" onClick={() => setConfirm(null)}>
                                    Odustani
                                  </button>
                                </>
                              ) : (
                                <button type="button" className="btn ghost" onClick={() => setConfirm(s.id)}>
                                  <Icon name="trash" size={16} /> Obriši dućan
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div className="tblfoot">
          <span>
            Tjedni prosjek je klizni prosjek zadnjih 6 mjeseci
            {sp.weeks < 26 ? ` (zapisi postoje ${Math.round(sp.weeks)} tjedana)` : ""}.
          </span>
          <span className="tblsum">
            Ukupno tjedno: <b>{eur(Object.values(sp.byShop).reduce((t, x) => t + x.weekly, 0))}</b>
          </span>
        </div>
      </div>
    </Page>
  );
}

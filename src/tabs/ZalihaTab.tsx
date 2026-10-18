import { Fragment, useState } from "react";
import { OM_FILL } from "../data";
import { allPreps, prepInv } from "../logic/preps";
import { catName, catOpts, grpName, grpOpts, isMass } from "../logic/lists";
import type { CatId, GrpId, Item } from "../data";
import { shopIndex, shopName, shopOpts } from "../logic/shops";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { AppData } from "../state/model";
import { pc, price, qty, status } from "../logic/inventory";
import type { Status } from "../logic/inventory";
import { hiddenItems, isCustom, visibleItems } from "../logic/items";
import { buy, editItem, removeItem, resetItems, setHidden, setQty } from "../logic/actions";
import { ItemInfo } from "../components/ItemInfo";
import { macDisplay } from "../logic/omlet";
import { fmt, pfmt } from "../logic/format";
import { Note, StatusPill } from "../components/ui";
import { FCheck, FGroup, FSearch, Page, toggle } from "../components/Page";
import type { Chip } from "../components/Page";
import { ItemForm } from "../components/ItemForm";
import { NumCell, SelectCell, SortTh, TextCell } from "../components/Cells";
import { Icon } from "../components/icons";

type SortK = "mjesto" | "grp" | "n" | "src" | "qty" | "stanje" | "min" | "pack" | "price" | "kcal" | "prot";

const OM_OPTS: ["" | "prot" | "veg", string][] = [
  ["", "—"],
  ["prot", "protein"],
  ["veg", "povrće"],
];
/** Ugrađene namirnice koje se koriste u ugrađenim nadjevima za omlet */
const BUILTIN_OM = new Set(OM_FILL.flatMap((f) => Object.keys(f.use)));
const ST_ORDER: Record<Status, number> = { out: 0, low: 1, ok: 2, none: 3 };

function PrepStock({ data, update }: { data: AppData; update: (fn: (d: AppData) => AppData) => void }) {
  const have = allPreps(data).filter((p) => pc(data, p.id) > 0);
  if (!have.length) return null;
  const set = (id: string, v: number) =>
    update((d) => {
      const n = clone(d);
      n.prepStock[id] = Math.max(0, v);
      return n;
    });
  return (
    <div>
      <div className="tablewrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky">Što</th>
              <th className="num">Imam</th>
              <th>Jedinica</th>
              <th>Čuvanje</th>
            </tr>
          </thead>
          <tbody>
            {have.map((p) => (
              <tr key={p.id}>
                <td className="sticky txt">
                  <b>{p.n}</b>
                </td>
                <td style={{ width: 90 }}>
                  <NumCell label={`Imam: ${p.n}`} value={pc(data, p.id)} onCommit={(v) => set(p.id, v ?? 0)} />
                </td>
                <td className="txt">
                  {pfmt(pc(data, p.id), prepInv(data, p.id)?.unit ?? "porcija").replace(/^[\d,.]+ /, "")}
                </td>
                <td className="txt">{p.keep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ i, open, onToggle }: { i: Item; open: boolean; onToggle: () => void }) {
  const { data, update, apply } = useApp();
  const st = status(data, i);
  const q = qty(data, i.id);
  const p = price(data, i.id);
  const custom = isCustom(i.id);
  const [kcal, prot] = macDisplay(data, i.id);
  const per = isMass(i.u) ? `/100 ${i.u}` : `/${i.u}`;
  const change = (fn: (n: AppData) => AppData | void) =>
    update((d) => {
      const n = clone(d);
      return fn(n) || n;
    });
  const pct = i.min > 0 ? Math.min(100, (q / (i.min * 2)) * 100) : q > 0 ? 100 : 0;

  return (
    <>
      <tr className={`st-${st}`}>
        <td className="sticky" style={{ minWidth: 180 }}>
          <div className="namecell">
            <TextCell label="Naziv" value={i.n} onCommit={(v) => change((n) => editItem(n, i.id, { n: v }))} />
          </div>
        </td>
        <td style={{ minWidth: 112 }}>
          <SelectCell<CatId>
            label={`Mjesto: ${i.n}`}
            value={i.cat}
            options={catOpts(data)}
            onChange={(v) => change((n) => editItem(n, i.id, { cat: v }))}
          />
        </td>
        <td style={{ minWidth: 150 }}>
          <SelectCell<GrpId>
            label={`Skupina: ${i.n}`}
            value={i.grp ?? "ostalo"}
            options={grpOpts(data)}
            onChange={(v) => change((n) => editItem(n, i.id, { grp: v }))}
          />
        </td>
        <td style={{ minWidth: 118 }}>
          <SelectCell<string>
            label={`Dućan: ${i.n}`}
            value={i.src}
            options={shopOpts(data)}
            onChange={(v) => change((n) => editItem(n, i.id, { src: v }))}
          />
        </td>
        <td style={{ minWidth: 96 }}>
          <NumCell label={`Imam (${i.u}): ${i.n}`} value={q} onCommit={(v) => change((n) => setQty(n, i.id, v ?? 0))} />
          <div className="qtybar" aria-hidden="true">
            <i className={st} style={{ width: `${pct}%` }} />
          </div>
        </td>
        <td className="txt c">{i.u}</td>
        <td className="c" style={{ minWidth: 76 }}>
          <span className="stepper inline">
            <button
              type="button"
              aria-label={`Manje: ${i.n}`}
              onClick={() => change((n) => setQty(n, i.id, qty(n, i.id) - i.step))}
            >
              −
            </button>
            <button
              type="button"
              aria-label={`Više: ${i.n}`}
              onClick={() => change((n) => setQty(n, i.id, qty(n, i.id) + i.step))}
            >
              +
            </button>
          </span>
        </td>
        <td className="txt c">
          <StatusPill s={st} />
        </td>
        <td style={{ width: 84 }}>
          <NumCell
            label={`Minimum (${i.u}): ${i.n}`}
            value={i.min}
            onCommit={(v) => change((n) => editItem(n, i.id, { min: v ?? 0 }))}
          />
        </td>
        <td style={{ width: 92 }}>
          <NumCell
            label={`Pakiranje (${i.u}): ${i.n}`}
            value={i.pack}
            onCommit={(v) => v && change((n) => editItem(n, i.id, { pack: v }))}
          />
        </td>
        <td style={{ width: 92 }}>
          <NumCell
            label={`Cijena pakiranja (€): ${i.n}`}
            placeholder="€"
            allowEmpty
            value={p}
            onCommit={(v) =>
              change((n) => {
                n.stock[i.id] = { qty: qty(n, i.id), price: v };
              })
            }
          />
        </td>
        <td style={{ width: 84 }} title={`kcal ${per}`}>
          <NumCell
            label={`kcal ${per}: ${i.n}`}
            placeholder="–"
            allowEmpty
            value={kcal}
            onCommit={(v) => change((n) => editItem(n, i.id, { kcal: v ?? undefined }))}
          />
        </td>
        <td style={{ width: 76 }} title={`proteini g ${per}`}>
          <NumCell
            label={`Proteini ${per}: ${i.n}`}
            placeholder="–"
            allowEmpty
            value={prot}
            onCommit={(v) => change((n) => editItem(n, i.id, { prot: v ?? undefined }))}
          />
        </td>
        <td style={{ minWidth: 96 }}>
          {custom ? (
            <SelectCell
              label={`Omlet: ${i.n}`}
              value={i.om?.role ?? ""}
              options={OM_OPTS}
              onChange={(v) =>
                change((n) =>
                  editItem(n, i.id, {
                    om: v
                      ? { role: v, amt: i.om?.amt ?? (isMass(i.u) ? 50 : 1), ...(i.om?.pre ? { pre: i.om.pre } : {}) }
                      : undefined,
                  }),
                )
              }
            />
          ) : (
            <span className="txt" style={{ padding: "7px 8px", display: "block", color: "var(--muted)" }}>
              {BUILTIN_OM.has(i.id) ? "ugrađeno" : "—"}
            </span>
          )}
        </td>
        <td style={{ width: 84 }}>
          {custom && i.om ? (
            <NumCell
              label={`Količina u omletu (${i.u}): ${i.n}`}
              value={i.om.amt}
              onCommit={(v) => v && change((n) => editItem(n, i.id, { om: { ...i.om!, amt: v } }))}
            />
          ) : (
            <span className="txt" style={{ padding: "7px 8px", display: "block", color: "var(--muted)" }}>
              –
            </span>
          )}
        </td>
        <td className="c">
          <button
            type="button"
            className="rowbtn"
            aria-expanded={open}
            aria-label={`Više opcija: ${i.n}`}
            onClick={onToggle}
          >
            <Icon name="more" />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="detailrow">
          <td colSpan={16}>
            <div className="btnrow">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const r = buy(data, i.id, 1);
                  apply(r.data, r.msg);
                }}
              >
                Kupio +{fmt(i.pack, i.u)}
              </button>
              {custom ? (
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => {
                    const r = removeItem(data, i.id);
                    apply(r.data, r.msg);
                  }}
                >
                  Obriši namirnicu
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const r = setHidden(data, i.id, true);
                    apply(r.data, r.msg);
                  }}
                >
                  Ne koristim, sakrij
                </button>
              )}
              {custom && i.om && (
                <label className="inline-label" htmlFor={`pre-${i.id}`}>
                  Priprema u omletu
                  <input
                    id={`pre-${i.id}`}
                    className="search"
                    type="text"
                    defaultValue={i.om.pre ?? ""}
                    placeholder="npr. Nareži i zapeci 3 min."
                    onBlur={(e) =>
                      change((n) => editItem(n, i.id, { om: { ...i.om!, pre: e.target.value.trim() || undefined } }))
                    }
                  />
                </label>
              )}
            </div>
            <h4 className="omh">Proizvod, kalorije i nazivi za recepte</h4>
            <ItemInfo idp={`ii-${i.id}`} item={i} onPatch={(p) => change((n) => editItem(n, i.id, p))} />
            <p className="sub">
              Kcal i proteini su {per.replace("/", "na ")}. {custom ? "" : "Prazno znači ugrađenu vrijednost. "}
              Brisanje i sakrivanje možeš poništiti odmah nakon toga.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

type ZTab = "items" | "prep" | "hidden";
const ST_LABEL: [Status, string, string][] = [
  ["out", "Nema", "st-out"],
  ["low", "Nisko", "st-low"],
  ["ok", "Na zalihi", "st-ok"],
  ["none", "Bez minimuma", "st-none"],
];

export function ZalihaTab() {
  const { data, update, apply } = useApp();
  const [tab, setTab] = useState<ZTab>("items");
  const [q, setQ] = useState("");
  const [fSt, setFSt] = useState<Status[]>([]);
  const [fCat, setFCat] = useState<CatId[]>([]);
  const [fGrp, setFGrp] = useState<GrpId[]>([]);
  const [fShop, setFShop] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sort, setSort] = useState<{ k: SortK; dir: 1 | -1 }>({ k: "mjesto", dir: 1 });
  const items = visibleItems(data);
  const hidden = hiddenItems(data);
  const term = q.trim().toLowerCase();
  const prepHave = allPreps(data).filter((p) => pc(data, p.id) > 0);

  const pass = (i: Item, skip?: "st" | "cat" | "shop" | "grp") =>
    (!term || i.n.toLowerCase().includes(term)) &&
    (skip === "grp" || !fGrp.length || fGrp.includes(i.grp ?? "ostalo")) &&
    (skip === "st" || !fSt.length || fSt.includes(status(data, i))) &&
    (skip === "cat" || !fCat.length || fCat.includes(i.cat)) &&
    (skip === "shop" || !fShop.length || fShop.includes(i.src));
  const cnt = (skip: "st" | "cat" | "shop" | "grp", ok: (i: Item) => boolean) =>
    items.filter((i) => pass(i, skip) && ok(i)).length;

  let rows = items.filter((i) => pass(i));
  const val = (i: Item): number | string => {
    switch (sort.k) {
      case "n":
        return i.n.toLowerCase();
      case "src":
        return shopIndex(data, i.src);
      case "qty":
        return qty(data, i.id);
      case "stanje":
        return ST_ORDER[status(data, i)];
      case "min":
        return i.min;
      case "pack":
        return i.pack;
      case "price":
        return price(data, i.id) ?? -1;
      case "grp":
        return grpOpts(data).findIndex(([k]) => k === i.grp);
      case "kcal":
        return macDisplay(data, i.id)[0] ?? -1;
      case "prot":
        return macDisplay(data, i.id)[1] ?? -1;
      default:
        return catOpts(data).findIndex(([k]) => k === i.cat) * 1000 + 0;
    }
  };
  rows = rows.slice().sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c = x < y ? -1 : x > y ? 1 : a.n.localeCompare(b.n, "hr");
    return c * sort.dir;
  });
  const grouped = sort.k === "mjesto" || sort.k === "grp";
  const gkey = (i: Item) => (sort.k === "grp" ? (i.grp ?? "ostalo") : i.cat);
  const gname = (i: Item) => (sort.k === "grp" ? grpName(data, i.grp) : catName(data, i.cat));
  const hiddenMatches = term ? hidden.filter((i) => i.n.toLowerCase().includes(term)) : [];
  const nOut = items.filter((i) => status(data, i) === "out").length;
  const nLow = items.filter((i) => status(data, i) === "low").length;

  const chips: Chip[] = [
    ...fSt.map((x): Chip => [ST_LABEL.find(([k]) => k === x)![1], () => setFSt(toggle(fSt, x))]),
    ...fCat.map((x): Chip => [catName(data, x), () => setFCat(toggle(fCat, x))]),
    ...fGrp.map((x): Chip => [grpName(data, x), () => setFGrp(toggle(fGrp, x))]),
    ...fShop.map((x): Chip => [shopName(data, x), () => setFShop(toggle(fShop, x))]),
  ];
  const clear = () => {
    setFSt([]);
    setFCat([]);
    setFGrp([]);
    setFShop([]);
  };

  const search = <FSearch id="itemSearch" value={q} onChange={setQ} placeholder="Traži namirnicu" />;

  const filters = (
    <>
      <FGroup title="Stanje" count={fSt.length}>
        {ST_LABEL.map(([k, l, cls]) => (
          <FCheck
            key={k}
            on={fSt.includes(k)}
            label={l}
            dot={cls}
            count={cnt("st", (i) => status(data, i) === k)}
            onChange={() => setFSt(toggle(fSt, k))}
          />
        ))}
      </FGroup>
      <FGroup title="Mjesto" count={fCat.length}>
        {catOpts(data).map(([k, l]) => (
          <FCheck
            key={k}
            on={fCat.includes(k)}
            label={l}
            dot={`l-${k}`}
            count={cnt("cat", (i) => i.cat === k)}
            onChange={() => setFCat(toggle(fCat, k))}
          />
        ))}
      </FGroup>
      <FGroup title="Skupina" count={fGrp.length}>
        {grpOpts(data).map(([k, l]) => (
          <FCheck
            key={k}
            on={fGrp.includes(k)}
            label={l}
            count={cnt("grp", (i) => (i.grp ?? "ostalo") === k)}
            onChange={() => setFGrp(toggle(fGrp, k))}
          />
        ))}
      </FGroup>
      <FGroup title="Dućan" count={fShop.length}>
        {data.shops.map((sh) => (
          <FCheck
            key={sh.id}
            on={fShop.includes(sh.id)}
            label={sh.n}
            count={cnt("shop", (i) => i.src === sh.id)}
            onChange={() => setFShop(toggle(fShop, sh.id))}
          />
        ))}
      </FGroup>
    </>
  );

  return (
    <Page
      id="zaliha"
      title="Zaliha"
      count={
        <>
          <b>{rows.length}</b> od {items.length} · <span className="t-out">{nOut} nema</span> ·{" "}
          <span className="t-low">{nLow} nisko</span>
        </>
      }
      filters={filters}
      search={search}
      active={chips.length}
      onClear={clear}
      chips={chips}
      tabs={
        <div className="seg" role="tablist" aria-label="Prikaz zalihe">
          {(
            [
              ["items", "Namirnice", items.length],
              ["prep", "Pripremljeno", prepHave.length],
              ["hidden", "Skrivene", hidden.length],
            ] as [ZTab, string, number][]
          ).map(([k, l, c]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
            >
              {l} <small>{c}</small>
            </button>
          ))}
        </div>
      }
      actions={
        !adding && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} /> Dodaj namirnicu
          </button>
        )
      }
    >
      {adding && <ItemForm initialName={q.trim()} onDone={() => setAdding(false)} />}

      {tab === "prep" &&
        (prepHave.length ? (
          <PrepStock data={data} update={update} />
        ) : (
          <Note>Nemaš ništa pripremljeno. Recepte za prep nađeš u Receptima.</Note>
        ))}

      {tab === "hidden" &&
        (hidden.length ? (
          <div className="tablewrap">
            <table className="grid rows">
              <thead>
                <tr>
                  <th className="sticky">Namirnica</th>
                  <th>Mjesto</th>
                  <th>Dućan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hidden
                  .filter((i) => pass(i))
                  .map((i) => (
                    <tr key={i.id}>
                      <td className="sticky">
                        <span className="iname">{i.n}</span>
                      </td>
                      <td>
                        <span className={`label l-${i.cat}`}>{catName(data, i.cat)}</span>
                      </td>
                      <td className="muted">{shopName(data, i.src)}</td>
                      <td className="c" style={{ width: 90 }}>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => {
                            const r = setHidden(data, i.id, false);
                            apply(r.data, r.msg);
                          }}
                        >
                          Vrati
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="tblfoot">
              <span>
                Skrivene ne dolaze na popis za kupovinu, osim ako ih traži recept ili omlet koji si isplanirao.
              </span>
            </div>
          </div>
        ) : (
          <Note>Nema skrivenih namirnica.</Note>
        ))}

      {tab === "items" && (
        <>
          {rows.length > 0 ? (
            <div className="tablewrap">
              <table className="grid" aria-label="Zaliha namirnica">
                <thead>
                  <tr>
                    <SortTh k="n" sort={sort} setSort={setSort} className="sticky">
                      Naziv
                    </SortTh>
                    <SortTh k="mjesto" sort={sort} setSort={setSort}>
                      Mjesto
                    </SortTh>
                    <SortTh k="grp" sort={sort} setSort={setSort}>
                      Skupina
                    </SortTh>
                    <SortTh k="src" sort={sort} setSort={setSort}>
                      Dućan
                    </SortTh>
                    <SortTh k="qty" sort={sort} setSort={setSort} className="num">
                      Imam
                    </SortTh>
                    <th>Jed.</th>
                    <th>±</th>
                    <SortTh k="stanje" sort={sort} setSort={setSort}>
                      Stanje
                    </SortTh>
                    <SortTh k="min" sort={sort} setSort={setSort} className="num">
                      Min.
                    </SortTh>
                    <SortTh k="pack" sort={sort} setSort={setSort} className="num">
                      Pakiranje
                    </SortTh>
                    <SortTh k="price" sort={sort} setSort={setSort} className="num">
                      €/pak.
                    </SortTh>
                    <SortTh k="kcal" sort={sort} setSort={setSort} className="num">
                      kcal
                    </SortTh>
                    <SortTh k="prot" sort={sort} setSort={setSort} className="num">
                      Prot. g
                    </SortTh>
                    <th>Omlet</th>
                    <th className="num">U omletu</th>
                    <th>
                      <span className="sr-only">Opcije</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i, k) => (
                    <Fragment key={i.id}>
                      {grouped && (k === 0 || gkey(rows[k - 1]) !== gkey(i)) && (
                        <tr className="grouprow">
                          <td className="sticky">{gname(i)}</td>
                          <td colSpan={15} />
                        </tr>
                      )}
                      <Row i={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <div className="tblfoot">
                <span>Klikni ćeliju i piši. Enter sprema, Esc odustaje. Klik na naslov kolone sortira.</span>
                {!confirmReset && (
                  <button type="button" className="linkbtn danger" onClick={() => setConfirmReset(true)}>
                    Obriši sve namirnice
                  </button>
                )}
              </div>
            </div>
          ) : term ? (
            !hiddenMatches.length && (
              <Note>
                Nema namirnice „{q.trim()}”.{" "}
                <button type="button" className="linkbtn" onClick={() => setAdding(true)}>
                  Dodaj je
                </button>
              </Note>
            )
          ) : items.length === 0 ? (
            <Note>
              <strong>Zaliha je prazna.</strong> U tražilicu lijevo upiši što imaš, npr. „jaja”. Ako je to u katalogu,
              vratiš ga jednim klikom, a ako nije, dodaš novu namirnicu.
            </Note>
          ) : (
            <Note>Nijedna namirnica ne odgovara filterima.</Note>
          )}

          {hiddenMatches.length > 0 && (
            <div className="group">
              <div className="ghead">
                <h2>Iz kataloga</h2>
                <span className="count">skriveno, vrati jednim klikom</span>
              </div>
              <div className="tablewrap">
                <table className="grid rows">
                  <tbody>
                    {hiddenMatches.map((i) => (
                      <tr key={i.id}>
                        <td className="sticky">
                          <span className="iname">{i.n}</span>
                        </td>
                        <td className="txt">{catName(data, i.cat)}</td>
                        <td className="txt">
                          {i.u} · pakiranje {fmt(i.pack, i.u)}
                        </td>
                        <td className="c" style={{ width: 90 }}>
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => {
                              const r = setHidden(data, i.id, false);
                              apply(r.data, r.msg);
                              setQ("");
                            }}
                          >
                            Vrati
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sub">
                Nije to što tražiš?{" "}
                <button type="button" className="linkbtn" onClick={() => setAdding(true)}>
                  Dodaj novu namirnicu „{q.trim()}”
                </button>
              </p>
            </div>
          )}

          {confirmReset && (
            <div className="confirm" role="alertdialog" aria-label="Potvrda brisanja zalihe">
              <b>Obrisati sve namirnice?</b>
              <span className="sub">
                Sakrit će se sve ugrađene namirnice, obrisat će se tvoje dodane namirnice te sve količine, cijene i
                pripremljeno. Recepti, plan, omleti i troškovi ostaju. Ugrađene namirnice uvijek možeš vratiti preko
                tražilice.
              </span>
              <div className="btnrow">
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    const r = resetItems(data);
                    apply(r.data, r.msg);
                    setConfirmReset(false);
                    setQ("");
                    clear();
                    window.scrollTo({ top: 0 });
                  }}
                >
                  Da, obriši sve
                </button>
                <button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>
                  Odustani
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import { CATS, SHOPS } from "../data";
import type { CatId, Item, ShopId, Unit } from "../data";
import { useApp } from "../state/AppContext";
import { newCustomItem, visibleItems } from "../logic/items";
import { addItem } from "../logic/actions";

const UNITS: [Unit, string][] = [
  ["g", "grami (g)"],
  ["ml", "mililitri (ml)"],
  ["kom", "komadi (kom)"],
];
const parse = (s: string) => parseFloat(s.replace(",", "."));
const per = (u: Unit) => (u === "kom" ? "po komadu" : `na 100 ${u}`);

export type OmRole = "" | "prot" | "veg";

/** Polja za omlet i kalorije, zajednička za novu i postojeću namirnicu */
export function OmFields({
  idp,
  u,
  role,
  setRole,
  amt,
  setAmt,
  pre,
  setPre,
  kcal,
  setKcal,
  prot,
  setProt,
  onBlur,
}: {
  idp: string;
  u: Unit;
  role: OmRole;
  setRole: (v: OmRole) => void;
  amt: string;
  setAmt: (v: string) => void;
  pre: string;
  setPre: (v: string) => void;
  kcal: string;
  setKcal: (v: string) => void;
  prot: string;
  setProt: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div className="edit">
      <label htmlFor={`${idp}-role`}>
        U omletu
        <select id={`${idp}-role`} value={role} onChange={(e) => setRole(e.target.value as OmRole)} onBlur={onBlur}>
          <option value="">Ne koristim u omletu</option>
          <option value="prot">Kao protein</option>
          <option value="veg">Kao povrće</option>
        </select>
      </label>
      {role && (
        <>
          <label htmlFor={`${idp}-amt`}>
            Količina po omletu ({u})
            <input
              id={`${idp}-amt`}
              type="text"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder={u === "kom" ? "1" : "50"}
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              onBlur={onBlur}
            />
          </label>
          <label htmlFor={`${idp}-pre`}>
            Kako se priprema (po želji)
            <input
              id={`${idp}-pre`}
              type="text"
              placeholder="npr. Nareži na kolutiće i zapeci 3 min."
              value={pre}
              onChange={(e) => setPre(e.target.value)}
              onBlur={onBlur}
            />
          </label>
        </>
      )}
      <label htmlFor={`${idp}-kcal`}>
        kcal {per(u)} (s deklaracije)
        <input
          id={`${idp}-kcal`}
          type="text"
          inputMode="decimal"
          min="0"
          step="any"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          onBlur={onBlur}
        />
      </label>
      <label htmlFor={`${idp}-prot`}>
        Proteini (g) {per(u)}
        <input
          id={`${idp}-prot`}
          type="text"
          inputMode="decimal"
          min="0"
          step="any"
          value={prot}
          onChange={(e) => setProt(e.target.value)}
          onBlur={onBlur}
        />
      </label>
    </div>
  );
}

/** Pretvori polja u vrijednosti namirnice */
export function omPatch(
  role: OmRole,
  amt: string,
  pre: string,
  kcal: string,
  prot: string,
): Pick<Item, "om" | "kcal" | "prot"> {
  const a = parse(amt);
  const k = parse(kcal);
  const p = parse(prot);
  return {
    om: role && a > 0 ? { role, amt: a, ...(pre.trim() ? { pre: pre.trim() } : {}) } : undefined,
    kcal: isNaN(k) ? undefined : k,
    prot: isNaN(p) ? undefined : p,
  };
}

/** Obrazac za novu namirnicu. `onDone` dobije novu namirnicu ili ništa ako se odustane. */
export function ItemForm({ onDone, initialName = "" }: { onDone: (item?: Item) => void; initialName?: string }) {
  const { data, apply } = useApp();
  const [n, setN] = useState(initialName);
  const [cat, setCat] = useState<CatId>("fri");
  const [u, setU] = useState<Unit>("g");
  const [pack, setPack] = useState("");
  const [min, setMin] = useState("0");
  const [src, setSrc] = useState<ShopId>("K");
  const [have, setHave] = useState("");
  const [role, setRole] = useState<OmRole>("");
  const [amt, setAmt] = useState("");
  const [pre, setPre] = useState("");
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = parse(pack);
    const m = parse(min || "0");
    const h = parse(have || "0");
    if (!n.trim()) return setErr("Upiši naziv namirnice.");
    if (visibleItems(data).some((i) => i.n.toLowerCase() === n.trim().toLowerCase()))
      return setErr("Namirnica s tim nazivom već postoji. Potraži je u popisu.");
    if (isNaN(p) || p <= 0) return setErr(`Upiši koliko je u jednom pakiranju (${u}).`);
    if (isNaN(m) || m < 0) return setErr("Minimum mora biti 0 ili više.");
    if (role && !(parse(amt) > 0)) return setErr(`Upiši koliko ide u jedan omlet (${u}).`);
    const base = newCustomItem({ n, cat, src, u, pack: p, min: m });
    const extra = omPatch(role, amt, pre, kcal, prot);
    const item: Item = { ...base };
    if (extra.om) item.om = extra.om;
    if (extra.kcal != null) item.kcal = extra.kcal;
    if (extra.prot != null) item.prot = extra.prot;
    const r = addItem(data, item, isNaN(h) ? 0 : h);
    apply(r.data, r.msg);
    onDone(item);
  };

  return (
    <form className="confirm" onSubmit={submit} aria-label="Nova namirnica">
      <b>Nova namirnica</b>
      <div className="edit">
        <label htmlFor="niName">
          Naziv
          <input
            id="niName"
            type="text"
            placeholder="npr. Pileće kobasice Gavrilović"
            value={n}
            onChange={(e) => setN(e.target.value)}
          />
        </label>
        <label htmlFor="niCat">
          Gdje stoji
          <select id="niCat" value={cat} onChange={(e) => setCat(e.target.value as CatId)}>
            {(Object.entries(CATS) as [CatId, string][]).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="niUnit">
          Mjeri se u
          <select id="niUnit" value={u} onChange={(e) => setU(e.target.value as Unit)}>
            {UNITS.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="niPack">
          Jedno pakiranje ({u})
          <input
            id="niPack"
            type="text"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={u === "kom" ? "npr. 10" : "npr. 400"}
            value={pack}
            onChange={(e) => setPack(e.target.value)}
          />
        </label>
        <label htmlFor="niHave">
          Trenutno imam ({u})
          <input
            id="niHave"
            type="text"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0"
            value={have}
            onChange={(e) => setHave(e.target.value)}
          />
        </label>
        <label htmlFor="niMin">
          Uvijek želim imati barem ({u})
          <input
            id="niMin"
            type="text"
            inputMode="decimal"
            min="0"
            step="any"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label htmlFor="niSrc">
          Kupujem u
          <select id="niSrc" value={src} onChange={(e) => setSrc(e.target.value as ShopId)}>
            {(Object.entries(SHOPS) as [ShopId, string][]).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h4 className="omh">Omlet i kalorije (po želji)</h4>
      <OmFields
        idp="ni"
        u={u}
        role={role}
        setRole={setRole}
        amt={amt}
        setAmt={setAmt}
        pre={pre}
        setPre={setPre}
        kcal={kcal}
        setKcal={setKcal}
        prot={prot}
        setProt={setProt}
      />
      <p className="sub">
        Minimum 0 znači da je samo pratiš, a ne dolazi na popis za kupovinu dok je ne potroši recept ili omlet. Jedinicu
        kasnije ne možeš mijenjati. Kalorije i proteini služe za izračun omleta.
      </p>
      {err && <p className="miss">{err}</p>}
      <div className="btnrow">
        <button type="submit" className="btn">
          Dodaj
        </button>
        <button type="button" className="btn ghost" onClick={() => onDone()}>
          Odustani
        </button>
      </div>
    </form>
  );
}

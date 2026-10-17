import { useState } from "react";
import type { FormEvent } from "react";
import { useApp } from "../state/AppContext";
import { clone } from "../state/model";
import type { UiState } from "../state/model";
import { LIST_LABEL, addEntry, isBuiltin, removeEntry, renameEntry, usage } from "../logic/lists";
import type { ListKind } from "../logic/lists";
import { CLAUDE_MODEL, loadClaudeKey, saveClaudeKey } from "../logic/claude";
import { round } from "../logic/format";
import { Page } from "../components/Page";
import { TextCell } from "../components/Cells";
import { SyncPanel } from "../components/SyncPanel";
import { Icon } from "../components/icons";
import { Backup } from "./TroskoviTab";

type PTab = NonNullable<UiState["psTab"]>;

const HINT: Record<ListKind, string> = {
  cats: "Gdje namirnica stoji doma. Po tome se grupira zaliha i popis za kupovinu.",
  grps: "Vrsta hrane: voće, povrće, meso… Npr. dodaj „Juhe i temeljci” za pileći temeljac.",
  units: "U čemu brojiš namirnicu. g i ml računaju kalorije na 100, sve ostale (kom, kocka, konzerva…) po komadu.",
};

function ListTable({ kind }: { kind: ListKind }) {
  const { data, apply, update } = useApp();
  const [n, setN] = useState("");
  const [msg, setMsg] = useState("");
  const list = data.lists[kind];
  const add = (e: FormEvent) => {
    e.preventDefault();
    const r = addEntry(data, kind, n);
    if (!r.id) return setMsg(r.msg);
    apply(r.data, r.msg);
    setN("");
    setMsg("");
  };
  return (
    <section className="listcol" aria-labelledby={`lst-${kind}`}>
      <h2 id={`lst-${kind}`}>{LIST_LABEL[kind].many}</h2>
      <p className="fhint">{HINT[kind]}</p>
      <div className="tablewrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky">Naziv</th>
              {kind === "units" && <th>Oznaka</th>}
              <th className="num">Namirnica</th>
              <th>
                <span className="sr-only">Obriši</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => {
              const used = usage(data, kind, e.id);
              const builtin = isBuiltin(kind, e.id);
              return (
                <tr key={e.id}>
                  <td className="sticky">
                    <div className="namecell">
                      <TextCell
                        label={`Naziv: ${e.n}`}
                        value={e.n}
                        onCommit={(v) => update((d) => renameEntry(d, kind, e.id, v))}
                      />
                    </div>
                  </td>
                  {kind === "units" && <td className="muted">{e.id}</td>}
                  <td className="num muted">{used || "–"}</td>
                  <td className="c" style={{ width: 44 }}>
                    {builtin ? (
                      <span className="muted" title="Ugrađeno, može se samo preimenovati">
                        –
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="rowbtn"
                        aria-label={`Obriši ${e.n}`}
                        onClick={() => {
                          const r = removeEntry(data, kind, e.id);
                          if (r.data === data) setMsg(r.msg);
                          else apply(r.data, r.msg);
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <form className="addrow" onSubmit={add}>
          <input
            type="text"
            value={n}
            onChange={(e) => setN(e.target.value)}
            placeholder={
              kind === "units" ? "npr. kocka, l, šalica" : kind === "grps" ? "npr. Juhe i temeljci" : "npr. Podrum"
            }
            aria-label={`Nova ${LIST_LABEL[kind].one}`}
          />
          <button type="submit" className="btn ghost" disabled={!n.trim()}>
            <Icon name="plus" size={16} /> Dodaj
          </button>
        </form>
      </div>
      {msg && <p className="miss">{msg}</p>}
    </section>
  );
}

function ClaudeSettings() {
  const [key, setKey] = useState(loadClaudeKey());
  const [saved, setSaved] = useState(!!loadClaudeKey());
  const [show, setShow] = useState(false);
  return (
    <div className="setcol">
      <div className="group">
        <h2>Claude za recepte iz linka</h2>
        <p className="sub">
          S Claudeom „Recept iz linka” radi s bilo koje stranice: Claude sam dohvati stranicu, prevede recept na
          hrvatski, preračuna mjere i spoji sastojke s tvojim namirnicama. Treba ti Claude API ključ (plaća se po
          korištenju, jedan recept oko 1 do 5 centi).
        </p>
        <ol className="steps">
          <li>
            Otvori{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">
              console.anthropic.com → API keys
            </a>
            , prijavi se i dodaj malo kredita (Billing).
          </li>
          <li>Napravi novi ključ (Create Key) i kopiraj ga.</li>
          <li>Zalijepi ga ovdje i spremi.</li>
        </ol>
        <form
          className="importform"
          onSubmit={(e) => {
            e.preventDefault();
            saveClaudeKey(key);
            setSaved(!!key.trim());
          }}
        >
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            placeholder="sk-ant-…"
            aria-label="Claude API ključ"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setSaved(false);
            }}
          />
          <button type="button" className="btn ghost" onClick={() => setShow(!show)}>
            {show ? "Sakrij" : "Prikaži"}
          </button>
          <button type="submit" className="btn">
            Spremi
          </button>
        </form>
        {saved ? (
          <p className="ready">Ključ je spremljen. Model: {CLAUDE_MODEL}.</p>
        ) : (
          <p className="fhint">Ključ nije spremljen.</p>
        )}
        {saved && (
          <button
            type="button"
            className="linkbtn"
            onClick={() => {
              saveClaudeKey("");
              setKey("");
              setSaved(false);
            }}
          >
            Obriši ključ s ovog uređaja
          </button>
        )}
        <p className="fhint">
          Ključ ostaje samo u ovom pregledniku i ne ide u sinkronizaciju ni u backup. Na mobitelu ga upiši posebno.
        </p>
      </div>
    </div>
  );
}

function Other() {
  const { data, update } = useApp();
  const [dost, setDost] = useState<string | null>(null);
  return (
    <div className="setcol">
      <div className="group">
        <h2>Usporedba s dostavom</h2>
        <div className="edit">
          <label htmlFor="setDostava">
            Prosječna dostava po obroku (€)
            <input
              id="setDostava"
              type="text"
              inputMode="decimal"
              value={dost ?? String(data.settings.dostava)}
              onChange={(e) => setDost(e.target.value)}
              onBlur={() => {
                const v = parseFloat((dost ?? "").replace(",", "."));
                if (!isNaN(v) && v >= 0)
                  update((x) => {
                    const n = clone(x);
                    n.settings.dostava = round(v);
                    return n;
                  });
                setDost(null);
              }}
            />
          </label>
        </div>
        <p className="sub">Koliko te inače stoji obrok s dostavom i napojnicom. Koristi se u Troškovima.</p>
      </div>
    </div>
  );
}

export function PostavkeTab() {
  const { data, update } = useApp();
  const tab: PTab = data.ui.psTab ?? "lists";
  const setTab = (t: PTab) =>
    update((d) => {
      const n = clone(d);
      n.ui.psTab = t;
      return n;
    });
  return (
    <Page
      id="postavke"
      title="Postavke"
      tabs={
        <div className="seg" role="tablist" aria-label="Postavke">
          {(
            [
              ["lists", "Mjesta, skupine i jedinice"],
              ["claude", "Claude"],
              ["sync", "Sinkronizacija"],
              ["backup", "Backup"],
              ["other", "Ostalo"],
            ] as [PTab, string][]
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
      {tab === "lists" && (
        <div className="listgrid">
          <ListTable kind="cats" />
          <ListTable kind="grps" />
          <ListTable kind="units" />
        </div>
      )}
      {tab === "claude" && <ClaudeSettings />}
      {tab === "sync" && (
        <div className="setcol">
          <SyncPanel />
        </div>
      )}
      {tab === "backup" && (
        <div className="setcol">
          <Backup />
        </div>
      )}
      {tab === "other" && <Other />}
    </Page>
  );
}

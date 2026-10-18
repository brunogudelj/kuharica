/* Sadržaj panela: recept, omlet, prep, odabir recepta ili omleta za dan */
import { useState } from "react";
import type { FormEvent } from "react";
import { fetchPage, parseIngredient, parseRecipeHtml, parseRecipeText } from "../logic/importRecipe";
import { ImportReview } from "./ImportReview";
import { CLAUDE_MODEL, claudeRecipe, loadClaudeKey } from "../logic/claude";
import type { IngLine, ParsedRecipe } from "../logic/importRecipe";
import { REC_PREP } from "../data";
import type { CustomRecipe } from "../data";
import { useApp } from "../state/AppContext";
import { clone, daySlots } from "../state/model";
import { dayDate, dayLabel, dayName, todayKey, windowKeys } from "../logic/dates";
import type { AppData } from "../state/model";
import { effUse, pc, portionF, prepEff, prepUsedIn, qty } from "../logic/inventory";
import type { EffUse } from "../logic/inventory";
import { addSlot, cook, makePrep, removeRecipe, removeSlot } from "../logic/actions";
import { recipeName, recipeOf, toCustom, usedIn } from "../logic/recipes";
import { itemOf } from "../logic/items";
import { KIND_LABEL, mealEntry, prepEntry } from "../logic/feed";
import type { FeedEntry } from "../logic/feed";
import { eur, fmt, pfmt, porcTxt, round, scaleText } from "../logic/format";
import { shopName } from "../logic/shops";
import { Html, Stepper } from "./ui";
import { Icon } from "./icons";
import { RecipeForm } from "./RecipeForm";
import { isCustomPrep, prepInv, prepName, prepOf, removeCustomPrep, toCustomPrep } from "../logic/preps";
import { usePanel } from "./Panel";
import type { View } from "./Panel";

const num = (v: number | null, suf = "") => (v == null ? "–" : v.toLocaleString("hr-HR") + suf);

/** Četiri broja recepta: kcal, proteini, cijena, vrijeme */
export function Stats({ e, per = true }: { e: FeedEntry; per?: boolean }) {
  const approx = e.macKnown > 0 && e.macKnown < e.items.length ? "≈ " : "";
  return (
    <dl className="stats">
      <div>
        <dt>
          <Icon name="flame" size={14} /> kcal
        </dt>
        <dd>{e.kcal == null ? "–" : approx + num(e.kcal)}</dd>
      </div>
      <div>
        <dt>
          <Icon name="muscle" size={14} /> protein
        </dt>
        <dd>{num(e.p, " g")}</dd>
      </div>
      <div>
        <dt>
          <Icon name="euro" size={14} /> cijena
        </dt>
        <dd>{e.cost == null ? "–" : eur(e.cost)}</dd>
      </div>
      <div>
        <dt>
          <Icon name="clock" size={14} /> vrijeme
        </dt>
        <dd>{e.time == null ? "–" : e.time + " min"}</dd>
      </div>
      {per && (
        <p className="stats-note">{e.kind === "om" ? "po omletu" : e.kind === "prep" ? "cijela tura" : "po porciji"}</p>
      )}
    </dl>
  );
}

/** Traka dostupnosti sastojaka */
export function Avail({ e }: { e: FeedEntry }) {
  const all = e.total > 0 && e.have >= e.total;
  return (
    <div className={"avail" + (all ? " full" : "")}>
      <span className="avail-bar" aria-hidden="true">
        <i style={{ width: `${e.total ? (e.have / e.total) * 100 : 0}%` }} />
      </span>
      <span>{all ? "Imaš sve" : `Imaš ${e.have} od ${e.total}`}</span>
    </div>
  );
}

export function Chips({ e }: { e: FeedEntry }) {
  return (
    <div className="chips">
      {e.carb && <span className={`chip carb-chip cc-${e.carb.replace(/\s/g, "")}`}>{e.carb}</span>}
      {e.prot.slice(0, 3).map((p) => (
        <span key={p} className="chip">
          {p}
        </span>
      ))}
      {e.two && <span className="chip">2 u 1</span>}
      {e.custom && <span className="chip mine">moj</span>}
    </div>
  );
}

/** Kartica recepta u feedu */
export function FeedCard({ e, onOpen }: { e: FeedEntry; onOpen: () => void }) {
  return (
    <button type="button" className={`rcard k-${e.kind} cc-${e.carb.replace(/\s/g, "") || "none"}`} onClick={onOpen}>
      <span className="rcard-band">
        <span>{KIND_LABEL[e.kind]}</span>
        <span>{e.method}</span>
      </span>
      <span className="rcard-name">{e.n}</span>
      <span className="rcard-desc">{e.d}</span>
      <Stats e={e} />
      <Chips e={e} />
      <Avail e={e} />
    </button>
  );
}

/** Odabir dana u planu: danas i sljedećih 12 dana */
function DayPicker({ on, onPick, label }: { on: (k: string) => boolean; onPick: (k: string) => void; label: string }) {
  const t = todayKey();
  return (
    <div className="daypick" role="group" aria-label={label}>
      {windowKeys()
        .slice(1)
        .map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={on(k)}
            className={k === t ? "today" : ""}
            onClick={() => onPick(k)}
          >
            <b>{k === t ? "Danas" : dayName(k)}</b>
            <small>{dayDate(k)}</small>
          </button>
        ))}
    </div>
  );
}

/** Popis namirnica iz zalihe: treba, imaš, status */
function StockList({ data, use }: { data: AppData; use: Record<string, number> }) {
  return (
    <table className="grid compact stocklist">
      <thead>
        <tr>
          <th>Namirnica</th>
          <th className="num">Treba</th>
          <th className="num">Imaš</th>
          <th>Dućan</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(use).map(([id, a]) => {
          const i = itemOf(data, id);
          if (!i) return null;
          const ok = qty(data, id) + 1e-9 >= a;
          return (
            <tr key={id} className={ok ? "" : "st-out"}>
              <td className="namecell">
                <span className={"dot " + (ok ? "ok" : "out")} aria-hidden="true" />
                {i.n}
                <span className="sr-only">{ok ? " (imaš)" : " (fali)"}</span>
              </td>
              <td className="num">{fmt(a, i.u)}</td>
              <td className="num">{fmt(qty(data, id), i.u)}</td>
              <td className="muted">{shopName(data, i.src)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Dijelovi recepta: drugi recepti i prep, s linkom i stanjem pripremljenog */
function Parts({ recipes = [], preps, s = 1 }: { recipes?: [string, number][]; preps: EffUse["prep"]; s?: number }) {
  const { data } = useApp();
  const { open } = usePanel();
  if (!recipes.length && !preps.length) return null;
  return (
    <section className="psec">
      <h3>Sastoji se od</h3>
      <ul className="parts">
        {recipes.map(([pid, k]) => (
          <li key={pid}>
            <span className="chip">recept</span>{" "}
            <button type="button" className="linkbtn" onClick={() => open({ t: "meal", id: pid })}>
              {recipeName(data, pid)}
            </button>
            <span className="muted"> · {porcTxt(round(k * s))}</span>
          </li>
        ))}
        {preps.map((p) => {
          const ok = p.used + 1e-9 >= p.need;
          const unit = prepInv(data, p.id)?.unit ?? "porcija";
          return (
            <li key={"p:" + p.id} className={ok ? "" : "st-low"}>
              <span className="chip">prep</span>{" "}
              <button type="button" className="linkbtn" onClick={() => open({ t: "prep", id: p.id })}>
                {prepName(data, p.id)}
              </button>
              <span className="muted"> · {pfmt(p.need, unit)}</span>
              <span className={"partstate" + (ok ? " ok" : "")}>
                {ok
                  ? `pripremljeno (imaš ${pfmt(pc(data, p.id), unit)})`
                  : p.used > 0
                    ? `imaš ${pfmt(p.used, unit)}, za ostatak se troše njegove namirnice`
                    : "nije pripremljeno: troše se njegove namirnice"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="sub">Klik otvara dio s njegovim namirnicama i pripremom.</p>
    </section>
  );
}

function Head({ e, kicker }: { e: FeedEntry; kicker?: string }) {
  return (
    <header className="phead">
      <p className="kicker">
        {KIND_LABEL[e.kind]}
        {e.method ? ` · ${e.method}` : ""}
        {kicker ? ` · ${kicker}` : ""}
      </p>
      <h2 className="pname">{e.n}</h2>
      {e.d && <p className="sub">{e.d}</p>}
      <Chips e={e} />
    </header>
  );
}

export function MealView({ id, day }: { id: string; day?: string }) {
  const { data, apply, update } = useApp();
  const { open, close } = usePanel();
  const [confirmDel, setConfirmDel] = useState(false);
  const r = recipeOf(data, id);
  const e = mealEntry(data, id);
  if (!r || !e) return <p className="sub">Recept više ne postoji.</p>;
  // sve se računa za 1 porciju; 1,5 porcija = ručak i večera iz jednog kuhanja
  const s = data.ui.servings[r.id] ?? 1;
  const f = portionF(r, s);
  const eff = effUse(r, { ...data.prepStock }, false, f, data);
  const edited = !!r.edited;
  const users = usedIn(data, r.id);
  const setS = (v: number) =>
    update((d) => {
      const n = clone(d);
      n.ui.servings[r.id] = Math.min(6, Math.max(0.5, v));
      return n;
    });

  return (
    <div className="pbody">
      <Head e={e} kicker={day != null ? dayLabel(day) : undefined} />
      <Stats e={e} />
      <section className="psec">
        <h3>U planu</h3>
        <DayPicker
          label="Dodaj u plan"
          on={(k) => daySlots(data.plan, k).some((x) => x.r === id)}
          onPick={(k) => {
            const x = daySlots(data.plan, k).find((y) => y.r === id && !y.done);
            if (x) apply(removeSlot(data, k, x.id), `${r.n} maknut s plana za ${dayLabel(k)}.`);
            else
              apply(
                addSlot(data, k, { r: id, ...(s !== 1 ? { s } : {}) }),
                `${r.n} (${porcTxt(s)}) je na planu za ${dayLabel(k)}.`,
              );
          }}
        />
        <p className="sub">Dodaje se kao obrok tog dana, {porcTxt(s)}. Ponovni klik ga miče.</p>
      </section>
      <section className="psec">
        <div className="rowspread">
          <h3>Porcije</h3>
          <Stepper label="porcije" value={porcTxt(s)} onDec={() => setS(s - 0.5)} onInc={() => setS(s + 0.5)} />
        </div>
        <p className="sub">Sve je za 1 porciju. 1,5 porcija je ručak i večera iz jednog kuhanja.</p>
      </section>
      {r.split && (
        <div className="split">
          {r.split.map((x, i) => (
            <Html key={i} as="div" html={x} />
          ))}
        </div>
      )}
      <Parts recipes={r.parts} preps={eff.prep} s={s} />
      <section className="psec">
        <h3>Iz zalihe</h3>
        <StockList data={data} use={eff.use} />
        {eff.prep.some((p) => p.used + 1e-9 < p.need) && (
          <p className="sub">
            Za prep koji nemaš pripremljen, njegove namirnice su već u tablici i na popisu za kupovinu. Ili ga napravi
            unaprijed u Prepu.
          </p>
        )}
        {REC_PREP[r.id] && (
          <p className="prepline">
            Brže uz prep:{" "}
            {REC_PREP[r.id].map((p, i) => (
              <span key={p}>
                {i > 0 && ", "}
                <button type="button" className="linkbtn" onClick={() => open({ t: "prep", id: p })}>
                  {prepName(data, p)}
                </button>
              </span>
            ))}
          </p>
        )}
      </section>
      <section className="psec">
        <h3>Sastojci za {porcTxt(s)}</h3>
        <ul className="ing">
          {r.ing.map((i, k) => (
            <Html key={k} as="li" html={scaleText(i, r.ingFor ? s / r.ingFor : f)} />
          ))}
        </ul>
      </section>
      <section className="psec">
        <h3>Priprema</h3>
        {r.st.length ? (
          <ol className="steps">
            {r.st.map((x, k) => (
              <li key={k}>{x}</li>
            ))}
          </ol>
        ) : (
          <p className="sub">Koraci nisu upisani.</p>
        )}
      </section>
      <div className="pactions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const res = cook(data, r.id, day ?? null, s);
            apply(res.data, res.msg);
            close();
          }}
        >
          <Icon name="check" size={18} /> Skuhao sam
        </button>
        <span className="count">
          skida {porcTxt(s)} sa zalihe{day != null ? `, obrok ${dayLabel(day)} dobiva kvačicu` : ""}
        </span>
      </div>
      {users.length > 0 && (
        <p className="sub">
          Dio recepta:{" "}
          {users.map((u, i) => (
            <span key={u.id}>
              {i > 0 && ", "}
              <button type="button" className="linkbtn" onClick={() => open({ t: "meal", id: u.id })}>
                {u.n}
              </button>
            </span>
          ))}
        </p>
      )}
      {
        <div className="btnrow">
          <button type="button" className="btn ghost" onClick={() => open({ t: "editRecipe", id: r.id })}>
            <Icon name="edit" size={16} /> Uredi recept
          </button>
          {!r.custom ? null : confirmDel ? (
            <>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const res = removeRecipe(data, r.id);
                  apply(res.data, res.msg);
                  close();
                }}
              >
                {edited ? "Da, vrati original" : "Da, obriši"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>
                Odustani
              </button>
            </>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={16} /> {edited ? "Vrati original" : "Obriši"}
            </button>
          )}
        </div>
      }
    </div>
  );
}

export function PrepView({ id }: { id: string }) {
  const { data, apply, update } = useApp();
  const { open, close } = usePanel();
  const [confirm, setConfirm] = useState(false);
  const p = prepOf(data, id);
  const e = prepEntry(data, id);
  if (!p || !e) return <p className="sub">Prep više ne postoji.</p>;
  const t = data.ui.ture[id] ?? 1;
  const inv = prepInv(data, id) ?? { make: 1, unit: "porcija" as const, per: {} };
  const have = pc(data, id);
  const eff = prepEff(data, p, t, { ...data.prepStock });
  const users = prepUsedIn(data, id);
  const own = !!p.custom;
  const change = (fn: (n: AppData) => void) =>
    update((d) => {
      const n = clone(d);
      fn(n);
      return n;
    });
  return (
    <div className="pbody">
      <Head e={e} kicker={isCustomPrep(id) ? "moj prep" : p.edited ? "uređen" : undefined} />
      <Stats e={e} per={false} />
      <div className="facts">
        <div>
          <b>Jedna tura daje</b>
          <span>{pfmt(inv.make, inv.unit)}</span>
        </div>
        <div>
          <b>Čuvanje</b>
          <span>{p.keep || "–"}</span>
        </div>
      </div>
      <section className="psec">
        <div className="rowspread">
          <h3>Koliko tura</h3>
          <Stepper
            label="ture"
            value={`× ${t.toLocaleString("hr-HR")}`}
            onDec={() => change((n) => (n.ui.ture[id] = Math.max(0.5, t - 0.5)))}
            onInc={() => change((n) => (n.ui.ture[id] = Math.min(5, t + 0.5)))}
          />
        </div>
        <div className="rowspread">
          <h3>Pripremljeno na zalihi</h3>
          <Stepper
            label={p.n}
            value={pfmt(have, inv.unit)}
            onDec={() => change((n) => (n.prepStock[id] = Math.max(0, have - 1)))}
            onInc={() => change((n) => (n.prepStock[id] = have + 1))}
          />
        </div>
      </section>
      <Parts preps={eff.prep} />
      <section className="psec">
        <h3>Iz zalihe</h3>
        <StockList data={data} use={eff.use} />
      </section>
      <section className="psec">
        <h3>Sastojci{t !== 1 ? ` za ${t.toLocaleString("hr-HR")} ture` : ""}</h3>
        <ul className="ing">
          {p.ing.map((i, k) => (
            <Html key={k} as="li" html={scaleText(i, t)} />
          ))}
        </ul>
      </section>
      <section className="psec">
        <h3>Priprema</h3>
        {p.st.length ? (
          <ol className="steps">
            {p.st.map((x, k) => (
              <li key={k}>{x}</li>
            ))}
          </ol>
        ) : (
          <p className="sub">Koraci nisu upisani.</p>
        )}
        {p.tip && <div className="tip">{p.tip}</div>}
      </section>
      {(users.length > 0 || p.for.length > 0) && (
        <section className="psec">
          <h3>Dio recepata</h3>
          {users.length ? (
            <ul className="parts">
              {users.map((u) => (
                <li key={u.id}>
                  <button type="button" className="linkbtn" onClick={() => open({ t: "meal", id: u.id })}>
                    {u.n}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sub">{p.for.join(", ")}</p>
          )}
        </section>
      )}
      <div className="pactions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const r = makePrep(data, id, t);
            apply(r.data, r.msg);
          }}
        >
          <Icon name="check" size={18} /> Napravio sam
        </button>
        <span className="count">skida namirnice sa zalihe, +{pfmt(inv.make * t, inv.unit)} pripremljeno</span>
      </div>
      <div className="btnrow">
        <button type="button" className="btn ghost" onClick={() => open({ t: "editPrep", id })}>
          <Icon name="edit" size={16} /> Uredi prep
        </button>
        {!own ? null : confirm ? (
          <>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                const r = removeCustomPrep(data, id);
                apply(r.data, r.msg);
                if (!p.edited) close();
              }}
            >
              {p.edited ? "Da, vrati original" : "Da, obriši"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
              Odustani
            </button>
          </>
        ) : (
          <button type="button" className="btn ghost danger" onClick={() => setConfirm(true)}>
            <Icon name="trash" size={16} /> {p.edited ? "Vrati original" : "Obriši"}
          </button>
        )}
      </div>
    </div>
  );
}

function PrepFormView({ id }: { id?: string }) {
  const { data } = useApp();
  const { open, close } = usePanel();
  const p = id ? prepOf(data, id) : undefined;
  const existing = p ? toCustomPrep(data, p) : undefined;
  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">Prep</p>
        <h2 className="pname">{existing ? `Uredi: ${existing.n}` : "Novi prep"}</h2>
        <p className="sub">
          Umak, marinada ili baza koju radiš unaprijed. To je recept kao i ostali, a drugi recepti ga mogu imati kao
          dio.
        </p>
      </header>
      <RecipeForm
        mode="prep"
        existing={existing}
        onDone={(pid?: string) => (pid ? open({ t: "prep", id: pid }) : close())}
      />
    </div>
  );
}

/** Što panel prikazuje */
export function renderView(v: View) {
  switch (v.t) {
    case "meal":
      return <MealView key={v.id} id={v.id} day={v.day} />;
    case "prep":
      return <PrepView key={v.id} id={v.id} />;
    case "newRecipe":
      return <NewRecipe day={v.day} draft={v.draft} />;
    case "editRecipe":
      return <EditRecipe id={v.id} />;
    case "importRecipe":
      return <ImportRecipe />;
    case "newPrep":
      return <PrepFormView />;
    case "editPrep":
      return <PrepFormView key={v.id} id={v.id} />;
  }
}

/** Recept iz linka (ili zalijepljenog teksta): povuci podatke pa ih provjeri u obrascu */
function ImportRecipe() {
  const { data, update } = useApp();
  const { close } = usePanel();
  const key = loadClaudeKey();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ parsed: ParsedRecipe; lines: IngLine[]; method?: string; carb?: string } | null>(
    null,
  );

  const fromParsed = (p: ParsedRecipe | null) => {
    if (!p || !p.ingredients.length) {
      setErr("Na stranici nisam našao recept. Kopiraj tekst recepta i zalijepi ga ispod.");
      setShowText(true);
      return;
    }
    setErr("");
    setRes({
      parsed: p,
      lines: p.ingredients.map((x, i) => {
        const l = parseIngredient(data, x);
        const g = p.groups?.[i];
        return g ? { ...l, group: g } : l;
      }),
    });
  };

  const viaClaude = async (src: { url?: string; text?: string }) => {
    setBusy(true);
    setErr("");
    try {
      setRes(await claudeRecipe(data, key, src));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Claude nije uspio pročitati recept.");
      if (src.url) setShowText(true);
    } finally {
      setBusy(false);
    }
  };

  const pull = async (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return setErr("Upiši cijeli link, npr. https://www.coolinarika.com/recept/…");
    if (key) return viaClaude({ url: u });
    setBusy(true);
    setErr("");
    try {
      const html = await fetchPage(u);
      fromParsed(parseRecipeHtml(html, u));
    } catch {
      setErr(
        "Stranicu nije bilo moguće dohvatiti bez Claudea. Dodaj Claude API ključ u Postavkama ili zalijepi tekst recepta ispod.",
      );
      setShowText(true);
    } finally {
      setBusy(false);
    }
  };

  const goSettings = () => {
    close();
    update((d) => {
      const n = clone(d);
      n.ui.tab = "postavke";
      n.ui.psTab = "claude";
      return n;
    });
  };

  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">Recepti</p>
        <h2 className="pname">Recept iz linka</h2>
        <p className="sub">
          Zalijepi link na recept. {key ? "Claude dohvati stranicu i složi recept" : "Povuku se"} naziv, sastojci,
          koraci, vrijeme i porcije, a sastojci se spoje s namirnicama iz zalihe. Sve provjeriš prije spremanja.
        </p>
      </header>
      {!res && (
        <>
          <form className="importform" onSubmit={pull}>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…"
              aria-label="Link na recept"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn" disabled={busy}>
              {busy ? (key ? "Claude čita recept…" : "Povlačim…") : "Povuci recept"}
            </button>
          </form>
          {busy && key && <p className="fhint">Obično traje 10 do 30 sekundi.</p>}
          {err && <p className="miss">{err}</p>}
          {showText ? (
            <div className="edit one">
              <label htmlFor="impText">
                Tekst recepta (naziv u prvom retku, pa sastojci i priprema)
                <textarea id="impText" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <div className="btnrow">
                <button
                  type="button"
                  className="btn"
                  disabled={!text.trim() || busy}
                  onClick={() => (key ? viaClaude({ text }) : fromParsed(parseRecipeText(text)))}
                >
                  Pročitaj tekst
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="linkbtn" onClick={() => setShowText(true)}>
              ili zalijepi tekst recepta
            </button>
          )}
          {key ? (
            <p className="fhint">
              Ide preko tvog Claude API ključa ({CLAUDE_MODEL}). Jedan recept košta oko 1 do 5 centi.
            </p>
          ) : (
            <div className="note">
              <b>Za pouzdano povlačenje s bilo koje stranice</b> dodaj Claude API ključ. Claude tada sam dohvati
              stranicu, prevede recept na hrvatski i spoji sastojke s tvojim namirnicama.{" "}
              <button type="button" className="linkbtn" onClick={goSettings}>
                Postavke → Claude
              </button>
            </div>
          )}
        </>
      )}
      {res && (
        <ImportReview
          key={res.parsed.n}
          parsed={res.parsed}
          lines={res.lines}
          method={res.method}
          carb={res.carb}
          onDone={close}
        />
      )}
    </div>
  );
}

function NewRecipe({ day, draft }: { day?: string; draft?: CustomRecipe }) {
  const { close } = usePanel();
  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">{day != null ? `Plan · ${dayLabel(day)}` : "Recepti"}</p>
        <h2 className="pname">Novi recept</h2>
        <p className="sub">Namirnice biraš iz zalihe, pa recept zna što skinuti kad ga skuhaš.</p>
      </header>
      <RecipeForm planDay={day} draft={draft} onDone={close} />
    </div>
  );
}

function EditRecipe({ id }: { id: string }) {
  const { data } = useApp();
  const { open } = usePanel();
  const r = recipeOf(data, id);
  const own = data.recipes.find((x) => x.id === id) ?? (r ? toCustom(data, r) : undefined);
  if (!own) return <p className="sub">Recept više ne postoji.</p>;
  return (
    <div className="pbody">
      <header className="phead">
        <p className="kicker">Uredi recept</p>
        <h2 className="pname">{own.n}</h2>
      </header>
      <RecipeForm existing={own} onDone={() => open({ t: "meal", id })} />
    </div>
  );
}

/* Podaci o namirnici: marka, barkod, drugi nazivi (za prepoznavanje pri uvozu recepta) i nutritivne vrijednosti
   iz baze proizvoda (Open Food Facts) ili preko Claudea s pretragom weba. */
import { useEffect, useRef, useState } from "react";
import type { Item } from "../data";
import { claudeFood, hitPatch, offSearch } from "../logic/foodinfo";
import type { FoodHit } from "../logic/foodinfo";
import { loadClaudeKey } from "../logic/claude";
import { isMass } from "../logic/lists";
import { Icon } from "./icons";

export type InfoPatch = Partial<Pick<Item, "kcal" | "prot" | "carb" | "fat" | "brand" | "ean" | "pack" | "alias">>;

const fmtN = (v: number | null | undefined) => (v == null ? "–" : String(v).replace(".", ","));
const parse = (s: string) => {
  const v = parseFloat(s.replace(",", "."));
  return isNaN(v) ? undefined : v;
};

interface BarcodeDetectorLike {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (o?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/** Kamera i čitanje barkoda (Chrome na Androidu i noviji preglednici) */
function Scanner({ onCode, onClose }: { onCode: (c: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const cb = useRef(onCode);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    const Det = window.BarcodeDetector;
    if (!Det) {
      setErr("Ovaj preglednik ne zna čitati barkod. Upiši brojeve ispod slike barkoda.");
      return;
    }
    const det = new Det({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        while (alive) {
          try {
            const got = await det.detect(video.current);
            if (got[0]?.rawValue) {
              cb.current(got[0].rawValue);
              return;
            }
          } catch {
            /* sljedeća slika */
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      })
      .catch(() => setErr("Kamera nije dopuštena. Upiši barkod ručno."));
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <div className="scanner">
      {err ? <p className="miss">{err}</p> : <video ref={video} muted playsInline aria-label="Kamera za barkod" />}
      <button type="button" className="btn ghost small" onClick={onClose}>
        Zatvori kameru
      </button>
    </div>
  );
}

/**
 * Polja i pretraga. `item` su trenutne vrijednosti (postojeća ili nova namirnica),
 * `onPatch` sprema promjenu (odmah u zalihu ili u obrazac nove namirnice).
 */
export function ItemInfo({
  item,
  onPatch,
  idp,
}: {
  item: Pick<Item, "n" | "u" | "kcal" | "prot" | "carb" | "fat" | "brand" | "ean" | "alias" | "pack">;
  onPatch: (p: InfoPatch) => void;
  idp: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[] | null>(null);
  const [busy, setBusy] = useState<"" | "off" | "claude">("");
  const [err, setErr] = useState("");
  const [scan, setScan] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const mass = isMass(item.u);
  const hasKey = !!loadClaudeKey();
  const term = q.trim() || [item.brand, item.n].filter(Boolean).join(" ") || item.ean || "";

  const run = async (kind: "off" | "claude", t = term) => {
    if (!t.trim()) return setErr("Upiši naziv, marku ili barkod.");
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(kind);
    setErr("");
    try {
      const r = kind === "off" ? await offSearch(t, c.signal) : await claudeFood(loadClaudeKey(), t, c.signal);
      setHits(r);
      if (!r.length)
        setErr(
          kind === "off"
            ? `U bazi nema „${t}”.${hasKey ? " Probaj „Pitaj Claudea”, on pretraži web." : " Probaj kraći naziv ili barkod."}`
            : "Claude nije našao taj proizvod. Upiši vrijednosti s deklaracije ručno.",
        );
    } catch (e) {
      if (!c.signal.aborted) setErr(e instanceof Error ? e.message : "Pretraga nije uspjela.");
    } finally {
      if (ctl.current === c) setBusy("");
    }
  };
  useEffect(() => () => ctl.current?.abort(), []);

  const use = (h: FoodHit) => {
    onPatch(hitPatch(item, h));
    setHits(null);
  };

  const field = (k: "kcal" | "prot" | "carb" | "fat", label: string) => (
    <label htmlFor={`${idp}-${k}`}>
      {label}
      <input
        id={`${idp}-${k}`}
        type="text"
        inputMode="decimal"
        key={`${k}-${item[k] ?? ""}`}
        defaultValue={item[k] == null ? "" : String(item[k]).replace(".", ",")}
        onBlur={(e) => {
          const v = parse(e.target.value);
          if (v !== item[k]) onPatch({ [k]: v });
        }}
      />
    </label>
  );

  return (
    <div className="iteminfo">
      <div className="infosearch">
        <div className="searchbox">
          <Icon name="search" size={18} />
          <input
            type="search"
            aria-label="Traži proizvod po nazivu, marki ili barkodu"
            placeholder={term || "npr. Ledo meksička mješavina"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run("off");
              }
            }}
          />
        </div>
        <button type="button" className="btn small" disabled={!!busy} onClick={() => run("off")}>
          {busy === "off" ? "Tražim…" : "Traži u bazi proizvoda"}
        </button>
        {hasKey && (
          <button type="button" className="btn small ghost" disabled={!!busy} onClick={() => run("claude")}>
            {busy === "claude" ? "Claude traži…" : "Pitaj Claudea"}
          </button>
        )}
        <button type="button" className="btn small ghost" onClick={() => setScan((s) => !s)}>
          Skeniraj barkod
        </button>
      </div>
      {scan && (
        <Scanner
          onClose={() => setScan(false)}
          onCode={(c) => {
            setScan(false);
            setQ(c);
            onPatch({ ean: c });
            run("off", c);
          }}
        />
      )}
      {err && <p className="miss">{err}</p>}
      {hits && hits.length > 0 && (
        <div className="tablewrap">
          <table className="grid compact hits" aria-label="Pronađeni proizvodi">
            <thead>
              <tr>
                <th>Proizvod</th>
                <th className="num">Pakiranje</th>
                <th className="num">kcal</th>
                <th className="num">Prot.</th>
                <th className="num">UH</th>
                <th className="num">Masti</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h, i) => (
                <tr key={h.ean || i}>
                  <td>
                    <div className="hitname">
                      {h.img && <img src={h.img} alt="" width={32} height={32} loading="lazy" />}
                      <span>
                        <b>{h.name}</b>
                        <small className="muted">
                          {[h.brand, h.ean].filter(Boolean).join(" · ")}
                          {h.url && (
                            <>
                              {" · "}
                              <a href={h.url} target="_blank" rel="noreferrer">
                                izvor
                              </a>
                            </>
                          )}
                        </small>
                      </span>
                      <button type="button" className="btn small" onClick={() => use(h)}>
                        Upotrijebi
                      </button>
                    </div>
                  </td>
                  <td className="num muted">{h.quantity || "–"}</td>
                  <td className="num">{fmtN(h.kcal)}</td>
                  <td className="num">{fmtN(h.prot)}</td>
                  <td className="num">{fmtN(h.carb)}</td>
                  <td className="num">{fmtN(h.fat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fhint">
            Vrijednosti su na 100 g ili 100 ml.{" "}
            {mass ? "" : `Namirnica se broji u „${item.u}”, pa se kalorije ne prepisuju; upiši ih po komadu.`} Podaci:
            Open Food Facts{hasKey ? " ili Claude" : ""}. Provjeri ih s deklaracijom.
          </p>
        </div>
      )}
      <div className="edit">
        <label htmlFor={`${idp}-brand`}>
          Marka
          <input
            id={`${idp}-brand`}
            type="text"
            placeholder="npr. Ledo"
            key={`b-${item.brand ?? ""}`}
            defaultValue={item.brand ?? ""}
            onBlur={(e) =>
              e.target.value.trim() !== (item.brand ?? "") && onPatch({ brand: e.target.value.trim() || undefined })
            }
          />
        </label>
        <label htmlFor={`${idp}-ean`}>
          Barkod
          <input
            id={`${idp}-ean`}
            type="text"
            inputMode="numeric"
            key={`e-${item.ean ?? ""}`}
            defaultValue={item.ean ?? ""}
            onBlur={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (v !== (item.ean ?? "")) onPatch({ ean: v || undefined });
            }}
          />
        </label>
        {field("kcal", mass ? `kcal na 100 ${item.u}` : `kcal po ${item.u}`)}
        {field("prot", mass ? `Proteini (g) na 100 ${item.u}` : `Proteini (g) po ${item.u}`)}
        {field("carb", mass ? `Ugljikohidrati (g) na 100 ${item.u}` : `Ugljikohidrati (g) po ${item.u}`)}
        {field("fat", mass ? `Masti (g) na 100 ${item.u}` : `Masti (g) po ${item.u}`)}
      </div>
      <div className="edit one">
        <label htmlFor={`${idp}-alias`}>
          Drugi nazivi, za prepoznavanje u receptima (odvoji zarezom)
          <input
            id={`${idp}-alias`}
            type="text"
            placeholder="npr. meksička mješavina, mexican vegetables"
            key={`a-${(item.alias ?? []).join("|")}`}
            defaultValue={(item.alias ?? []).join(", ")}
            onBlur={(e) => {
              const v = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              if (v.join("|") !== (item.alias ?? []).join("|")) onPatch({ alias: v.length ? v : undefined });
            }}
          />
        </label>
      </div>
    </div>
  );
}

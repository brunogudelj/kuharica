/* QR kod za mobitel: adresa aplikacije, a uz povezanu sinkronizaciju i token, pa se mobitel sam poveže
   i preuzme iste podatke kao laptop. */
import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { loadSyncConfig } from "../storage/gistSync";
import { appUrl, linkUrl } from "../storage/link";

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((q) => q.toDataURL(text, { margin: 1, width: 260, errorCorrectionLevel: "M" }))
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [text]);
  return src ? <img className="qr" src={src} width={260} height={260} alt="QR kod" /> : <div className="qr" />;
}

export function PhoneLink() {
  const { syncConfigured, notify } = useApp();
  const [withSync, setWithSync] = useState(false);
  const cfg = syncConfigured ? loadSyncConfig() : null;
  const url = withSync && cfg ? linkUrl(cfg.token) : appUrl();
  const copy = () =>
    navigator.clipboard
      ?.writeText(url)
      .then(() => notify("Link je kopiran."))
      .catch(() => undefined);

  return (
    <div className="group" id="mobitel">
      <h2>Otvori na mobitelu</h2>
      <div className="phonelink">
        <Qr text={url} />
        <div className="phonetxt">
          {cfg ? (
            <>
              <label className="checkrow">
                <input type="checkbox" checked={withSync} onChange={(e) => setWithSync(e.target.checked)} />
                <span>Poveži i podatke (ista baza na laptopu i mobitelu)</span>
              </label>
              <p className="sub">
                {withSync
                  ? "Skeniraj kamerom mobitela. Aplikacija se otvori, sama se poveže na isti GitHub gist i preuzme sve podatke s laptopa. Nakon toga promjene idu u oba smjera."
                  : "Skeniraj kamerom mobitela da otvoriš aplikaciju. Uključi kvačicu iznad da se mobitel odmah poveže i na iste podatke."}
              </p>
              {withSync && (
                <p className="miss">
                  QR kod sadrži tvoj GitHub token. Ne pokazuj ga drugima i ne šalji link javno; tko ga ima, može čitati
                  i mijenjati tvoje gistove.
                </p>
              )}
            </>
          ) : (
            <p className="sub">
              Skeniraj kamerom mobitela da otvoriš aplikaciju. Da laptop i mobitel dijele iste podatke, prvo ispod
              poveži sinkronizaciju; tada ovdje dobiješ QR kod koji poveže i mobitel.
            </p>
          )}
          <div className="btnrow">
            <button type="button" className="btn ghost small" onClick={copy}>
              Kopiraj link
            </button>
          </div>
          <p className="sub">
            Da je imaš kao aplikaciju: na iPhoneu u Safariju <b>Dijeli → Dodaj na početni zaslon</b>, na Androidu u
            Chromeu <b>⋮ → Instaliraj aplikaciju</b>. Radi i bez interneta.
          </p>
        </div>
      </div>
    </div>
  );
}

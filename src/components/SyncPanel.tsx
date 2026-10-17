import { useState } from "react";
import type { FormEvent } from "react";
import { useApp } from "../state/AppContext";

const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=Kuharica%20sinkronizacija";

export function syncText(state: string, at?: number, msg?: string) {
  if (state === "off")
    return "Podaci su samo na ovom uređaju. Za laptop i mobitel poveži sinkronizaciju u kartici Troškovi.";
  if (state === "syncing") return "Sinkroniziram s GitHubom…";
  if (state === "error") return msg || "Sinkronizacija nije uspjela.";
  return `Sinkronizirano s GitHubom${at ? " u " + new Date(at).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" }) : ""}.`;
}

export function SyncPanel() {
  const { sync, syncConfigured, connectSync, disconnectSync, syncNow } = useApp();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    try {
      await connectSync(token);
      setToken("");
    } catch {
      /* poruka je u statusu */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group" id="sinkronizacija">
      <h2>Laptop i mobitel</h2>
      <p className={sync.state === "error" ? "miss" : sync.state === "ok" ? "ready" : "sub"} aria-live="polite">
        {syncText(sync.state, sync.at, sync.msg)}
      </p>

      {syncConfigured ? (
        <>
          <p className="sub">
            Podaci su u tajnoj datoteci <code>kuharica.json</code> na tvom GitHubu (gist). Promjene se šalju 2 sekunde
            nakon zadnje izmjene, a s GitHuba se povlače svaki put kad otvoriš aplikaciju. Ako mijenjaš na oba uređaja u
            isto vrijeme, vrijedi zadnja promjena.
          </p>
          <div className="btnrow">
            <button type="button" className="btn" onClick={syncNow}>
              Sinkroniziraj sad
            </button>
            {!confirmOff ? (
              <button type="button" className="btn ghost" onClick={() => setConfirmOff(true)}>
                Odspoji ovaj uređaj
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    disconnectSync();
                    setConfirmOff(false);
                  }}
                >
                  Da, odspoji
                </button>
                <button type="button" className="btn ghost" onClick={() => setConfirmOff(false)}>
                  Odustani
                </button>
              </>
            )}
          </div>
          {confirmOff && <p className="sub">Podaci ostaju na uređaju i na GitHubu, samo se prestaju sinkronizirati.</p>}
        </>
      ) : (
        <>
          <ol className="steps">
            <li>
              Otvori{" "}
              <a href={TOKEN_URL} target="_blank" rel="noopener">
                GitHub → novi token
              </a>
              . Opis i dozvola <b>gist</b> su već upisani. Odaberi trajanje (npr. 1 godina) i stisni{" "}
              <b>Generate token</b>.
            </li>
            <li>
              Kopiraj token (počinje s <code>ghp_</code>) i zalijepi ga ovdje.
            </li>
            <li>Na drugom uređaju napravi isto s istim tokenom. Aplikacija sama pronađe tvoje podatke.</li>
          </ol>
          <form className="edit" onSubmit={submit}>
            <label htmlFor="syncToken">
              GitHub token
              <input
                id="syncToken"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="ghp_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <button type="submit" className="btn" disabled={busy || !token.trim()}>
              {busy ? "Povezujem…" : "Poveži"}
            </button>
          </form>
          <p className="sub">
            Token ima samo dozvolu za gistove i ostaje spremljen u pregledniku ovog uređaja. Prvi uređaj napravi tajni
            gist s trenutnim podacima. Kad povežeš drugi, on preuzme podatke s GitHuba.
          </p>
        </>
      )}
    </div>
  );
}

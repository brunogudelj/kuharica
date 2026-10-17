import { useEffect, useState } from "react";
import { useApp } from "./state/AppContext";
import { clone } from "./state/model";
import { shopping } from "./logic/inventory";
import { syncText } from "./components/SyncPanel";
import { Icon } from "./components/icons";
import type { IconName } from "./components/icons";
import { PlanTab } from "./tabs/PlanTab";
import { ZalihaTab } from "./tabs/ZalihaTab";
import { KupovinaTab } from "./tabs/KupovinaTab";
import { TroskoviTab } from "./tabs/TroskoviTab";
import { ReceptiTab } from "./tabs/ReceptiTab";
import { PrepTab } from "./tabs/PrepTab";
import { DucaniTab } from "./tabs/DucaniTab";
import { PanelProvider } from "./components/Panel";
import { renderView } from "./components/RecipeViews";
import { setDemo } from "./storage/storage";

const TABS: [string, string, IconName, string][] = [
  ["plan", "Plan", "plan", "Tjedni kalendar obroka"],
  ["recepti", "Recepti", "recepti", "Obroci, omleti i prep"],
  ["zaliha", "Zaliha", "zaliha", "Što imaš doma"],
  ["kupovina", "Kupovina", "kupovina", "Popis za dućan"],
  ["ducani", "Dućani", "ducani", "Gdje kupuješ"],
  ["troskovi", "Troškovi", "troskovi", "Potrošnja i usporedba"],
  ["prep", "Prep", "prep", "Priprema unaprijed"],
];

export function App() {
  const { data, loaded, saveError, update, toast, undo, closeToast, sync, demo } = useApp();
  const tab = data.ui.tab === "omlet" ? "recepti" : TABS.some(([k]) => k === data.ui.tab) ? data.ui.tab : "plan";
  const cur = TABS.find(([k]) => k === tab)!;
  const shopCount = shopping(data).length;
  const [drawer, setDrawer] = useState(false);

  const setTab = (t: string, anchor?: string) => {
    update((d) => {
      const n = clone(d);
      n.ui.tab = t;
      return n;
    });
    setDrawer(false);
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 50);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const status = !loaded
    ? { cls: "", txt: "Učitavam…" }
    : saveError
      ? { cls: "err", txt: "Spremanje nije uspjelo. Provjeri da preglednik dopušta spremanje za ovu stranicu." }
      : { cls: sync.state === "error" ? "err" : sync.state === "ok" ? "ok" : "", txt: syncText(sync.state, sync.at, sync.msg) };

  return (
    <PanelProvider render={renderView}>
    <div className={"shell" + (drawer ? " drawer-open" : "")}>
      <header className="topbar">
        <button type="button" className="iconbtn" aria-label="Otvori izbornik" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Icon name="menu" size={22} />
        </button>
        <div className="topbar-title">
          <Icon name={cur[2]} />
          <b>{cur[1]}</b>
        </div>
      </header>

      <aside className="sidebar" aria-label="Izbornik">
        <div className="brand">
          <img src="./icon.svg" alt="" width={36} height={36} />
          <div>
            <b>Kuharica</b>
            <small>wok i air fryer</small>
          </div>
          <button type="button" className="iconbtn drawer-close" aria-label="Zatvori izbornik" onClick={() => setDrawer(false)}>
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Dijelovi kuharice">
          {TABS.map(([k, l, ic, sub]) => (
            <button
              key={k}
              id={`tab-${k}`}
              type="button"
              className="navitem"
              aria-current={tab === k ? "page" : undefined}
              onClick={() => setTab(k)}
            >
              <Icon name={ic} />
              <span className="navtxt">
                <b>{l}</b>
                <small>{sub}</small>
              </span>
              {k === "kupovina" && shopCount > 0 && <span className="badge">{shopCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidefoot">
          <p className={"syncline " + status.cls}>
            <Icon name="sync" size={16} />
            <span>{status.txt}</span>
          </p>
          {sync.state === "off" && loaded && !demo && (
            <button type="button" className="linkbtn" onClick={() => setTab("troskovi", "sinkronizacija")}>
              Poveži laptop i mobitel
            </button>
          )}
          {!demo && (
            <button type="button" className="linkbtn" onClick={() => setDemo(true)}>
              Isprobaj s demo podacima
            </button>
          )}
        </div>
      </aside>
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <main className="main">
        {demo && (
          <div className="demobar" role="status">
            <span>
              <b>Demo podaci.</b> Cijene, kalorije i zalihe su izmišljene, a tvoji pravi podaci su netaknuti.
            </span>
            <button type="button" className="btn small ghost" onClick={() => setDemo(true, true)}>
              Kreni ispočetka
            </button>
            <button type="button" className="btn small" onClick={() => setDemo(false)}>
              Izađi iz dema
            </button>
          </div>
        )}
        <div className="pagehead">
          <h1>{cur[1]}</h1>
          <p className="sub">{cur[3]}</p>
        </div>
        {tab === "plan" && <PlanTab />}
        {tab === "zaliha" && <ZalihaTab />}
        {tab === "kupovina" && <KupovinaTab />}
        {tab === "troskovi" && <TroskoviTab />}
        {tab === "recepti" && <ReceptiTab />}
        {tab === "ducani" && <DucaniTab />}
        {tab === "prep" && <PrepTab />}
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <div key={toast.key}>
            <span>{toast.msg}</span>
            {toast.undo ? (
              <button type="button" onClick={undo}>
                Poništi
              </button>
            ) : (
              <button type="button" onClick={closeToast} aria-label="Zatvori poruku">
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    </PanelProvider>
  );
}

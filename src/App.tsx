import { useEffect } from "react";
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
  const shopCount = shopping(data).length;

  const setTab = (t: string, anchor?: string) => {
    update((d) => {
      const n = clone(d);
      n.ui.tab = t;
      if (anchor === "sinkronizacija") n.ui.trTab = "set";
      return n;
    });
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 50);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const status = !loaded
    ? { cls: "", txt: "Učitavam…" }
    : saveError
      ? { cls: "err", txt: "Spremanje nije uspjelo. Provjeri da preglednik dopušta spremanje za ovu stranicu." }
      : { cls: sync.state === "error" ? "err" : sync.state === "ok" ? "ok" : "", txt: syncText(sync.state, sync.at, sync.msg) };

  return (
    <PanelProvider render={renderView}>
      <div className="shell">
        <nav className="rail" aria-label="Dijelovi kuharice">
          <div className="rail-brand" title="Kuharica">
            <img src="./icon.svg" alt="Kuharica" width={34} height={34} />
          </div>
          <div className="rail-items">
            {TABS.map(([k, l, ic, sub]) => (
              <button
                key={k}
                id={`tab-${k}`}
                type="button"
                className="railitem"
                title={sub}
                aria-current={tab === k ? "page" : undefined}
                onClick={() => setTab(k)}
              >
                <span className="railicon">
                  <Icon name={ic} size={22} />
                  {k === "kupovina" && shopCount > 0 && <span className="badge">{shopCount}</span>}
                </span>
                <span className="raillabel">{l}</span>
              </button>
            ))}
          </div>
          <div className="rail-foot">
            <button
              type="button"
              className={"railitem small sync-" + (status.cls || "off")}
              title={status.txt}
              aria-label={`Sinkronizacija: ${status.txt}`}
              onClick={() => setTab("troskovi", "sinkronizacija")}
            >
              <span className="railicon">
                <Icon name="sync" size={20} />
                <i className="syncdot" aria-hidden="true" />
              </span>
              <span className="raillabel">Sync</span>
            </button>
            <button
              type="button"
              className="railitem small"
              aria-pressed={demo}
              title={demo ? "Izađi iz demo podataka" : "Isprobaj s demo podacima"}
              onClick={() => setDemo(!demo)}
            >
              <span className="railicon">
                <Icon name="flask" size={20} />
              </span>
              <span className="raillabel">Demo</span>
            </button>
          </div>
        </nav>

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
          {saveError && (
            <div className="demobar err" role="alert">
              <span>{status.txt}</span>
            </div>
          )}
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

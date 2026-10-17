import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useApp } from "./state/AppContext";
import { clone } from "./state/model";
import { shopping } from "./logic/inventory";
import { PlanTab } from "./tabs/PlanTab";
import { OmletTab } from "./tabs/OmletTab";
import { ZalihaTab } from "./tabs/ZalihaTab";
import { KupovinaTab } from "./tabs/KupovinaTab";
import { TroskoviTab } from "./tabs/TroskoviTab";
import { ReceptiTab } from "./tabs/ReceptiTab";
import { PrepTab } from "./tabs/PrepTab";

const TABS = [
  ["plan", "Plan"],
  ["omlet", "Omlet"],
  ["zaliha", "Zaliha"],
  ["kupovina", "Kupovina"],
  ["troskovi", "Troškovi"],
  ["recepti", "Recepti"],
  ["prep", "Prep"],
] as const;
type TabId = (typeof TABS)[number][0];

export function App() {
  const { data, loaded, saveError, update, toast, undo, closeToast } = useApp();
  const tab: TabId = TABS.some(([k]) => k === data.ui.tab) ? (data.ui.tab as TabId) : "plan";
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const shopCount = shopping(data).length;

  const setTab = (t: TabId) =>
    update((d) => {
      const n = clone(d);
      n.ui.tab = t;
      return n;
    });

  // Strelice lijevo/desno između kartica
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -99;
    if (j === -99) return;
    const t = TABS[(j + TABS.length) % TABS.length][0];
    setTab(t);
    tabRefs.current[t]?.focus();
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <>
      <div className="wrap">
        <header>
          <h1>Wok i Air Fryer Kuharica</h1>
          <p className="sub">
            Jedno kuhanje dnevno do 30 min, podijeljeno u ručak i večeru. Ciklus ugljikohidrata: riža → krumpir →
            tjestenina → riža → krumpir.
          </p>
          <p className="status">
            {!loaded
              ? "Učitavam zalihu…"
              : saveError
                ? "Spremanje nije uspjelo. Provjeri da preglednik dopušta spremanje podataka za ovu stranicu."
                : "Podaci se spremaju na ovom uređaju. Za backup koristi izvoz u kartici Troškovi."}
          </p>
        </header>

        <div className="day" aria-label="Dnevni raspored">
          <div>
            <b>Doručak</b>
            <span>omlet, svaki dan drugi</span>
          </div>
          <div>
            <b>Ručak</b>
            <span>½ recepta + velika salata + miso</span>
          </div>
          <div>
            <b>Užina</b>
            <span>1 posni sir</span>
          </div>
          <div>
            <b>Večera</b>
            <span>½ recepta + velika salata</span>
          </div>
        </div>

        <nav role="tablist" aria-label="Dijelovi kuharice" onKeyDown={onKey}>
          {TABS.map(([k, l]) => (
            <button
              key={k}
              ref={(el) => {
                tabRefs.current[k] = el;
              }}
              role="tab"
              id={`tab-${k}`}
              aria-selected={tab === k}
              aria-controls={k}
              tabIndex={tab === k ? 0 : -1}
              onClick={() => setTab(k)}
            >
              {l}
              {k === "kupovina" && shopCount > 0 && <span className="badge">{shopCount}</span>}
            </button>
          ))}
        </nav>

        {tab === "plan" && <PlanTab />}
        {tab === "omlet" && <OmletTab />}
        {tab === "zaliha" && <ZalihaTab />}
        {tab === "kupovina" && <KupovinaTab />}
        {tab === "troskovi" && <TroskoviTab />}
        {tab === "recepti" && <ReceptiTab />}
        {tab === "prep" && <PrepTab />}
      </div>

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
    </>
  );
}

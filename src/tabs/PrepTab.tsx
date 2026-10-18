/* Prep: recepti koje radiš unaprijed. Isti popis i filteri kao Recepti, plus nedjeljni redoslijed. */
import { useState } from "react";
import { PREP_TIMELINE } from "../data";
import { useApp } from "../state/AppContext";
import { RecipeList } from "./ReceptiTab";

type PTab = "list" | "order";

export function PrepTab() {
  const { data } = useApp();
  const [tabRaw, setTab] = useState<PTab>("list");
  // nedjeljni redoslijed je za ugrađene prep recepte
  const builtin = data.settings.builtin !== false;
  const tab: PTab = builtin ? tabRaw : "list";
  const tabs = builtin && (
    <div className="seg" role="tablist" aria-label="Prikaz prepa">
      {(
        [
          ["list", "Prep recepti"],
          ["order", "Nedjeljni redoslijed"],
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
  );
  return (
    <RecipeList
      mode="prep"
      tabs={tabs}
      override={
        tab === "order" ? (
          <div className="group">
            <p className="sub">Oko 75 min: lonac, wok i air fryer rade istovremeno.</p>
            <ol className="tl">
              {PREP_TIMELINE.map(([t, x]) => (
                <li key={t}>
                  <b className="g">{t}</b> {x}
                </li>
              ))}
            </ol>
            <p className="sub">Gulaš u duploj turi radi kao zaseban prep kad imaš 45 min, ne uz sve ostalo.</p>
          </div>
        ) : undefined
      }
    />
  );
}

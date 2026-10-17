import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { AppProvider } from "./state/AppContext";
import { demoStorage, indexedDbStorage, isDemo } from "./storage/storage";
import { makeDemo } from "./logic/demo";
import "./styles/app.css";

registerSW({ immediate: true });

const demo = isDemo();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider storage={demo ? demoStorage(() => makeDemo()) : indexedDbStorage} demo={demo}>
      <App />
    </AppProvider>
  </StrictMode>,
);

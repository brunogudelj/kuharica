import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { AppProvider } from "./state/AppContext";
import { indexedDbStorage } from "./storage/storage";
import "./styles/app.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider storage={indexedDbStorage}>
      <App />
    </AppProvider>
  </StrictMode>,
);

import React, { lazy, Suspense } from "react";
import {LanguageProvider} from './contexts/LanguageContext';
import ReactDOM from "react-dom/client";
const DemoApp = lazy(() => import("./demo/DemoApp"));
const LocalApp = lazy(() => import("./local/LocalApp"));
const StartApp = lazy(() => import("./local/StartApp"));
const ModernPreview = lazy(() => import("./modern/ModernApp"));
const ProductionApp = lazy(() => import("./ProductionApp"));
const pathname = location.pathname.replace(/\/$/, "");
const isDemo =
  pathname === "/demo" ||
  new URLSearchParams(location.search).get("demo") === "1";
async function start() {
  const local = Boolean((window as any).__AGRIMAP_LOCAL__);
  if (
    local &&
    !isDemo &&
    !["/local", "/start"].includes(pathname) &&
    !pathname.startsWith("/modern-preview")
  ) {
    try {
      const response = await fetch("/api/local/me", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        location.replace("/local");
        return;
      }
      (window as any).__AGRIMAP_LOCAL_SESSION__ = await response.json();
      localStorage.setItem("agrimap-manual-offline", "false");
      localStorage.setItem(
        "agri-planter-active-org",
        (window as any).__AGRIMAP_LOCAL_SESSION__.farm.id,
      );
    } catch {
      document.getElementById("root")!.textContent =
        "Farm server is unreachable. Reconnect to your farm Wi-Fi and reload.";
      return;
    }
  }
  const element = isDemo ? (
    <DemoApp />
  ) : pathname === "/local" ? (
    <LocalApp />
  ) : pathname === "/start" ? (
    <StartApp />
  ) : pathname.startsWith("/modern-preview") ? (
    <ModernPreview />
  ) : (
    <ProductionApp />
  );
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <Suspense fallback={<p role="status">Loading AgriMap…</p>}>
      <LanguageProvider>{element}</LanguageProvider>
    </Suspense>,
  );
}
start();

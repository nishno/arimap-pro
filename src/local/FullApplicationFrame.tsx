import React, { useState, useEffect } from "react";
import { isLocalRuntime, localSession, localRequest } from "./runtime";
import { MODERN_UI_VERSION } from "../utils/version";
import "./full-application.css";
const BackupPanel = React.lazy(() => import("./BackupPanel"));
export function FullApplicationFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const modern = location.pathname.startsWith("/modern");
  const [backup, setBackup] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    const failed = (e: any) => setSaveError(e.detail);
    const saved = () => setSaveError("");
    window.addEventListener("agrimap-local-save-error", failed);
    window.addEventListener("agrimap-local-save-confirmed", saved);
    return () => {
      window.removeEventListener("agrimap-local-save-error", failed);
      window.removeEventListener("agrimap-local-save-confirmed", saved);
    };
  }, []);
  return (
    <div
      className={`agrimap-full ${modern ? "agrimap-modern" : ""}`}
      onClickCapture={async (event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (
          !isLocalRuntime ||
          !anchor ||
          !["/modern", "/classic", "/local"].includes(
            new URL(anchor.href).pathname,
          )
        )
          return;
        event.preventDefault();
        try {
          const result = await (window as any).__AGRIMAP_FLUSH__?.();
          if (result === false) return;
          await (await import("./documentAdapter")).awaitLocalWrites();
          location.assign(anchor.href);
        } catch {
          setSaveError(
            "Cannot switch yet: a save failed. Reconnect to the server and retry.",
          );
        }
      }}
    >
      <div
        className="farm-runtime-bar"
        role="region"
        aria-label="Application connection"
      >
        <span>
          <b>{modern ? MODERN_UI_VERSION : "Classic"}</b> ·{" "}
          {isLocalRuntime
            ? `${localSession()?.farm.name} · Local server`
            : "Cloud application"}
        </span>
        <nav aria-label="Application controls">
          <a href={modern ? "/classic" : "/modern"}>
            {modern ? "Switch to Classic" : "Switch to Modern"}
          </a>
          {isLocalRuntime && <a href="/local">Local accounts & records</a>}
          {isLocalRuntime && localSession()?.user.role === "owner" && (
            <button onClick={() => setBackup(true)}>Cloud backup</button>
          )}
        </nav>
      </div>
      {saveError && (
        <div role="alert" className="farm-save-error">
          {saveError}
        </div>
      )}
      <div className="agrimap-app-content">{children}</div>
      {backup && (
        <React.Suspense
          fallback={<p role="status">Loading backup controls…</p>}
        >
          <BackupPanel onClose={() => setBackup(false)} />
        </React.Suspense>
      )}
    </div>
  );
}

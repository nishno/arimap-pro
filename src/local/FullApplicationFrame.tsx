import {LanguageSwitch} from './EntryControls';
import {useLanguage} from '../contexts/LanguageContext';
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
  const {t,language}=useLanguage();
  const [terminal,setTerminal]=useState(false);
  const [canWeigh,setCanWeigh]=useState(isLocalRuntime && localSession()?.user.role==='owner');
  useEffect(()=>{if(!isLocalRuntime)return;let active=true;const check=async()=>{try{const r=await fetch('/api/local/module-access',{cache:'no-store',credentials:'same-origin'});if(!r.ok){if(active)setCanWeigh(false);return;}const data=await r.json();if(active)setCanWeigh(data.role==='owner');}catch{}};void check();const timer=setInterval(check,5000);return()=>{active=false;clearInterval(timer);};},[]);
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
        <nav aria-label="Application controls"><LanguageSwitch/>{!isLocalRuntime&&<><a href="/?register=1">{t('entry.cloud_register')}</a><a href="/?login=1">{t('entry.cloud_login')}</a></>}
          <a href={modern ? "/classic" : "/modern"}>
            {modern ? "Switch to Classic" : "Switch to Modern"}
          </a>
          {isLocalRuntime && localSession()?.user.role==='owner' && <a href="/local">Local accounts & records</a>}
          {isLocalRuntime && canWeigh && <button onClick={()=>setTerminal(true)}>{language==='ka'?'აწონვის ტერმინალი · საპილოტე':'Weigh terminal · Pilot'}</button>}
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
      {terminal && <div role="dialog" aria-modal="true" aria-label="Weigh terminal pilot" style={{position:'fixed',inset:12,zIndex:20000,background:'white',display:'flex',flexDirection:'column',border:'1px solid #ccc',borderRadius:12}}>
        <nav style={{padding:10,display:'flex',gap:20}}><button onClick={()=>setTerminal(false)}>{language==='ka'?'დახურვა':'Close'}</button><a href="/terminal/index.html" target="_blank" rel="noopener" onClick={()=>setTerminal(false)}>{language==='ka'?'ცალკე ჩანართში გახსნა':'Open in new tab'}</a></nav>
        <iframe title="Weigh terminal pilot" src="/terminal/index.html" style={{border:0,flex:1,width:'100%'}}/>
      </div>}
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

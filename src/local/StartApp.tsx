import React from 'react';
import {useLanguage} from '../contexts/LanguageContext';
import {LanguageSwitch,CloudAccessLinks} from './EntryControls';
import '../demo/demo.css';
import './local.css';
export default function StartApp() {
  const {t}=useLanguage();
  return <div className="demo-shell local-shell"><header className="demo-header"><a className="demo-brand" href="/demo">✦ AgriMap <b>Pro</b></a><span className="demo-tag">Choose how to work</span><LanguageSwitch/></header><main className="local-main"><p className="demo-eyebrow">FROM EXPLORING TO YOUR OWN FARM</p><h1>Choose a home for your farm</h1><p>The demo’s sample records stay separate from either workspace.</p><div className="local-choice"><article className="demo-card"><h2>Cloud workspace</h2><p>Use the existing full application through Firebase registration and sign in. Cloud services require internet access.</p><p>This creates an independent cloud workspace. It does not link or synchronize an existing local farm yet.</p><CloudAccessLinks/></article><article className="demo-card"><h2>Local farm server</h2><p>Run on your own computer and connect devices over your farm network. {t('entry.local_modules')}</p><p>Install Node.js 24, then run these commands in the downloaded project:</p><pre>npm ci{'\n'}npm run build{'\n'}npm run local:init{'\n'}npm run local:start</pre><p>The server opens local mode at port 3100 on the server computer. LAN devices require the HTTPS setup described in <code>docs/LOCAL_SERVER.md</code>.</p><a className="demo-primary" href="/local?register=1">Open local sign in</a></article></div></main></div>;
}

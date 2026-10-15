import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';

// Do not statically import App, Firebase, AI, or production contexts here.
// The demo must remain isolated even when a real user is already signed in.
const isDemo = window.location.pathname === '/demo' || window.location.pathname === '/demo/' || new URLSearchParams(window.location.search).get('demo') === '1';
const DemoApp = lazy(() => import('./demo/DemoApp'));
const LocalApp = lazy(() => import('./local/LocalApp'));
const StartApp = lazy(() => import('./local/StartApp'));
const ModernApp = lazy(() => import('./modern/ModernApp'));
const ProductionApp = lazy(() => import('./ProductionApp'));
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element');
const pathname = window.location.pathname.replace(/\/$/, '');
ReactDOM.createRoot(rootElement).render(<Suspense fallback={<p role="status">Loading AgriMap…</p>}>{pathname === '/modern' || pathname.startsWith('/modern/') ? <ModernApp /> : isDemo ? <DemoApp /> : pathname === '/local' ? <LocalApp /> : pathname === '/start' ? <StartApp /> : <ProductionApp />}</Suspense>);

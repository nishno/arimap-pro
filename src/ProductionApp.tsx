import './lib/leafletSafety';
import 'leaflet/dist/leaflet.css';
import './index.css';
import React from 'react';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { requestPersistentStorage } from './firebase';
import { aiToolEngine } from './new_engine/ai/AIToolEngine';
try { aiToolEngine.init(); } catch (error) { console.error('AI engine initialization failed', error); }
requestPersistentStorage().catch(error => console.warn('Persistent storage was not granted', error));
export default function ProductionApp() { return <ErrorBoundary><LanguageProvider><App /></LanguageProvider></ErrorBoundary>; }

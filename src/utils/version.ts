export const MODERN_UI_VERSION = 'sonik g2.0.1.4';
export const APP_VERSION_CODE = "G2.0.1.3";
export const APP_VERSION_NAME = "sonik G2.0.1.3";

export interface VersionHistoryEntry {
  version: string;
  code: string;
  date: string;
  description: string;
  changes: string[];
}

export const SYSTEM_VERSION_HISTORY: VersionHistoryEntry[] = [
  {
    version: "sonik G2.0.1.2",
    code: "G2.0.1.2",
    date: "2026-06-24",
    description: "Centralized Version Control, duplicate units support, and service worker reload fixes.",
    changes: [
      "Created centralized version.ts utility.",
      "Added direct visual display of version under AgriMap logo in Sidebar.",
      "Added support card version code display.",
      "Fixed service worker infinite refresh loop by invoking updateSW(true) on reload confirmation.",
      "Implemented 'Copy' feature for Team & Units in Group Manager to copy group with selected employees."
    ]
  },
  {
    version: "AgriMap V2.0.0",
    code: "V2.0.0",
    date: "2026-05-10",
    description: "Initial V2 system release with offline-first tracking and Georgia regional features.",
    changes: [
      "Offline sync engine using localStorage queue.",
      "Multi-tenant organization structures.",
      "Smart GIS map views."
    ]
  }
];

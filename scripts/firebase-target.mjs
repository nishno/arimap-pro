// Print identifiers only: never print API keys, tokens or .env contents.
import {loadEnv} from 'vite';
import {readFileSync} from 'node:fs';
const env=loadEnv('production',process.cwd(),'');
const fallback=JSON.parse(readFileSync(new URL('../firebase-applet-config.json',import.meta.url),'utf8'));
const fromEnv=Boolean(env.VITE_FIREBASE_API_KEY&&env.VITE_FIREBASE_PROJECT_ID);
const projectId=fromEnv?env.VITE_FIREBASE_PROJECT_ID:fallback.projectId;
const databaseId=(!fromEnv&&fallback.firestoreDatabaseId)||(projectId?.startsWith('gen-lang-client')?'ai-studio-42204e0d-ec5c-4889-b8f7-38d7bcdb9a9d':'(default)');
console.log(JSON.stringify({projectId,databaseId,source:fromEnv?'production environment':'firebase-applet-config.json'},null,2));

const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'node_modules/@firebase/firestore/dist/common-51e31ebf.cjs.js',
  'node_modules/@firebase/firestore/dist/common-63fc3a52.rn.js',
  'node_modules/@firebase/firestore/dist/common-edb5d170.esm.js',
  'node_modules/@firebase/firestore/dist/intermediate/common.js',
  'node_modules/.vite/deps/firebase_firestore.js',
  'node_modules/react-dom/cjs/react-dom.development.js',
  'node_modules/react-dom/umd/react-dom.development.js'
];

let totalPatched = 0;

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // 1. Fix: for (const r of e.Eu.get(t)) -> for (const r of (e.Eu.get(t) || []))
  if (content.includes('for (const r of e.Eu.get(t))')) {
    content = content.replace(/for \(const r of e\.Eu\.get\(t\)\)/g, 'for (const r of (e.Eu.get(t) || []))');
    modified = true;
  }

  // 2. Fix: s = r.Eu.get(i.targetId); if (s.length > 1) -> if (s && s.length > 1)
  if (content.includes('if (s.length > 1)')) {
    content = content.replace(/if \(s\.length > 1\)/g, 'if (s && s.length > 1)');
    modified = true;
  }

  // 3. Fix: 1 === i.length -> i && 1 === i.length
  if (content.includes('1 === i.length')) {
    content = content.replace(/1 === i\.length/g, 'i && 1 === i.length');
    modified = true;
  }

  // 4. Fix React 18 internal spurious error: Expected static flag was missing
  if (content.includes('Expected static flag was missing')) {
    content = content.replace(/error\('Internal React error: Expected static flag was missing\. Please ' \+ 'notify the React team\.'\);/g, "/* Suppressed React internal static flag warning */");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[PatchFirestore] Successfully patched ${relPath}`);
    totalPatched++;
  }
}

console.log(`[PatchFirestore] Done. Patched ${totalPatched} file(s).`);

import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import {build} from 'esbuild';
import {processUi} from '../scripts/ui-text.mjs';
await build({entryPoints:['src/i18n/runtime.ts'],bundle:true,platform:'node',format:'esm',outfile:'tmp/i18n/runtime-test.mjs'});
const {translateUi,formatUiTemplate,setUiLanguage,uiText}=await import('../tmp/i18n/runtime-test.mjs');
test('Georgian/English labels, technical form values and user text remain distinct',()=>{
 assert.equal(translateUi('Register Company','ka'),'კომპანიის რეგისტრაცია');assert.equal(translateUi('Cancel','ka'),'გაუქმება');assert.match(translateUi('კომპანიის რეგისტრაცია','en'),/Company|Organization/i);
 assert.equal(formatUiTemplate('Company {0} registered successfully!',['Stock / My Farm'],'ka').includes('Stock / My Farm'),true);
 assert.equal(translateUi('ეს არის Dashboard','ka'),'ეს არის მართვის პანელი');
 assert.equal(formatUiTemplate('Company {0} registered successfully!',['Dashboard'],'ka').includes('Dashboard'),true);
 setUiLanguage('ka');assert.equal(uiText('Farm server'),'მეურნეობის სერვერი');setUiLanguage('en');assert.equal(uiText('Farm server'),'Farm server');
 const input='<><input name="name" value={company.name} placeholder="Company name"/><option>Georgia</option><button data-id="save">Save</button><p>{company.name}</p><code>npm run local:start</code></>';
 const {code}=processUi(input,'test.tsx',true);assert.match(code,/value=\{"Georgia"\}/);assert.match(code,/name="name" value=\{company.name\}/);assert.match(code,/data-id="save"/);assert.match(code,/<p>\{company.name\}<\/p>/);assert.match(code,/<code>npm run local:start<\/code>/);
 assert.equal(ts.createSourceFile('test.tsx',code,99,true,4).parseDiagnostics.length,0);
 const errors=processUi('throw new Error("Invalid document path")','test.ts',true).code;assert.match(errors,/new Error\("Invalid document path"\)/);
 const siblings=processUi('<><input placeholder="Name"/><input placeholder="Search"/></>','test.tsx',true).code;assert.equal(ts.createSourceFile('test.tsx',siblings,99,true,4).parseDiagnostics.length,0);
});
test('Every used translation key has Georgian and matching placeholders',async()=>{
 const {translations}=await import('../src/translations.ts');const files=[];function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())scan(file);else if(/\.tsx?$/.test(file)&&!file.includes('/i18n/'))files.push(file);}}scan('src');for(const file of files){for(const match of fs.readFileSync(file,'utf8').matchAll(/\bt\(['"]([^'"]+)['"]/g)){assert.equal(typeof translations.ka[match[1]],'string',file+': '+match[1]);}}
 const en=translations.en,ka=translations.ka;for(const key of Object.keys(en)){if(typeof en[key]!=='string'||typeof ka[key]!=='string')continue;const tokens=s=>(s.match(/\{[^{}]+\}/g)||[]).sort();assert.deepEqual(tokens(en[key]),tokens(ka[key]),key);}
});

test('Offline catalogues preserve every interpolation placeholder',()=>{
 for(const language of ['en','ka']){const catalogue=JSON.parse(fs.readFileSync('src/i18n/'+language+'.json','utf8'));for(const [source,target] of Object.entries(catalogue)){const tokens=text=>(text.match(/\{[^{}]+\}/g)||[]).sort();assert.deepEqual(tokens(source),tokens(target),language+': '+source);}}
});

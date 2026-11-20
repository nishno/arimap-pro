// Ship the reviewed manual without storing a second binary copy in Git.
import {mkdirSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {marked} from 'marked';
import {resolve,relative} from 'node:path';
const destination='public/help-guide';mkdirSync(destination,{recursive:true});
cpSync('docs/user-guide/screenshots',destination+'/screenshots',{recursive:true});
cpSync('docs/user-guide/AgriMap-Pro-User-Guide-en.pdf',destination+'/manual-en.pdf');
const source=readFileSync('docs/user-guide/README.md','utf8'),sop=readFileSync('docs/user-guide/SOP-CHECKLISTS.md','utf8');
function sections(text,pattern){return text.split(pattern).slice(1).map(section=>({title:section.split('\n')[0],html:marked.parse(section.slice(section.indexOf('\n'))).replaceAll('src="screenshots/','src="/help-guide/screenshots/').replace(/href="([^"#]+)(#[^"]*)?"/g,(_,target,hash='')=>{
 if(/^https?:/.test(target))return `href="${target}${hash}"`;
 if(target.startsWith('screenshots/'))return `href="/help-guide/${target}${hash}"`;
 if(target.endsWith('.pdf'))return 'href="/help-guide/manual-en.pdf"';
 const path=relative(resolve('.'),resolve('docs/user-guide',target)).replaceAll('\\','/');
 return `href="https://github.com/nishno/arimap-pro/blob/demo-preview/${path}${hash}"`;
 })}));}
writeFileSync(destination+'/manual.json',JSON.stringify({version:'2026-11-21',articles:sections(source,/^## \d+\. /m),sops:sections(sop,/^## SOP \d+ — /m)}));
console.log('Prepared illustrated Help assets');

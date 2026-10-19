import ka from './ka.json';
import en from './en.json';
import {reviewed,terminology} from './overrides';
export type UiLanguage='en'|'ka';
let activeLanguage:UiLanguage=(()=>{try{return localStorage.getItem('agri-app-lang')==='ka'?'ka':'en';}catch{return 'en';}})();
export const setUiLanguage=(language:UiLanguage)=>{activeLanguage=language;};
const normalize=(text:string)=>text.trim().replace(/\s+/g,' ');
const kaMap:Record<string,string>={...ka,...reviewed},enMap:Record<string,string>=en;
const index=(object:Record<string,string>)=>new Map(Object.keys(object).map(key=>[normalize(key).toLocaleLowerCase('en'),object[key]]));
const kaIndex=index(kaMap),enIndex=index(enMap),reviewedIndex=index(reviewed);
const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.keys(kaMap).filter(key=>/\{\w+\}/.test(key)).map(key=>({key,regex:new RegExp('^'+key.split(/\{\w+\}/).map(escaped).join('(.*?)')+'$'),names:key.match(/\{\w+\}/g)||[]})).sort((a,b)=>b.key.length-a.key.length);
function polish(value:string){
 const protectedText:string[]=[];value=value.replace(/\[ACTION:[^\]]+\]|https?:\/\/[^\s]+|`[^`]+`|\{[^{}]+\}/g,match=>{protectedText.push(match);return '\uE000'+(protectedText.length-1)+'\uE001';});
 for(const [word,translation]of Object.entries(terminology))value=value.replace(new RegExp('(?<![A-Za-z0-9_])'+escaped(word)+'(?![A-Za-z0-9_])','gi'),translation);
 if(/[ა-ჰ]/.test(value))value=value.replace(/\(([^()]*)\)/g,(raw,inside)=>/[A-Za-z]{3}/.test(inside)&&!/[ა-ჰ]/.test(inside)&&!/^(?:[A-Z\d /._-]+|Google|Firebase|Google (?:Meet|Chat|Sheets))$/.test(inside.trim())?'':raw);
 return value.replace(/\uE000(\d+)\uE001/g,(_,i)=>protectedText[Number(i)]).replace(/ {2,}/g,' ').trim();
}
export function translateUi(value:any,language:UiLanguage=activeLanguage):any{
 if(typeof value!=='string'||!value.trim())return value;
 const key=normalize(value),dictionary=language==='ka'?kaMap:enMap,lookup=language==='ka'?kaIndex:enIndex;
 let translated=(language==='ka'?reviewedIndex.get(key.toLocaleLowerCase('en')):undefined)??dictionary[key]??lookup.get(key.toLocaleLowerCase('en'));
 if(translated===undefined&&language==='ka'){for(const entry of templates){const match=entry.regex.exec(key);if(match){translated=polish(kaMap[entry.key]);entry.names.forEach((name,i)=>{translated=translated.replaceAll(name,match[i+1]);});return (value.match(/^\s*/)?.[0]||'')+translated+(value.match(/\s*$/)?.[0]||'');}}}
 if(translated===undefined)translated=key;
 if(language==='ka')translated=polish(translated);
 return (value.match(/^\s*/)?.[0]||'')+translated+(value.match(/\s*$/)?.[0]||'');
}
export const uiText=(value:any)=>translateUi(value);
export function formatUiTemplate(pattern:string,values:any[],language:UiLanguage=activeLanguage){return String(translateUi(pattern,language)).replace(/\{(\d+)\}/g,(_,index)=>String(values[Number(index)]??''));}
export const uiTemplate=(pattern:string,values:any[])=>formatUiTemplate(pattern,values);

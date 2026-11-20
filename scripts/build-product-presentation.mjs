import pptxgen from 'pptxgenjs';
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createServer} from 'node:http';
const root=process.cwd(),out=resolve('documents/presentations'),model=JSON.parse(readFileSync(out+'/deck-ka.json','utf8')),base='AgriMap-Pro-Product-Introduction-ka';
const pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='AgriMap Pro';pptx.subject='ქართული პროდუქტის გაცნობა';pptx.title=model.title;pptx.company='AgriMap Pro';pptx.lang='ka-GE';
pptx.theme={headFontFace:'Noto Sans Georgian',bodyFontFace:'Noto Sans Georgian',lang:'ka-GE'};
const C={forest:'173F32',green:'267351',cream:'F5F6F0',muted:'607467',gold:'B79A54',line:'DCE4DB',white:'FFFFFF'};
const W=13.333,H=7.5,shape=pptx.ShapeType,manifest=[];
function contain(file,x,y,w,h){const png=readFileSync(file),ratio=png.readUInt32BE(16)/png.readUInt32BE(20);let width=w,height=w/ratio;if(height>h){height=h;width=h*ratio;}return {x:x+(w-width)/2,y:y+(h-height)/2,w:width,h:height};}
const imageFile=id=>id==='help-georgian'?out+'/assets/help-georgian.png':resolve('documents/user-guide/screenshots/'+id+'.png');
const esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function text(slide,value,x,y,w,h,options={}){slide.addText(value,{x,y,w,h,fontFace:'Noto Sans Georgian',fontSize:18,color:C.forest,margin:0,breakLine:false,vertAlign:'mid',...options});}
function rect(slide,x,y,w,h,fill,line=fill){slide.addShape(shape.rect,{x,y,w,h,line:{color:line,width:.6},fill:{color:fill},radius:.1});}
function bulletList(slide,items,x,y,w,spacing=.86){items.forEach((value,index)=>{text(slide,'•',x,y+index*spacing,.22,.36,{fontSize:22,color:C.green});text(slide,value,x+.3,y+index*spacing,w-.3,spacing-.12,{fontSize:17,vertAlign:'top',fit:'shrink'});});}
let htmlSlides=[];
for(const [index,data] of model.slides.entries()){
 const slide=pptx.addSlide();slide.background={color:C.cream};const isHero=index===0;
 rect(slide,0,0,.16,H,C.green);text(slide,'AGRIMAP PRO  /  '+data.section,.65,.3,11.6,.28,{fontSize:10,color:C.green,bold:true,charSpacing:1});
 text(slide,data.title,.65,.85,12,.74,{fontSize:isHero?46:30,bold:true,fit:'shrink'});
 text(slide,data.subtitle,.67,1.65,11.95,.55,{fontSize:16,color:C.muted,fit:'shrink',vertAlign:'top'});
 if(data.image){
  const file=imageFile(data.image);if(!existsSync(file))throw Error('Missing screenshot: '+file);
  rect(slide,5.3,2.35,7.37,4.42,C.white,C.line);
  slide.addImage({path:file,...contain(file,5.39,2.44,7.19,4.24)});
  bulletList(slide,data.bullets,.7,2.55,4.12,.86);
  if(data.callout){rect(slide,.7,6.18,4.15,.5,'E6EEE5');text(slide,data.callout,.82,6.22,3.9,.4,{fontSize:11,bold:true,fit:'shrink'});}
  text(slide,data.caption,5.34,6.86,7.3,.22,{fontSize:9,color:C.muted});
  manifest.push({slide:index+1,screenshot:relative(root,file).replaceAll('\\','/'),caption:data.caption,sourceCommit:model.sourceCommit,trainingData:true});
 }else if(data.flow){
  const n=data.flow.length,gap=.25,width=(11.93-gap*(n-1))/n;
  data.flow.forEach((label,i)=>{const x=.7+i*(width+gap);rect(slide,x,2.62,width,1.2,i%2?'E8EFE7':C.white,C.line);text(slide,String(i+1).padStart(2,'0'),x+.14,2.75,width-.28,.25,{fontSize:11,color:C.green,bold:true});text(slide,label,x+.14,3.07,width-.28,.55,{fontSize:17,bold:true,fit:'shrink'});if(i<n-1)text(slide,'→',x+width,3.02,gap,.4,{fontSize:16,align:'center'});});
  bulletList(slide,data.bullets,.85,4.35,11.3,.65);
  if(data.badge)text(slide,data.badge,.85,6.55,11.4,.3,{fontSize:12,color:C.green,bold:true});
 }else if(data.cards){
  const width=3.8;data.cards.forEach((card,i)=>{const x=.7+i*4.06;rect(slide,x,2.65,width,2.3,C.white,C.line);text(slide,card.title,x+.22,2.92,width-.44,.5,{fontSize:23,bold:true});text(slide,card.text,x+.22,3.62,width-.44,1.05,{fontSize:17,fit:'shrink',vertAlign:'top'});});
  bulletList(slide,data.bullets,.8,5.4,11.5,.65);
 }else{bulletList(slide,data.bullets,.85,2.7,11.25,.85);}
 rect(slide,.65,7.14,12.02,.008,C.line);text(slide,'21.11.2026  ·  პროდუქტის გაცნობა  ·  ეკრანებზე სასწავლო მონაცემებია',.7,7.22,11.5,.17,{fontSize:8,color:C.muted});text(slide,String(index+1).padStart(2,'0'),12.05,7.18,.55,.25,{fontSize:10,color:C.green,align:'right'});
 slide.addNotes(data.notes);
 const media=data.image?`<figure><img src="${esc(relative(out,imageFile(data.image)).replaceAll('\\','/'))}" alt="${esc(data.caption)}"><figcaption>${esc(data.caption)}</figcaption></figure>`:'';
 const flow=data.flow?`<div class="flow">${data.flow.map((v,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><p>${esc(v)}</p></div>`).join('')}</div>`:'';
 const cards=data.cards?`<div class="cards">${data.cards.map(v=>`<article><h2>${esc(v.title)}</h2><p>${esc(v.text)}</p></article>`).join('')}</div>`:'';
 const bullets=`<ul>${data.bullets.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;
 htmlSlides.push(`<section class="slide ${data.image?'with-image':''} ${isHero?'hero':''}" id="slide-${index+1}"><header><p class="eyebrow">AGRIMAP PRO / ${esc(data.section)}</p><h1>${esc(data.title)}</h1><p class="subtitle">${esc(data.subtitle)}</p></header><div class="content">${flow}${cards}<div class="body">${bullets}${data.callout?`<p class="callout">${esc(data.callout)}</p>`:''}</div>${media}${data.badge?`<p class="badge">${esc(data.badge)}</p>`:''}</div><footer><span>21.11.2026 · პროდუქტის გაცნობა · ეკრანებზე სასწავლო მონაცემებია</span><b>${String(index+1).padStart(2,'0')}</b></footer></section>`);
}
await pptx.writeFile({fileName:out+'/'+base+'.pptx',compression:true});
const css=`@page{size:1600px 900px;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e0e7df;color:#173f32;font-family:'Noto Sans Georgian','DejaVu Sans',sans-serif}.slide{position:relative;width:1600px;height:900px;overflow:hidden;background:#f5f6f0;padding:42px 78px 55px;border-left:18px solid #267351;break-after:page}.eyebrow{font-size:15px;letter-spacing:1.4px;color:#267351;margin:0 0 30px;font-weight:650}h1{font-size:43px;line-height:1.25;margin:0 0 22px;font-weight:700}.hero h1{font-size:70px}.subtitle{font-size:22px;line-height:1.5;color:#607467;margin:0}.content{margin-top:34px}.body ul{list-style:none;padding:0;margin:0}.body li{font-size:25px;line-height:1.55;padding-left:28px;position:relative;margin-bottom:24px}.body li:before{content:'•';position:absolute;left:0;color:#267351}.with-image .content{display:grid;grid-template-columns:490px 1fr;gap:40px;align-items:start}.with-image .body{padding-top:12px}.with-image .body li{font-size:22px;margin-bottom:24px}.callout{font-size:17px;background:#e6eee5;padding:14px;border-radius:7px;margin-top:35px;line-height:1.5;font-weight:600}figure{margin:0;background:white;border:1px solid #dce4db;padding:12px;border-radius:10px}figure img{display:block;width:100%;height:500px;object-fit:contain}figcaption{font-size:13px;color:#607467;line-height:1.5;margin-top:12px}.flow{display:flex;gap:22px;margin:35px 0 55px}.flow>div{flex:1;min-width:0;border:1px solid #dce4db;background:white;padding:22px;min-height:145px;border-radius:9px}.flow b{font-size:17px;color:#267351}.flow p{font-size:23px;font-weight:650;line-height:1.4;margin:14px 0 0}.flow~.body li{font-size:23px;margin-bottom:18px}.cards{display:flex;gap:30px;margin:42px 0 40px}.cards article{flex:1;background:white;border:1px solid #dce4db;padding:26px;min-height:260px;border-radius:10px}.cards h2{font-size:30px;margin:0 0 24px}.cards p{font-size:23px;line-height:1.5;margin:0}.cards~.body li{font-size:22px;margin-bottom:18px}.badge{color:#267351;font-weight:650;font-size:18px}footer{position:absolute;bottom:26px;left:78px;right:78px;border-top:1px solid #dce4db;padding-top:13px;display:flex;justify-content:space-between;color:#607467;font-size:12px}.controls{position:fixed;bottom:16px;right:20px;z-index:10;background:white;border:1px solid #bdd0c2;border-radius:10px;padding:10px;display:flex;gap:8px}.controls button{cursor:pointer;border:0;background:#267351;color:white;padding:10px;border-radius:6px;font-family:inherit}.slide{margin:16px auto;box-shadow:0 2px 12px #183e3214}@media print{.controls{display:none}.slide{margin:0;box-shadow:none}}`;
const html=`<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.title)}</title><style>${css}</style></head><body>${htmlSlides.join('')}<div class="controls"><button onclick="move(-1)">← წინა</button><button onclick="move(1)">შემდეგი →</button><button onclick="window.print()">ბეჭდვა / PDF</button></div><script>function move(step){const slides=[...document.querySelectorAll('.slide')];const closest=slides.reduce((best,item,index)=>Math.abs(item.getBoundingClientRect().top)<Math.abs(slides[best].getBoundingClientRect().top)?index:best,0);slides[Math.max(0,Math.min(slides.length-1,closest+step))].scrollIntoView({behavior:'smooth'});}document.addEventListener('keydown',event=>{if(['ArrowRight','PageDown'].includes(event.key)){event.preventDefault();move(1);}if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();move(-1);}});</script></body></html>`;
writeFileSync(out+'/index.html',html);
writeFileSync(out+'/screenshot-sources.json',JSON.stringify({date:model.date,sourceCommit:model.sourceCommit,trainingData:true,liveHardware:false,screenshots:manifest},null,2)+'\n');
writeFileSync(out+'/SPEAKER-NOTES-ka.md',`# AgriMap Pro — მომხსენებლის ჩანაწერები\n\nქართული პროდუქტის გაცნობა · 21 ნოემბერი 2026 · დაახლოებით 15 წუთი\n\nეკრანის სურათები სასწავლო მონაცემებს ასახავს. პრეზენტაცია არ ამტკიცებს ჯერ დაუტესტავი ინტეგრაციების მზაობას.\n\n`+model.slides.map((slide,i)=>`## ${i+1}. ${slide.title}\n\n${slide.notes}\n`).join('\n'));
const server=createServer((req,res)=>{try{const target=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!target.startsWith(root+'/documents/')){res.writeHead(403).end();return;}res.setHeader('Content-Type',target.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(readFileSync(target));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:1660,height:980}});await page.goto(`http://127.0.0.1:${server.address().port}/documents/presentations/index.html`);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
 const overflow=await page.locator('.slide').evaluateAll(slides=>slides.flatMap((slide,i)=>[...slide.querySelectorAll('header,.content,footer')].filter(item=>item.getBoundingClientRect().bottom>slide.getBoundingClientRect().bottom+1).map(()=>i+1)));if(overflow.length)throw Error('Slide content overflows: '+overflow.join(','));
 await page.pdf({path:out+'/'+base+'.pdf',printBackground:true,preferCSSPageSize:true});
 await page.emulateMedia({media:'print'});await page.locator('.slide').first().screenshot({path:out+'/assets/cover.png'});
 mkdirSync('/tmp/agrimap-presentation-preview',{recursive:true});for(let i=0;i<model.slides.length;i++)await page.locator('.slide').nth(i).screenshot({path:`/tmp/agrimap-presentation-preview/slide-${String(i+1).padStart(2,'0')}.png`});
 console.log('Built',model.slides.length,'slides: editable PPTX, PDF, HTML and Georgian speaker notes.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

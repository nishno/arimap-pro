"""Developer-only catalogue generation. Sends static interface phrases, never live records or credentials."""
import concurrent.futures,json,re,time,urllib.parse,urllib.request,pathlib,sys
target="en" if "--english" in sys.argv else "ka"
sources=json.load(open('tmp/i18n/sources.json',encoding='utf-8'));pairs=json.load(open('tmp/i18n/pairs.json',encoding='utf-8'))
output=pathlib.Path('src/i18n/'+target+'.json');catalog=json.load(open(output,encoding='utf-8')) if output.exists() else {}
if target=='ka':
 for source,value in pairs.items():catalog.setdefault(source,value)
 for source in sources:
  if re.search(r'[ა-ჰ]',source) and not re.search(r'[A-Za-z]',source):catalog.setdefault(source,source)
else:
 for source,value in pairs.items():
  if re.search(r'[ა-ჰ]',value):catalog.setdefault(value,source)
 sources=[source for source in sources if re.search(r'[ა-ჰ]',source)]
# Tokens and URLs are technical values rather than translatable UI prose.
keep=re.compile(r'^(?:[A-Z]+[-_][A-Z_\d.\-/ :\[\]()#]{1,26}|[A-Z_]*\d[A-Z_\d.\-/ :\[\]()#]{0,26}|[\d\s°%+/*×.,:;{}\[\]()_-]+|[a-z]+://\S+|#[\w-]+|[\w./-]+\.(?:js|ts|json|png|svg))$')
if '--repair' in sys.argv:
 sources=list(json.load(open('tmp/i18n/repair-now.json',encoding='utf-8')))
 for source in sources:catalog.pop(source,None)
missing=[s for s in sources if s not in catalog and not keep.fullmatch(s)]
batches=[];batch=[];size=0
for text in missing:
 n=len(urllib.parse.quote(text))
 if batch and size+n>3800:batches.append(batch);batch=[];size=0
 batch.append(text);size+=n+3
if batch:batches.append(batch)
def request(text):
 u='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'ka' if target=='en' else 'en','tl':target,'dt':'t','q':text})
 for attempt in range(3):
  try:
   with urllib.request.urlopen(u,timeout=35) as response:data=json.load(response)
   return ''.join(part[0] for part in data[0] if part[0])
  except Exception:
   if attempt==2:raise
   time.sleep(1+attempt)
def translate(batch):
 # Stable placeholders are checked; no runtime values are sent to the service.
 maps=[];protected=[]
 for phrase in batch:
  markers={};counter=[0]
  def protect(match):
   token='ZXQ'+str(counter[0])+'QXZ';counter[0]+=1;markers[token]=match.group(0);return token
  protected.append(re.sub(r'\{[^{}]+\}|\[ACTION:[^\]]+\]|https?://[^\s]+|`[^`]+`',protect,phrase));maps.append(markers)
 translated=request('\n'.join(protected)).split('\n')
 if len(translated)!=len(batch):translated=[request(text) for text in protected]
 result={}
 for source,translated_text,markers in zip(batch,translated,maps):
  result_text=translated_text
  for marker,value in markers.items():result_text=result_text.replace(marker,value)
  if set(re.findall(r'\{[^{}]+\}',source))!=set(re.findall(r'\{[^{}]+\}',result_text)):continue
  result[source]=result_text.strip()
 return result
print(f'Generating {len(missing)} translations in {len(batches)} batches; seeded {len(catalog)} existing pairs.',flush=True)
completed=0;errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
 futures={executor.submit(translate,b):b for b in batches}
 for future in concurrent.futures.as_completed(futures):
  try:catalog.update(future.result())
  except Exception as error:errors.append(str(error))
  completed+=1
  if completed%10==0 or completed==len(batches):
   output.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(f'Batches {completed}/{len(batches)}; catalogue {len(catalog)}; errors {len(errors)}',flush=True)
output.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
remaining=[s for s in missing if s not in catalog];pathlib.Path('tmp/i18n/untranslated-'+target+'.json').write_text(json.dumps(remaining,ensure_ascii=False,indent=2),encoding='utf-8');print(f'Untranslated phrases: {len(remaining)}',flush=True)

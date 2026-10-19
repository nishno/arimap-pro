import ts from 'typescript';
export const norm=text=>text.replace(/\s+/g,' ').trim();
export function decode(text){return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(raw,key)=>key[0]==='#'?String.fromCodePoint(key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[key.toLowerCase()]||raw);}
export const isHuman=text=>/[a-z]{2}|[\u10a0-\u10ff]/i.test(text)&&!/^\s*(https?:|rtsp:|wss?:|\/api\/|#[0-9a-f]{3,8}\b|[\w.-]+@|[A-Za-z0-9_./-]+\.(?:json|js|ts|png|svg|html)\b)/i.test(text)&&!/^\s*<[^>]+>\s*$/.test(text);
const attributes=new Set(['placeholder','title','aria-label','aria-description','alt','label','description','emptyMessage','confirmText','cancelText','subtitle','subTitle','helperText','detail','searchPlaceholder','emptyText']);
const displayProperties=new Set(['label','header','caption','placeholder','tooltip','helpText','emptyMessage','buttonText']);
const propertyCandidates=new Set([...displayProperties,'description','title','message','text']);
function jsxText(text){const lines=text.split(/\r\n|\n|\r/);let last=0;for(let i=0;i<lines.length;i++)if(/[^ \t]/.test(lines[i]))last=i;let out='';lines.forEach((line,i)=>{let value=line.replace(/\t/g,' ');if(i!==0)value=value.replace(/^ +/,'');if(i!==lines.length-1)value=value.replace(/ +$/,'');if(value){if(i!==last)value+=' ';out+=value;}});return decode(out);}
function template(node){let text=node.head.text;const values=[];node.templateSpans.forEach((part,i)=>{text+=`{${i}}`+part.literal.text;values.push(part.expression);});return{text,values};}
export function processUi(source,file,transform=false){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),found=new Set(),edits=[];let used=false;
 const stringArrays=new Set();function scan(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isArrayLiteralExpression(n.initializer)&&n.initializer.elements.every(ts.isStringLiteralLike))stringArrays.add(n.name.text);ts.forEachChild(n,scan);}scan(ast);
 const add=text=>{text=norm(decode(text));if(isHuman(text))found.add(text);return isHuman(text);};
 function replace(node,value){edits.push({start:node.getStart(ast),end:node.end,value});used=true;}
 function display(node,jsx){if(!node)return;
  if(ts.isStringLiteralLike(node)){if(add(node.text)&&transform)replace(node,jsx?`<__UiText value={${JSON.stringify(node.text)}}/>`:`__uiText(${JSON.stringify(node.text)})`);return;}
  if(ts.isTemplateExpression(node)){const item=template(node);if(add(item.text)&&transform){const args=item.values.map(v=>v.getText(ast)).join(',');replace(node,jsx?`<__UiTemplate pattern={${JSON.stringify(item.text)}} values={[${args}]}/>`:`__uiTemplate(${JSON.stringify(item.text)},[${args}])`);}return;}
  if(ts.isParenthesizedExpression(node)){display(node.expression,jsx);return;}
  if(ts.isConditionalExpression(node)){display(node.whenTrue,jsx);display(node.whenFalse,jsx);return;}
  if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)){display(node.left,jsx);display(node.right,jsx);return;}
  if(jsx&&ts.isIdentifier(node)){let parent=node.parent;while(parent&&!ts.isArrowFunction(parent))parent=parent.parent;if(parent&&parent.parameters.some(p=>p.name.getText(ast)===node.text)&&ts.isCallExpression(parent.parent)&&ts.isPropertyAccessExpression(parent.parent.expression)){const receiver=parent.parent.expression.expression;if((ts.isIdentifier(receiver)&&stringArrays.has(receiver.text))||(ts.isArrayLiteralExpression(receiver)&&receiver.elements.every(ts.isStringLiteralLike))){if(transform)replace(node,`<__UiText value={${node.getText(ast)}}/>`);return;}}}
  if(jsx&&((ts.isPropertyAccessExpression(node)&&new Set([...displayProperties,'status','role','priority','unitOfMeasure','currency']).has(node.name.text))||(ts.isIdentifier(node)&&/^(label|status|role|category|unit|currency|option|section|priority|header|currentUserRole|employeeType|paymentType|accountType)$/.test(node.text)))&&transform)replace(node,`<__UiText value={${node.getText(ast)}}/>`);
 }
 function visit(node){
  if(ts.isJsxText(node)){const value=jsxText(node.text);if(add(value)&&transform)replace(node,`<__UiText value={${JSON.stringify(value)}}/>`);return;}
  if(ts.isJsxExpression(node)&&node.parent&&!ts.isJsxAttribute(node.parent)){display(node.expression,true);ts.forEachChild(node.expression,visit);return;}
  if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
   const opening=ts.isJsxElement(node)?node.openingElement:node;const tag=opening.tagName.getText(ast);if(['script','style','pre','code','textarea'].includes(tag))return;
   if(transform&&tag==='option'&&ts.isJsxElement(node)&&!opening.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(ast)==='value')){const child=node.children.find(c=>!ts.isJsxText(c)||c.text.trim());let value=child&&ts.isJsxText(child)?JSON.stringify(jsxText(child.text)):child&&ts.isJsxExpression(child)&&child.expression?child.expression.getText(ast):null;if(value){edits.push({start:opening.end-1,end:opening.end-1,value:' value={'+value+'}'});used=true;}}const localizable=opening.attributes.properties.filter(a=>ts.isJsxAttribute(a)&&attributes.has(a.name.getText(ast))&&a.initializer&&ts.isStringLiteral(a.initializer)&&add(a.initializer.text));
   if(transform&&localizable.length){const props=Object.fromEntries(localizable.map(a=>[a.name.getText(ast),a.initializer.text]));edits.push({start:node.getStart(ast),end:node.getStart(ast),value:'<__UiElement labels={'+JSON.stringify(props)+'} element={',priority:1},{start:node.end,end:node.end,value:'}/>',priority:-1});used=true;}
  }
  if(ts.isCallExpression(node)){
   const name=node.expression.getText(ast);if(/^(?:toast\.(?:success|error|info|warning|message|loading)|(?:window\.)?(?:alert|confirm|prompt))$/.test(name)){display(node.arguments[0],false);return;}
  }
  if(ts.isNewExpression(node)&&['Error','FarmError'].includes(node.expression.getText(ast))){const value=node.arguments?.[node.expression.getText(ast)==='FarmError'?1:0];if(value&&ts.isStringLiteralLike(value))add(value.text);else if(value&&ts.isTemplateExpression(value))add(template(value).text);return;}
  if(ts.isPropertyAssignment(node)&&propertyCandidates.has(node.name.getText(ast).replace(/^['"]|['"]$/g,''))){const value=node.initializer;if(ts.isStringLiteralLike(value))add(value.text);if(ts.isConditionalExpression(value)){if(ts.isStringLiteralLike(value.whenTrue))add(value.whenTrue.text);if(ts.isStringLiteralLike(value.whenFalse))add(value.whenFalse.text);}}
  ts.forEachChild(node,visit);
 }
 visit(ast);
 if(!transform||!used)return {found:[...found],code:source};
 // Insertions at boundaries must be applied around, rather than through, child edits.
 edits.sort((a,b)=>b.start-a.start||b.end-a.end||(b.priority||0)-(a.priority||0));let result=source;
 for(const edit of edits)result=result.slice(0,edit.start)+edit.value+result.slice(edit.end);
 const jsxImport=file.endsWith('tsx')?`import {UiText as __UiText,UiTemplate as __UiTemplate,UiElement as __UiElement} from '/src/i18n/UiText';\n`:'';
 return {found:[...found],code:jsxImport+`import {uiText as __uiText,uiTemplate as __uiTemplate} from '/src/i18n/runtime';\n`+result};
}
/** @returns {import('vite').Plugin} */
export function uiTranslationPlugin(){return{name:'agrimap-source-translations',enforce:'pre',transform(source,id){const file=id.split('?')[0].replace(/\\/g,'/');if(!(/\.tsx?$/.test(file))||!(/\/src\/(?:App\.tsx|components\/|contexts\/|demo\/|modern\/|hooks\/|services\/|lib\/|local\/(?:FullApplicationFrame|BackupPanel|LocalApp|StartApp)\.tsx)/.test(file)))return null;const result=processUi(source,file,true);return result.code===source?null:{code:result.code,map:null};}};}

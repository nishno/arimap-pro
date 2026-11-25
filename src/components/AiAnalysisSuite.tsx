import {Stethoscope,Sparkles,ClipboardList,Archive} from 'lucide-react';
import './reference-ui.css';
import React, { useEffect, useState, useId } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { clinicalAnalysisService, SavedAgroAnalysisRecord } from '../services/clinicalAnalysisService';
import { analyzePlantDisease, analyzeAgriImage, generateDocumentComparison, executeGeminiCall } from '../services/geminiService';
import './clinical-workspace.css';
interface AiAnalysisSuiteProps {
    mode?: 'compact' | 'full';
    activeOrgId?: string;
    currentUser?: any;
    onClose?: () => void;
    onAddTask?: (task: any) => void;
    onAddNutritionPlan?: (plan: any) => void;
    initialTool?: 'disease' | 'document' | 'agro_image' | 'history';
}
const readFile = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
const emptyPlan = () => ({ treatment: '', dosage: '', nutrition: '', prevention: '', elements: [] as {
        inventoryItemId: string;
        newItemName: string;
        quantity: number;
        unit: string;
    }[] });
export const AiAnalysisSuite: React.FC<AiAnalysisSuiteProps> = ({ activeOrgId, currentUser, onClose, onAddNutritionPlan, initialTool = 'disease' }) => {
    const { language } = useLanguage(), ka = language === 'ka', t = (ge: string, en: string) => ka ? ge : en;
    const fileInputId=useId();
    const [tab, setTab] = useState(initialTool), [records, setRecords] = useState<SavedAgroAnalysisRecord[]>([]), [selected, setSelected] = useState<SavedAgroAnalysisRecord | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [filter, setFilter] = useState(''), [category, setCategory] = useState('All');
    const [files, setFiles] = useState<File[]>([]), [result, setResult] = useState<any>(null), [title, setTitle] = useState(''), [severity, setSeverity] = useState('Moderate'), [sector, setSector] = useState(''), [comment, setComment] = useState(''), [plan, setPlan] = useState(emptyPlan), [origin, setOrigin] = useState<'AI-generated' | 'Agronomist-created' | 'Combined'>('Agronomist-created'), [editor, setEditor] = useState(false);
    const [material, setMaterial] = useState(''), [quantity, setQuantity] = useState(''), [unit, setUnit] = useState('kg');
    const categoryText = (value: string) => value === 'AI-generated' ? t('AI-ის შექმნილი', 'AI-generated') : value === 'Combined' ? t('კომბინირებული', 'Combined') : t('აგრონომის შექმნილი', 'Agronomist-created');
    function resultView(raw:any){
        if(!raw)return null;
        const fields=[[t('დიაგნოზი / საგანი','Diagnosis / subject'),raw.diseaseName||raw.subject],[t('აღწერა / მდგომარეობა','Description / condition'),raw.description||raw.condition],[t('მიგნებები','Findings'),raw.comparisonReport||raw.metrics],[t('რეკომენდაციები','Recommendations'),raw.treatmentSuggestions||raw.recommendations]];
        if(typeof raw==='string')return <p className="whitespace-pre-wrap">{raw}</p>;
        return <dl className="space-y-3">{fields.filter(([,value])=>value).map(([label,value])=><div key={String(label)}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap">{Array.isArray(value)?<ul className="list-disc pl-5">{value.map((item,index)=><li key={index}>{String(item)}</li>)}</ul>:String(value)}</dd></div>)}</dl>;
    }

    async function refresh() { try {
        setRecords(await clinicalAnalysisService.getSavedAnalyses(activeOrgId));
    }
    catch (error) {
        setMessage(t('არქივი ვერ ჩაიტვირთა. გადაამოწმეთ წვდომის წესები.', 'Archive could not be loaded. Check access rules.'));
    } }
    useEffect(() => { setSelected(null); setRecords([]); void refresh(); }, [activeOrgId, currentUser?.id]);
    useEffect(() => setTab(initialTool), [initialTool]);
    function open(record: SavedAgroAnalysisRecord) { setSelected(record); setResult(record.rawAiResult); setTitle(record.title); setOrigin(record.sourceCategory || 'AI-generated'); const c = record.agronomistConclusion; setSeverity(c?.severity || 'Moderate'); setSector(c?.targetSectorOrPlot || ''); setComment(c?.notes || ''); setPlan(record.plan || { ...emptyPlan(), treatment: c?.prescribedTreatment || '', dosage: c?.recommendedDosage || '', nutrition: c?.prescribedNutrition || '', prevention: c?.preventiveMeasures || '' }); setEditor(false); }
    function newPrescription() { setSelected(null); setResult(null); setTitle(''); setOrigin('Agronomist-created'); setPlan(emptyPlan()); setSeverity('Moderate'); setSector(''); setComment(''); setEditor(true); setMessage(''); }
    function manualChange() { setOrigin(previous => previous === 'AI-generated' ? 'Combined' : previous); }
    function conclusion(recipe = plan) { return { notes: comment, severity: severity as any, prescribedTreatment: recipe.treatment, activeIngredients: recipe.elements.map(element => element.newItemName), recommendedDosage: recipe.dosage, prescribedNutrition: recipe.nutrition, preventiveMeasures: recipe.prevention, targetSectorOrPlot: sector, authorName: currentUser?.name || '', authorRole: currentUser?.roles?.[0] || '', authorId: currentUser?.id, isVerified: false, updatedAt: new Date().toISOString() }; }
    async function saveRecord(raw: any = result, source = origin) {
        const saved = await clinicalAnalysisService.saveAnalysisRecord({ ...(selected || {}), type: tab === 'history' ? selected?.type || 'disease' : tab, title: title.trim() || raw?.diseaseName || t('აგრონომიული დასკვნა', 'Agronomic conclusion'), organizationId: activeOrgId || '', ownerId: currentUser?.id, sourceCategory: source, rawAiResult: raw || {}, plan, agronomistConclusion: conclusion() });
        setSelected(saved);
        await refresh();
        return saved;
    }
    async function analyze() { setBusy(true); setMessage(''); try {
        let raw: any;
        if (tab === 'document') {
            const docs = await Promise.all(files.map(async (file) => ({ id: crypto.randomUUID(), fileName: file.name, content: await readFile(file) })));
            raw = { comparisonReport: await generateDocumentComparison(docs, language) };
        }
        else {
            const data = await readFile(files[0]);
            raw = await (tab === 'agro_image' ? analyzeAgriImage : analyzePlantDisease)(data.split(',')[1], files[0].type, language);
        }
        setResult(raw);
        setOrigin('AI-generated');
        setTitle(raw.diseaseName || files.map(file => file.name).join(', '));
        const saved = await clinicalAnalysisService.saveAnalysisRecord({ type: tab === 'history' ? 'disease' : tab, title: raw.diseaseName || files.map(file => file.name).join(', '), organizationId: activeOrgId || '', sourceCategory: 'AI-generated', rawAiResult: raw });
        open(saved);
        await refresh();
        setMessage(t('შედეგი შენახულია არქივში.', 'Result saved to archive.'));
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : 'Analysis failed');
    }
    finally {
        setBusy(false);
    } }
    async function generatePlan() { setBusy(true); setMessage(''); try {
        const response = await executeGeminiCall({ contents: `Respond in ${language}. Draft a treatment plan for review by an agronomist. Do not invent diagnoses, approved products, dosage or local legal authorizations. If insufficient evidence, explain missing information. Context: ${JSON.stringify({ title, result, severity, sector, comment, currentPlan: plan })}. Return JSON with string fields treatment,dosage,nutrition,prevention.`, config: { responseMimeType: 'application/json' } });
        const generated = JSON.parse(response.text);
        if (!generated || typeof generated.treatment !== 'string')
            throw Error('Gemini returned an invalid plan.');
        const next = { ...plan, ...Object.fromEntries(['treatment', 'dosage', 'nutrition', 'prevention'].map(key => [key, typeof generated[key] === 'string' ? generated[key] : ''])) };
        setPlan(next);
        const source = origin === 'Agronomist-created' && (comment || plan.treatment) ? 'Combined' : 'AI-generated';
        setOrigin(source);
        setEditor(true);
        const saved = await clinicalAnalysisService.saveAnalysisRecord({ ...(selected || {}), type: selected?.type || 'disease', title: title.trim() || t('AI გეგმის მონახაზი', 'AI plan draft'), organizationId: activeOrgId || '', sourceCategory: source, rawAiResult: result || {}, plan: next, agronomistConclusion: conclusion(next) });
        setSelected(saved);
        await refresh();
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : 'Plan generation failed');
    }
    finally {
        setBusy(false);
    } }
    async function save(dispatch = false) { setBusy(true); setMessage(''); try {
        if (!title.trim())
            throw Error(t('მიუთითეთ სათაური', 'Enter a title'));
        if (dispatch && (!onAddNutritionPlan || !activeOrgId))
            throw Error('Management access to Agronomy is required.');
        if (dispatch && (!sector.trim() || !plan.elements.length))
            throw Error(t('მიუთითეთ სექტორი და გეგმის მასალები/რაოდენობები', 'Enter the target sector and plan materials/quantities'));
        const saved = await saveRecord();
        if (dispatch) {
            await onAddNutritionPlan!({ id: 'clinical-' + saved.id, organizationId: activeOrgId, name: saved.title, purpose: 'Treatment', elements: plan.elements, startDate: new Date().toISOString().slice(0, 10), notes: [sector, plan.treatment, plan.dosage, plan.nutrition, plan.prevention, comment].filter(Boolean).join('\n'), clinicalRecordId: saved.id });
        }
        setMessage(dispatch ? t('შენახულია და აგრონომიაში დამატებულია', 'Saved and added to Agronomy') : t('შენახულია არქივში', 'Saved to archive'));
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : 'Save failed');
    }
    finally {
        setBusy(false);
    } }
    return <section className="clinical-workspace" data-tool={tab}><header className="clinical-page-header"><div className="clinical-heading"><span className="ad-icon"><Stethoscope size={21}/></span><div><span className="ad-eyebrow">{t('აგრონომიული სამუშაო სივრცე','Clinical workspace')}</span><h2>{t('AI აგრო დიაგნოსტიკა', 'AI Agro Diagnostic & Clinical Suite')}</h2><p>{t('ანალიზი, გეგმა და გამოცდილების არქივი ერთ სივრცეში.','Analysis, reviewed plans and a dated archive in one workspace.')}</p></div></div>{onClose && <button aria-label="Close diagnostics" onClick={onClose}>✕</button>}</header><nav aria-label="Diagnostic tools">{(['disease', 'document', 'agro_image', 'history'] as const).map((value, index) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setFiles([]); if (value === 'history') {
        setSelected(null);
        setResult(null);
        setTitle('');
        setPlan(emptyPlan());
        setComment('');
    } }}>{[t('დაავადება', 'Disease'), t('დოკუმენტები', 'Docs'), t('ხედვა', 'Vision'), t('არქივი', 'Archive')][index]}</button>)}</nav><div className="clinical-columns"><div className="clinical-source">
 {tab !== 'history' ? <><div className="clinical-panel-heading"><span className="clinical-step">01</span><div><h3>{t('ატვირთვა და ანალიზი', 'Upload & analyze')}</h3><p>{t('დაამატეთ ფაილი დიაგნოსტიკის დასაწყებად.','Add a file to begin the analysis.')}</p></div></div><label className="clinical-file-picker" htmlFor={fileInputId}><span>{t('ფაილის არჩევა','Choose file')}</span><span>{files.length?t('არჩეული ფაილები: ','Selected files: ')+files.length:t('ფაილი არ არის არჩეული','No file chosen')}</span><input id={fileInputId} className="clinical-file-input" aria-label="Analysis files" type="file" accept={tab === 'document' ? '.pdf,.txt,.csv,.png,.jpg,.jpeg' : 'image/*'} multiple={tab === 'document'} onChange={e => setFiles([...(e.target.files || [])])}/></label><p>{files.map(file => file.name).join(', ')}</p><button disabled={busy || !files.length} onClick={analyze}>{t('AI ანალიზის გაშვება', 'Run AI analysis')}</button>{result && <article className="clinical-result"><h3>{t('AI შედეგი — გადასამოწმებელია', 'AI result — requires review')}</h3>{resultView(result)}</article>}</> : <><h3>{t('არქივი', 'Archive')}</h3><input aria-label="Search archive" placeholder={t('არქივში ძიება', 'Search archive')} value={filter} onChange={e => setFilter(e.target.value)}/><select aria-label="Archive category" value={category} onChange={e => setCategory(e.target.value)}><option value="All">{t('ყველა კატეგორია', 'All categories')}</option>{['AI-generated', 'Agronomist-created', 'Combined'].map(value => <option key={value} value={value}>{categoryText(value)}</option>)}</select>{records.filter(record => (category === 'All' || record.sourceCategory === category) && record.title.toLowerCase().includes(filter.toLowerCase())).map(record => <article className="clinical-archive-row" key={record.id}><button onClick={() => open(record)}><b>{record.title}</b><span className="clinical-archive-meta">{categoryText(record.sourceCategory || 'AI-generated')} · {new Date(record.createdAt).toLocaleString(ka ? 'ka-GE' : 'en-GB')}</span></button>{selected?.id === record.id && <>{resultView(record.rawAiResult)}<p>{record.agronomistConclusion?.notes}</p><div className="clinical-actions"><button onClick={() => setEditor(true)}>{t('რედაქტირება', 'Edit')}</button><button onClick={() => { const source = selected; setSelected(null); setTitle(source.title + ' — ' + t('ასლი', 'copy')); setEditor(true); }}>{t('ხელახალი გამოყენება', 'Reuse')}</button><button onClick={async () => { if (!window.confirm(t('წაიშალოს ჩანაწერი?', 'Delete this record?')))
        return; try {
        await clinicalAnalysisService.deleteAnalysisRecord(record.id);
        setSelected(null);
        setResult(null);
        await refresh();
    }
    catch {
        setMessage('Delete failed');
    } }}>{t('წაშლა', 'Delete')}</button></div></>}</article>)}</>}
 </div><div className="clinical-editor"><div className="clinical-panel-heading"><span className="clinical-step">02</span><div><h3>{t('აგრონომის დასკვნა და დანიშნულება', "Agronomist's Conclusion & Prescription")}</h3><p>{t('შექმენით ან შეავსეთ გეგმა და გადაამოწმეთ შენახვამდე.','Create or refine a plan, then review it before saving.')}</p></div></div><button onClick={newPrescription}>{t('ახალი დანიშნულება', 'New prescription')}</button><label>{t('სათაური', 'Title')}<input aria-label="Prescription title" value={title} onChange={e => { setTitle(e.target.value); manualChange(); }}/></label><div className="clinical-pair"><label>{t('სიმძიმის დონე', 'Severity level')}<select value={severity} onChange={e => { setSeverity(e.target.value); manualChange(); }}>{['Mild', 'Moderate', 'Severe', 'Critical'].map(value => <option key={value} value={value}>{ka?({Mild:'მსუბუქი',Moderate:'საშუალო',Severe:'მძიმე',Critical:'კრიტიკული'}[value]||value):value}</option>)}</select></label><label>{t('სამიზნე სექტორი', 'Target sector')}<input aria-label="Target sector" value={sector} onChange={e => { setSector(e.target.value); manualChange(); }}/></label></div><details><summary>{t('AI-ის მიერ გენერირებული გეგმა', 'AI-generated plan')}</summary><p>{t('შექმნილი გეგმა სპეციალისტმა უნდა გადაამოწმოს.', 'A specialist must review the generated plan.')}</p><button disabled={busy} onClick={generatePlan}>{t('გეგმის გენერირება / შევსება AI-ით', 'Generate / supplement plan with AI')}</button></details><details open={editor} onToggle={e => setEditor(e.currentTarget.open)}><summary>{t('გეგმის შექმნა / კომბინირებული რედაქტირება', 'Create plan / combined editing')}</summary>{(['treatment', 'dosage', 'nutrition', 'prevention'] as const).map((key, index) => <label key={key}>{[t('მკურნალობა / შეტანა', 'Treatment / application'), t('დოზირება', 'Dosage'), t('კვება', 'Nutrition'), t('პრევენცია / მონიტორინგი', 'Prevention / monitoring')][index]}<textarea aria-label={'Plan ' + key} value={plan[key]} onChange={e => { setPlan(previous => ({ ...previous, [key]: e.target.value })); manualChange(); }}/></label>)}<h4>{t('გეგმის მასალები', 'Plan materials')}</h4><input aria-label="Material name" placeholder={t('მასალა', 'Material')} value={material} onChange={e => setMaterial(e.target.value)}/><div className="clinical-pair"><input aria-label="Material quantity" type="number" min="0" step="any" placeholder={t('რაოდენობა', 'Quantity')} value={quantity} onChange={e => setQuantity(e.target.value)}/><input aria-label="Material unit" value={unit} onChange={e => setUnit(e.target.value)}/></div><button disabled={!material.trim() || !(Number(quantity) > 0) || !unit.trim()} onClick={() => { setPlan(previous => ({ ...previous, elements: [...previous.elements, { inventoryItemId: '', newItemName: material.trim(), quantity: Number(quantity), unit: unit.trim() }] })); manualChange(); setMaterial(''); setQuantity(''); }}>{t('მასალის დამატება', 'Add material')}</button>{plan.elements.map((element, index) => <p key={index}>{element.newItemName} · {element.quantity} {element.unit}<button onClick={() => { setPlan(previous => ({ ...previous, elements: previous.elements.filter((_, i) => i !== index) })); manualChange(); }}>{t('ამოღება', 'Remove')}</button></p>)}</details><label>{t('დასკვნა ან კომენტარი', 'Conclusion or comment')}<textarea aria-label="Conclusion or comment" value={comment} onChange={e => { setComment(e.target.value); manualChange(); }}/></label><p className="clinical-category" data-category={origin}>{categoryText(origin)}</p><div className="clinical-actions"><button disabled={busy} className="clinical-save" onClick={() => save()}>{t('შენახვა', 'Save')}</button>{onAddNutritionPlan && <button disabled={busy} className="clinical-dispatch" onClick={() => save(true)}>{t('შენახვა და აგრონომიაში დამატება', 'Save & add to Agronomy')}</button>}<button onClick={() => { setTab('history'); setSelected(null); setResult(null); setTitle(''); setPlan(emptyPlan()); setComment(''); }}>{t('არქივი', 'Archive')}</button></div></div></div>{message && <p role="status" className="clinical-message">{message}</p>}</section>;
};
export default AiAnalysisSuite;

import React, { useEffect, useState } from 'react';
import { runTransaction } from 'firebase/firestore';
import { isLocalRuntime } from '../local/runtime';
import { Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import { db, collection, onSnapshot, query, where, setDoc, doc, writeBatch } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';
export function companyCrops(company: any, crops: any[] = []) { return [...new Set([...(company.crops || company.plantationCrops || []).map((c: any) => typeof c === 'string' ? c : c.name || c.culture), ...crops.filter(c => c.organizationId === company.id).map(c => c.name)].filter(Boolean))].join(', '); }
export function companyPosition(company: any): [
    number,
    number
] | null {
    const point = company.location || company.coordinates;
    if (Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180)
        return point as [
            number,
            number
        ];
    const boundary = company.areaGeometry;
    if (Array.isArray(boundary) && boundary.length && Array.isArray(boundary[0]) && boundary[0].length === 2 && boundary[0].every(Number.isFinite)) {
        const [lat, lng] = boundary[0];
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
            return [lat, lng];
    }
    const geometry = company.areaGeometry;
    const ring = geometry?.coordinates?.[0];
    if (Array.isArray(ring) && ring.length && ring[0]?.length === 2) {
        const [lng, lat] = ring[0];
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
            return [lat, lng];
    }
    return null;
}
const icon = L.divIcon({ className: 'company-checkpoint', html: '<span style="display:block;width:24px;height:24px;background:#047857;color:white;border:2px solid white;border-radius:50%;text-align:center;box-shadow:0 1px 5px #64748b">⌂</span>', iconSize: [24, 24], iconAnchor: [12, 12] });
export function CompanyCheckpoints({ companies, crops, onDetails }: {
    companies: any[];
    crops: any[];
    onDetails: (company: any) => void;
}) { const { language } = useLanguage(); return <>{companies.map(company => { const point = companyPosition(company); return point ? <Marker key={company.id} position={point} icon={icon}><Tooltip>{company.name} · {companyCrops(company, crops) || '—'}</Tooltip><Popup><b>{company.name}</b><p>{companyCrops(company, crops)}</p><button onClick={() => onDetails(company)}>{language === 'ka' ? 'მეტი ინფორმაცია' : 'More details'}</button></Popup></Marker> : null; })}</>; }
export function useJobAnnouncements() { const [jobs, setJobs] = useState<any[]>([]), [error, setError] = useState(''); useEffect(() => onSnapshot(query(collection(db, 'jobAnnouncements'), where('status', '==', 'published')), snapshot => { setJobs(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))); setError(''); }, () => setError('Announcements could not be loaded. Check access rules.')), []); return { jobs, error }; }
export function CompanyDetails({ company, crops, jobs, onClose, onMessage }: {
    company: any;
    crops: any[];
    jobs: any[];
    onClose: () => void;
    onMessage: () => void;
}) { const { language } = useLanguage(), ka = language === 'ka'; return <div className="fixed inset-0 bg-slate-900/50 z-[12000] p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Company details"><section className="bg-white rounded-2xl p-5 max-w-xl w-full max-h-[85dvh] overflow-auto space-y-3"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{company.name}</h2><button onClick={onClose} aria-label="Close company details">✕</button></div><p>{company.region} · {company.country}</p><p>{ka ? 'ფართობი' : 'Area'}: {company.areaHa ?? company.area ?? '—'} ha</p><p>{ka ? 'კულტურები' : 'Crops'}: {companyCrops(company, crops) || '—'}</p><p>{ka ? 'ჯიშები' : 'Varieties'}: {[...(company.varieties || []).map((v: any) => typeof v === 'string' ? v : v.name), ...crops.filter(c => c.organizationId === company.id).flatMap(c => (c.varieties || []).map((v: any) => typeof v === 'string' ? v : v.name)), ...(company.crops || []).flatMap((c: any) => typeof c === 'string' ? [] : (c.varieties || []).map((v: any) => typeof v === 'string' ? v : v.name))].filter(Boolean).join(', ') || '—'}</p><p>{company.description || company.publicData?.description}</p><h3 className="font-semibold">{ka ? 'ვაკანსიები' : 'Job announcements'}</h3>{jobs.filter(job => job.organizationId === company.id).map(job => <article key={job.id} className="border rounded-xl p-3"><b>{job.title}</b><p>{job.employmentType} · {job.region}</p><p>{job.description}</p><small>{job.createdAt}</small></article>)}{!jobs.some(job => job.organizationId === company.id) && <p>{ka ? 'გამოქვეყნებული ვაკანსია არ არის.' : 'No published vacancies.'}</p>}<button className="border rounded-lg p-3" onClick={onMessage}>{ka ? 'კომპანიასთან დაკავშირება' : 'Contact company'}</button></section></div>; }
export function Announcements({ jobs, error, user, organization, canManage, onMessage, filterRegion = '' }: {
    filterRegion?: string;
    jobs: any[];
    error: string;
    user: any;
    organization: any;
    canManage: boolean;
    onMessage: (company: any) => void;
}) {
    const { language } = useLanguage(), ka = language === 'ka';
    const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [type, setType] = useState('Seasonal'), [region, setRegion] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [requests, setRequests] = useState<any[]>([]);
    useEffect(() => { if (!canManage || !organization)
        return; return onSnapshot(query(collection(db, 'joinRequests'), where('organizationId', '==', organization.id)), snapshot => setRequests(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))), () => { }); }, [canManage, organization?.id]);
    return <section className="p-4 overflow-y-auto space-y-4"><h2 className="text-lg font-semibold">{ka ? 'განცხადებები' : 'Announcements'}</h2>{error && <p role="alert">{error}</p>}{canManage && organization && <form className="border rounded-xl p-4 space-y-3" onSubmit={async (event) => { event.preventDefault(); setBusy(true); try {
        const id = crypto.randomUUID();
        await setDoc(doc(db, 'jobAnnouncements', id), { organizationId: organization.id, companyName: organization.name, authorId: user.id, title: title.trim(), description: description.trim(), employmentType: type, region: region.trim() || organization.region || '', createdAt: new Date().toISOString(), status: 'published' });
        setTitle('');
        setDescription('');
        setMessage(ka ? 'განცხადება გამოქვეყნდა' : 'Announcement published');
    }
    catch {
        setMessage(ka ? 'გამოქვეყნება ვერ მოხერხდა' : 'Could not publish announcement');
    }
    finally {
        setBusy(false);
    } }}><h3>{ka ? 'ვაკანსიის გამოქვეყნება' : 'Post a job'}</h3><input aria-label="Job title" placeholder={ka ? 'სამუშაო / საჭირო სპეციალისტი' : 'Job / worker needed'} className="border rounded p-3 w-full" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)}/><select aria-label="Employment type" value={type} onChange={e => setType(e.target.value)}>{['Daily', 'Permanent', 'Seasonal', 'Contract'].map(value => <option key={value}>{value}</option>)}</select><input aria-label="Job region" placeholder={ka ? 'რეგიონი' : 'Region'} value={region} onChange={e => setRegion(e.target.value)} className="border rounded p-3 w-full"/><textarea aria-label="Job description" placeholder={ka ? 'საქმიანობა, თარიღები, პირობები და ანაზღაურება' : 'Work, dates, conditions and pay'} className="border rounded p-3 w-full" required maxLength={4000} value={description} onChange={e => setDescription(e.target.value)}/><button disabled={busy} className="bg-emerald-700 text-white rounded p-3">{ka ? 'გამოქვეყნება' : 'Publish announcement'}</button></form>}
 {jobs.filter(job => !filterRegion || String(job.region).toLowerCase().includes(filterRegion.toLowerCase())).map(job => <article className="border rounded-xl p-4 bg-white" key={job.id}><h3 className="font-semibold">{job.title}</h3><p>{job.companyName} · {job.region} · {job.employmentType}</p><p>{job.description}</p><small>{job.createdAt}</small><button className="block underline p-2" onClick={() => onMessage({ id: job.organizationId, name: job.companyName })}>{ka ? 'დაკავშირება' : 'Contact / apply'}</button>{canManage && job.organizationId === organization?.id && <button className="underline" onClick={async () => { try {
        await setDoc(doc(db, 'jobAnnouncements', job.id), { ...job, status: 'closed' }, { merge: true });
    }
    catch {
        setMessage('Could not close announcement');
    } }}>{ka ? 'ვაკანსიის დახურვა' : 'Close vacancy'}</button>}</article>)}
 {canManage && requests.filter(request => request.status === 'pending').map(request => <article className="border rounded p-3" key={request.id}><b>{request.userName}</b><p>{ka ? 'კომპანიაში გაწევრიანების მოთხოვნა' : 'Company join request'}</p><button className="underline p-2" onClick={async () => { try {
        if (isLocalRuntime)
            throw Error('Use local account management');
        const employeeId = request.id;
        await runTransaction(db, async (transaction) => { const memberRef = doc(db, 'memberships', `${request.userId}_${organization.id}`), requestRef = doc(db, 'joinRequests', request.id), employeeRef = doc(db, 'employees', employeeId); const current = await transaction.get(memberRef), pending = await transaction.get(requestRef), employee = await transaction.get(employeeRef); if (current.exists())
            throw Error('Membership already exists; use company account controls'); if (!pending.exists() || (pending.data() as any).status !== 'pending')
            throw Error('Request already reviewed'); if (employee.exists() && (employee.data() as any).userId !== request.userId)
            throw Error('Employee identity mismatch'); transaction.set(memberRef, { userId: request.userId, organizationId: organization.id, role: 'Employee', status: 'active', employeeId }); transaction.set(employeeRef, { organizationId: organization.id, userId: request.userId, name: request.userName, status: 'active' }, { merge: true }); transaction.set(requestRef, { status: 'approved', reviewedAt: new Date().toISOString() }, { merge: true }); });
    }
    catch {
        setMessage('Could not approve request');
    } }}>{ka ? 'დადასტურება' : 'Approve membership'}</button><button className="underline p-2" onClick={() => setDoc(doc(db, 'joinRequests', request.id), { status: 'declined', reviewedAt: new Date().toISOString() }, { merge: true }).catch(() => setMessage('Could not decline request'))}>{ka ? 'უარყოფა' : 'Decline'}</button></article>)}{message && <p role="status">{message}</p>}</section>;
}

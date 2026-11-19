export type DiscoveryKind = 'ALL' | 'HIRING' | 'OFFERS' | 'PLANTATIONS';
export type DiscoveryFilters = {
    search: string;
    kind: DiscoveryKind;
    region: string;
    work: string;
    contract: string;
    crop: string;
};
export const emptyDiscoveryFilters = (): DiscoveryFilters => ({ search: '', kind: 'ALL', region: '', work: '', contract: '', crop: '' });
export type DiscoveryItem = {
    id: string;
    kind: Exclude<DiscoveryKind, 'ALL'>;
    name: string;
    title: string;
    region: string;
    regions: string[];
    work: string[];
    contract: string;
    crop: string[];
    varieties: string[];
    description: string;
    company: any;
    job?: any;
    profile?: any;
    position: [
        number,
        number
    ] | null;
    createdAt?: string;
};
const strings = (items: any) => Array.isArray(items) ? items.map(value => typeof value === 'string' ? value : value?.name || value?.crop || '').filter(Boolean) : [];
export function publicPosition(source: any): [
    number,
    number
] | null { const point = source?.location || source?.coordinates; let boundary = source?.areaGeometry; if (typeof boundary === 'string') {
    try {
        boundary = JSON.parse(boundary);
    }
    catch {
        boundary = null;
    }
} const p = point || (Array.isArray(boundary) ? boundary[0] : boundary?.coordinates?.[0]?.[0]?.slice().reverse()); return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 ? [p[0], p[1]] : null; }
export function discoveryItems(companies: any[], jobs: any[], profiles: any[], crops: any[] = []): DiscoveryItem[] {
    const rows: DiscoveryItem[] = [];
    for (const company of companies) {
        const ownCrops = crops.filter(crop => crop.organizationId === company.id);
        rows.push({ id: 'plantation:' + company.id, kind: 'PLANTATIONS', name: company.name || '', title: company.name || '', region: company.region || '', regions: [company.region].filter(Boolean), work: [], contract: '', crop: [...new Set([...strings(company.crops || company.plantationCrops), ...strings(ownCrops)])], varieties: [...new Set([...strings(company.varieties), ...ownCrops.flatMap(crop => strings(crop.varieties)), ...(company.crops || []).flatMap((crop: any) => strings(crop.varieties))])], description: company.description || company.publicData?.description || '', company, position: publicPosition(company) });
    }
    for (const job of jobs.filter(job => job.status === 'published')) {
        const plantation = rows.find(row => row.kind === 'PLANTATIONS' && row.company.id === job.organizationId), company = plantation?.company || { id: job.organizationId, name: job.companyName, type: 'Company', region: job.region };
        rows.push({ id: 'hiring:' + job.id, kind: 'HIRING', name: job.companyName || company.name || '', title: job.title || '', region: job.region || company.region || '', regions: [job.region || company.region].filter(Boolean), work: [job.workType || job.title].filter(Boolean), contract: job.employmentType || '', crop: strings(job.crops).length ? strings(job.crops) : plantation?.crop || [], varieties: strings(job.varieties).length ? strings(job.varieties) : plantation?.varieties || [], description: job.description || '', company, job, position: publicPosition(job) || plantation?.position || null, createdAt: job.createdAt });
    }
    for (const profile of profiles.filter(profile => (profile.isDiscoverable || profile.isProfileDiscoverable || profile.isPubliclyVisible) && profile.servicesOffered?.length)) {
        const regions = strings(profile.workingRegions || profile.cv?.preferredRegions);
        rows.push({ id: 'offer:' + profile.id, kind: 'OFFERS', name: profile.name || '', title: strings(profile.servicesOffered).join(', '), region: profile.region || regions.join(', '), regions: [...new Set([profile.region, ...regions].filter(Boolean))], work: strings(profile.servicesOffered), contract: '', crop: [], varieties: [], description: profile.description || profile.publicData?.description || '', company: null, profile, position: publicPosition(profile) });
    }
    return rows;
}
export function filterDiscovery(items: DiscoveryItem[], filter: DiscoveryFilters) { const normalize = (value: any) => String(value || '').trim().toLocaleLowerCase(); const includes = (haystack: any, needle: string) => !needle || normalize(haystack).includes(normalize(needle)); return items.filter(item => (filter.kind === 'ALL' || item.kind === filter.kind) && includes([item.name, item.title, item.region, ...item.work, ...item.crop, ...item.varieties, item.description].join(' '), filter.search) && includes(item.regions.join(' '), filter.region) && includes(item.work.join(' '), filter.work) && includes(item.contract, filter.contract) && includes(item.crop.join(' '), filter.crop)); }

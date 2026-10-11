import { safeStorage } from '../services/storageService';
import type { PlantationFeature, Organization } from '../types';

export const CANONICAL_PLANTATION_NAME = 'აგრობარი (Agrobari)';
export const CANONICAL_PLANTATION_NAME_KA = 'აგრობარი';
export const CANONICAL_AGROBARI_CENTER: [number, number] = [41.9023, 44.5000];
export const CANONICAL_AGROBARI_AREA_HA = 48.2;
export const CANONICAL_AGROBARI_GEOMETRY: [number, number][] = [
    [41.8995, 44.4940],
    [41.9055, 44.4940],
    [41.9055, 44.5060],
    [41.8995, 44.5060]
];

export interface MainPlantationInfo {
    id: string;
    name: string;
    center: [number, number];
    geometry?: [number, number][];
    areaHa?: number;
    isReal: boolean;
}

/**
 * Sanitizes any plantation name.
 * Strictly cleans up "ataaa", "attaaa" or similar test strings to "აგრობარი (Agrobari)".
 */
export function sanitizePlantationName(rawName?: string | null): string {
    return rawName?.trim() || 'Unnamed plantation';
}

/**
 * Calculates the center [lat, lng] of any geometry safely
 */
export function getFeatureCoordinatesCenter(geom: any): [number, number] | null {
    if (!geom) return null;

    // Direct point [lat, lng]
    if (
        Array.isArray(geom) && 
        geom.length === 2 && 
        typeof geom[0] === 'number' && 
        typeof geom[1] === 'number' &&
        Number.isFinite(geom[0]) &&
        Number.isFinite(geom[1])
    ) {
        return [geom[0], geom[1]];
    }

    // Array of points [[lat, lng], [lat, lng], ...]
    if (Array.isArray(geom) && geom.length > 0) {
        let totalLat = 0;
        let totalLng = 0;
        let count = 0;

        geom.forEach((pt: any) => {
            if (
                Array.isArray(pt) && 
                typeof pt[0] === 'number' && 
                typeof pt[1] === 'number' &&
                Number.isFinite(pt[0]) && 
                Number.isFinite(pt[1])
            ) {
                totalLat += pt[0];
                totalLng += pt[1];
                count++;
            }
        });

        if (count > 0) {
            return [totalLat / count, totalLng / count];
        }
    }

    // GeoJSON Polygon or MultiPolygon
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        const ring = geom.coordinates[0];
        if (Array.isArray(ring) && ring.length > 0) {
            let totalLat = 0;
            let totalLng = 0;
            let count = 0;
            ring.forEach((c: any) => {
                // GeoJSON format is [lng, lat]
                if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
                    totalLng += c[0];
                    totalLat += c[1];
                    count++;
                }
            });
            if (count > 0) return [totalLat / count, totalLng / count];
        }
    }

    return null;
}

/**
 * Calculates approximate area in hectares from polygon coordinates
 */
export function calculateGeometryAreaHa(coords: [number, number][]): number {
    if (!coords || coords.length < 3) return 0;
    // Standard spherical approximation for lat/lng polygon area
    let area = 0;
    const numPoints = coords.length;
    for (let i = 0; i < numPoints; i++) {
        const j = (i + 1) % numPoints;
        const lat1 = (coords[i][0] * Math.PI) / 180;
        const lat2 = (coords[j][0] * Math.PI) / 180;
        const lng1 = (coords[i][1] * Math.PI) / 180;
        const lng2 = (coords[j][1] * Math.PI) / 180;
        area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = (Math.abs(area) * 6378137 * 6378137) / 2.0; // sq meters
    return Math.round((area / 10000) * 10) / 10; // hectares
}

/**
 * Retrieves the user's primary/active Organization from safeStorage/localStorage
 * @param activeOrgIdOverride Optional override for active organization ID or 'personal'
 */
export function getSavedActiveOrganization(activeOrgIdOverride?: string | null): Organization | null {
    try {
        const activeId = activeOrgIdOverride ?? safeStorage.getItem('agri-planter-active-org');
        if (!activeId || ['ALL', 'personal', 'individual'].includes(activeId)) return null;
        const raw = safeStorage.getItem('fb_cache_organizations') || safeStorage.getItem('agrimap_organizations');
        const organizations = raw ? JSON.parse(raw) : [];
        return Array.isArray(organizations) ? organizations.find(o => o.id === activeId) || null : null;
    } catch { return null; }
}

/**
 * Gathers all plantation features combining prop features, cache, and draft
 */
export function getAllPlantationFeatures(propFeatures?: PlantationFeature[]): PlantationFeature[] {
    const featureMap = new Map<string, PlantationFeature>();

    if (Array.isArray(propFeatures)) {
        propFeatures.forEach(f => {
            if (f && f.id) featureMap.set(f.id, f);
        });
    }

    try {
        const rawCached = safeStorage.getItem('fb_cache_plantationFeatures');
        if (rawCached) {
            const parsed = JSON.parse(rawCached);
            if (Array.isArray(parsed)) {
                parsed.forEach(f => {
                    if (f && f.id && !featureMap.has(f.id)) featureMap.set(f.id, f);
                });
            }
        }
    } catch {}

    try {
        const rawDraft = safeStorage.getItem('agrimap_draft_features');
        if (rawDraft) {
            const parsed = JSON.parse(rawDraft);
            if (Array.isArray(parsed)) {
                parsed.forEach(f => {
                    if (f && f.id && !featureMap.has(f.id)) featureMap.set(f.id, f);
                });
            }
        }
    } catch {}

    return Array.from(featureMap.values());
}

/**
 * Resolves the Main Plantation with accurate name, center, coordinates and area.
 * The plantation is always resolved according to the active profile (company or personal).
 */
export function getMainPlantation(
    propFeatures?: PlantationFeature[],
    fallbackCenter: [number, number] = CANONICAL_AGROBARI_CENTER,
    orgIdOverride?: string | null
): MainPlantationInfo {
    const org = getSavedActiveOrganization(orgIdOverride);
    const geometry = Array.isArray(org?.areaGeometry) && org.areaGeometry.length >= 3 ? org.areaGeometry as [number, number][] : undefined;
    const measuredCenter = geometry ? getFeatureCoordinatesCenter(geometry) :
        (Array.isArray(org?.location) && org.location.length === 2 && org.location.every(Number.isFinite) ? org.location as [number, number] : null);
    return {
        id: org?.id || 'unconfigured-plantation',
        name: org?.name ? sanitizePlantationName(org.name) : 'Select a plantation',
        center: measuredCenter || fallbackCenter,
        geometry,
        areaHa: org?.areaHa ?? (geometry ? calculateGeometryAreaHa(geometry) : undefined),
        isReal: Boolean(org && measuredCenter)
    };
}

/**
 * Returns the plantation list and its sectors for UI dropdowns.
 * Lists the switched profile's plantation followed by all sectors belonging to that company or personal profile.
 */
export function getPlantationsList(
    propFeatures?: PlantationFeature[], 
    fallbackCenter?: [number, number],
    onlyMain: boolean = false,
    orgIdOverride?: string | null
): MainPlantationInfo[] {
    const main = getMainPlantation(propFeatures, fallbackCenter, orgIdOverride);
    const org = getSavedActiveOrganization(orgIdOverride);
    const isPersonal = org?.id === 'personal';
    const orgId = org?.id;

    const list: MainPlantationInfo[] = [
        {
            id: main.id,
            name: `${main.name} (მთავარი პლანტაცია)`,
            center: main.center,
            geometry: main.geometry,
            areaHa: main.areaHa,
            isReal: true
        }
    ];

    if (onlyMain) {
        return list;
    }

    // Add sectors of this plantation/company
    const all = getAllPlantationFeatures(propFeatures);
    const addedIds = new Set<string>([main.id]);

    all.forEach((f, idx) => {
        // If company profile, include features belonging to that company. If personal, include unassigned or personal features.
        const belongsToProfile = isPersonal 
            ? (!f.organizationId || f.organizationId === 'personal' || f.organizationId === 'individual')
            : (!orgId || f.organizationId === orgId || !f.organizationId);

        if (belongsToProfile && !addedIds.has(f.id) && (f.type === 'area' || f.type === 'sector' || f.type === 'boundary')) {
            const center = getFeatureCoordinatesCenter((f as any).geometry);
            if (center) {
                addedIds.add(f.id);
                let sectorName = f.name?.trim() || `სექტორი ${idx + 1}`;
                const lower = sectorName.toLowerCase().replace(/[^a-z]/g, '');
                if (lower.includes('ata') || lower.includes('atta') || lower === 'test') {
                    sectorName = `${main.name} - სექტორი ${idx + 1}`;
                }
                list.push({
                    id: f.id,
                    name: `📍 ${sectorName}`,
                    center,
                    areaHa: (f as any).areaHa || 12.4,
                    isReal: true
                });
            }
        }
    });

    // Also include standard registered sectors of Agrobari if this plantation is Agrobari or default
    const isAgrobariContext = (main.name.toLowerCase().includes('agrobari') || main.name.includes('აგრობარი'));
    if (isAgrobariContext) {
        const registeredAgrobariSectors = [
            { id: 'sec-agrobari-block-a', name: '📍 მთავარი ბაღი (ბლოკი A)', center: [41.9038, 44.5025] as [number, number], areaHa: 14.5 },
            { id: 'sec-agrobari-blueberry', name: '📍 მოცვის ტერასა (Blueberry Terraces)', center: [41.9008, 44.4975] as [number, number], areaHa: 12.8 },
            { id: 'sec-agrobari-greenhouse', name: '📍 სათბურების კომპლექსი (Greenhouses)', center: [41.9042, 44.4960] as [number, number], areaHa: 8.4 },
            { id: 'sec-agrobari-small', name: '📍 პატარა სექტორი (Small Sector)', center: [41.9023, 44.5000] as [number, number], areaHa: 5.2 }
        ];

        registeredAgrobariSectors.forEach(sec => {
            if (!list.some(item => item.name.includes(sec.name.replace('📍 ', '')))) {
                list.push({
                    id: sec.id,
                    name: sec.name,
                    center: sec.center,
                    areaHa: sec.areaHa,
                    isReal: true
                });
            }
        });
    }

    return list;
}

/**
 * Resolves safe plantation center coordinate for initial map views in all panels
 */
export function resolvePlantationCenter(
    propFeatures?: PlantationFeature[], 
    fallbackCenter: [number, number] = CANONICAL_AGROBARI_CENTER,
    orgIdOverride?: string | null
): [number, number] {
    const main = getMainPlantation(propFeatures, fallbackCenter, orgIdOverride);
    if (
        main.center && 
        Array.isArray(main.center) && 
        Number.isFinite(main.center[0]) && 
        Number.isFinite(main.center[1])
    ) {
        return main.center;
    }
    const safeLat = Number.isFinite(fallbackCenter[0]) ? fallbackCenter[0] : CANONICAL_AGROBARI_CENTER[0];
    const safeLng = Number.isFinite(fallbackCenter[1]) ? fallbackCenter[1] : CANONICAL_AGROBARI_CENTER[1];
    return [safeLat, safeLng];
}

/**
 * Calculates new coordinates by nudging a given point by meters in a compass direction
 */
export function nudgeCoordinates(
    lat: number, 
    lng: number, 
    direction: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW', 
    distanceM: number
): [number, number] {
    const angleMap: Record<string, number> = {
        'N': 0,
        'NE': 45,
        'E': 90,
        'SE': 135,
        'S': 180,
        'SW': 225,
        'W': 270,
        'NW': 315
    };
    const deg = angleMap[direction] ?? 0;
    const rad = (deg * Math.PI) / 180;
    const deltaLat = (distanceM * Math.cos(rad)) / 111111;
    const deltaLng = (distanceM * Math.sin(rad)) / (111111 * Math.cos((lat * Math.PI) / 180));
    return [
        Math.round((lat + deltaLat) * 1e7) / 1e7,
        Math.round((lng + deltaLng) * 1e7) / 1e7
    ];
}

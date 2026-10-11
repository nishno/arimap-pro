import * as turf from '@turf/turf';
import { safeStorage } from './storageService';
import { isValidCoordinate, SeedlingPlantationFeature } from '../types';

/**
 * Calculates the area of a spherical polygon in square meters.
 * @param coords Array of [lat, lng] coordinates.
 */
export const getSphericalPolygonArea = (coords: [number, number][]): number => {
    if (!coords || coords.length < 3) return 0;
    try {
        // Ensure the polygon is closed for Turf
        const closedCoords = [...coords];
        if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] || 
            closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
            closedCoords.push(closedCoords[0]);
        }
        // Turf expects [lng, lat]
        const polygon = turf.polygon([closedCoords.map(c => [c[1], c[0]])]);
        return turf.area(polygon);
    } catch (e) {
        console.error("Area calculation failed", e);
        return 0;
    }
};

/**
 * Calculates the length of a line in meters.
 */
export const calculateLineLength = (coords: [number, number][]): number => {
    if (!coords || coords.length < 2) return 0;
    try {
        // Sanitize coordinates to prevent NaN
        const cleanCoords = coords.filter(c => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]));
        if (cleanCoords.length < 2) return 0;
        
        const line = turf.lineString(cleanCoords.map(c => [c[1], c[0]]));
        const len = turf.length(line, { units: 'meters' });
        return Number.isFinite(len) ? len : 0;
    } catch (e) {
        console.error("Length calculation failed", e);
        return 0;
    }
};

/**
 * Calculates stock deduction for a plan element.
 */
export const calculateStockDeduction = (element: any, item: any, totalAreaHa: number, waterUsedTons: number): number => {
    const quantity = element.actualQuantity || element.quantity;
    const unit = (element.unit || item.unitOfMeasure || '').toLowerCase();
    
    if (!Number.isFinite(quantity)) return 0;

    let totalConsumption = 0;

    if (unit.includes('/ha')) {
        totalConsumption = quantity * (Number.isFinite(totalAreaHa) ? totalAreaHa : 0);
    } else if (unit.includes('/ton') || unit.includes('/m3')) {
        totalConsumption = quantity * (Number.isFinite(waterUsedTons) ? waterUsedTons : 0);
    } else {
        totalConsumption = quantity;
    }

    // Normalize Total to Standard Units (kg / L / unit)
    const lowerUnit = unit.split('/')[0].toLowerCase();
    let consumptionInBase = totalConsumption;
    if (lowerUnit === 'g' || lowerUnit === 'ml') consumptionInBase /= 1000;
    else if (lowerUnit === 'mg') consumptionInBase /= 1000000;

    // Check if we are deducting from "Packages" (bags/boxes/etc)
    const stockUnit = (item.unitOfMeasure || 'unit').toLowerCase();
    const isContainer = ['bag', 'box', 'sack', 'bottle', 'can', 'drum', 'pallet', 'unit', 'pcs'].includes(stockUnit);

    if (isContainer && item.packageContent && item.packageContent > 0) {
        let contentSize = item.packageContent;
        const contentUnit = (item.packageContentUnit || 'kg').toLowerCase();
        if (contentUnit === 'g' || contentUnit === 'ml') contentSize /= 1000;
        else if (contentUnit === 'mg') contentSize /= 1000000;
        
        return consumptionInBase / contentSize;
    } 

    return consumptionInBase;
};

/**
 * Gets the center point of a group of features.
 */
export const getFeatureGroupCenter = (features: any[]): [number, number] => {
    if (!features || features.length === 0) return [0, 0];
    try {
        const points = features.flatMap(f => {
            if (!f.geometry) return [];
            if (Array.isArray(f.geometry[0])) {
                return f.geometry
                    .filter((p: any) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
                    .map((p: any) => turf.point([p[1], p[0]]));
            }
            if (Array.isArray(f.geometry) && f.geometry.length === 2 && Number.isFinite(f.geometry[0]) && Number.isFinite(f.geometry[1])) {
                return [turf.point([f.geometry[1], f.geometry[0]])];
            }
            return [];
        });
        if (points.length === 0) return [0, 0];
        const collection = turf.featureCollection(points);
        const center = turf.center(collection);
        const coords = center.geometry.coordinates;
        return [coords[1], coords[0]];
    } catch (e) {
        return [0, 0];
    }
};

/**
 * Generates parallel trench lines within a polygon.
 */
export const generateTrenches = (polygonCoords: [number, number][], spacingMeters: number, angleDegrees: number): [number, number][][] => {
    if (!polygonCoords || polygonCoords.length < 3) return [];
    
    try {
        const spacing = typeof spacingMeters === 'string' ? parseFloat(spacingMeters) : spacingMeters;
        let angle = typeof angleDegrees === 'string' ? parseFloat(angleDegrees) : angleDegrees;
        
        if (!spacing || spacing <= 0 || !Number.isFinite(spacing)) return [];
        if (!Number.isFinite(angle)) angle = 0;

        // Ensure the polygon is closed
        const closedCoords = [...polygonCoords];
        if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] || 
            closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
            closedCoords.push(closedCoords[0]);
        }
        
        // Turf expects [lng, lat]
        const poly = turf.polygon([closedCoords.map(c => [c[1], c[0]])]);
        
        // Find a safe center for rotation
        const center = turf.center(poly);
        const pivot = center.geometry.coordinates;
        
        // Rotate the polygon by -angle to align trenches with the X-axis
        const rotatedPoly = turf.transformRotate(poly, -angle, { pivot });
        const bbox = turf.bbox(rotatedPoly);
        
        const trenches: [number, number][][] = [];
        
        // Accurate degree conversion at this latitude
        // 1 deg lat = 111320m
        // 1 deg lng = 111320m * cos(lat)
        const latRef = pivot[1];
        const latSpacingDeg = spacing / 111320;
        const lngSpacingDeg = spacing / (111320 * Math.cos(latRef * Math.PI / 180));
        
        // Since we rotated the polygon, we'll use a uniform degree spacing based on latitude
        // that covers the rotated bounding box.
        const useSpacing = latSpacingDeg;
        
        const startY = bbox[1];
        const endY = bbox[3];
        
        // Add a small buffer to the bbox to ensure we cover everything
        const startX = bbox[0] - 0.01;
        const endX = bbox[2] + 0.01;

        let iterations = 0;
        const maxIterations = 2000; // Increased safety margin

        // Use a slightly larger grid to ensure full coverage of the rotated bounding box
        for (let y = startY + (useSpacing / 2); y < endY; y += useSpacing) {
            iterations++;
            if (iterations > maxIterations) break;

            const horizontalLine = turf.lineString([
                [startX - 0.1, y], 
                [endX + 0.1, y]
            ]);
            
            try {
                const intersected = turf.lineIntersect(horizontalLine, rotatedPoly);
                
                if (intersected && intersected.features && intersected.features.length >= 2) {
                    const points = intersected.features
                        .map(f => f.geometry.coordinates)
                        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
                        .sort((a, b) => a[0] - b[0]);
                    
                    if (points.length < 2) continue;

                    for (let j = 0; j < points.length - 1; j += 1) {
                        const start = points[j];
                        const end = points[j + 1];
                        
                        // Check middle point of candidate segment against original rotated polygon
                        const midPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
                        if (turf.booleanPointInPolygon(turf.point(midPoint), rotatedPoly)) {
                            const segment = turf.lineString([start, end]);
                            const originalSegment = turf.transformRotate(segment, angle, { pivot });
                            const coords = (originalSegment.geometry as any).coordinates;
                            
                            if (coords && Array.isArray(coords) && coords.length === 2 && 
                                Array.isArray(coords[0]) && Array.isArray(coords[1])) {
                                trenches.push([
                                    [coords[0][1], coords[0][0]],
                                    [coords[1][1], coords[1][0]]
                                ]);
                            }
                        }
                    }
                }
            } catch (intersectError) {
                console.warn("Intersection error in trench generation loop", intersectError);
            }
        }
        
        return trenches;
    } catch (e) {
        console.error("Trench generation failed", e);
        return [];
    }
};

/**
 * Generates seedling coordinates along a line.
 */
export const generateSeedlingCoordinates = (lineCoords: [number, number][], spacingMeters: number): [number, number][] => {
    if (!lineCoords || lineCoords.length < 2) return [];
    if (!spacingMeters || spacingMeters <= 0) return [];
    
    try {
        const line = turf.lineString(lineCoords.map(c => [c[1], c[0]]));
        const lengthMeters = turf.length(line, { units: 'meters' });
        const seedlings: [number, number][] = [];
        
        // Safety break
        const maxSeedlings = 5000;
        let count = 0;

        for (let i = 0; i <= lengthMeters; i += spacingMeters) {
            count++;
            if (count > maxSeedlings) break;
            
            const point = turf.along(line, i, { units: 'meters' });
            const coords = point.geometry.coordinates;
            if (Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
                seedlings.push([coords[1], coords[0]]);
            }
        }
        
        return seedlings;
    } catch (e) {
        console.error("Seedling coordinate generation failed", e);
        return [];
    }
};

/**
 * Identifies features (seedlings, lines, etc.) that are within a given polygon.
 */
export const identifyFeaturesInPolygon = (polygonCoords: [number, number][], allFeatures: any[]): any[] => {
    if (!polygonCoords || polygonCoords.length < 3) return [];
    
    try {
        const closedCoords = [...polygonCoords];
        if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] || 
            closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
            closedCoords.push(closedCoords[0]);
        }
        
        const poly = turf.polygon([closedCoords.map(c => [c[1], c[0]])]);
        
        return allFeatures.filter(feature => {
            if (!feature.geometry) return false;
            
            try {
                if (feature.type === 'seedling') {
                    const point = turf.point([feature.geometry[1], feature.geometry[0]]);
                    return turf.booleanPointInPolygon(point, poly);
                } else if (feature.type === 'line') {
                    const line = turf.lineString(feature.geometry.map((c: any) => [c[1], c[0]]));
                    // Check if any part of the line is in the polygon
                    // Or if both endpoints are in (for simplicity, we check if center or intersections)
                    const center = turf.center(line);
                    if (turf.booleanPointInPolygon(center, poly)) return true;
                    
                    // Also check intersection
                    const intersects = turf.lineIntersect(line, poly);
                    return intersects.features.length > 0;
                }
            } catch (err) {
                return false;
            }
            return false;
        });
    } catch (e) {
        console.error("Feature identification failed", e);
        return [];
    }
};

/**
 * Performs a smart audit for a specific sector.
 */
export const calculateSectorAudit = (sectorCoords: [number, number][], seedlings: SeedlingPlantationFeature[]) => {
    if (!sectorCoords || sectorCoords.length < 3) return null;
    
    try {
        const closedCoords = [...sectorCoords];
        if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] || 
            closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
            closedCoords.push(closedCoords[0]);
        }
        
        const poly = turf.polygon([closedCoords.map(c => [c[1], c[0]])]);
        const ha = turf.area(poly) / 10000;
        
        const inSector = seedlings.filter(s => {
            const geom = Array.isArray(s.geometry[0]) ? (s.geometry as any)[0] : s.geometry;
            if (!isLatLngValid(geom)) return false;
            return turf.booleanPointInPolygon(turf.point([geom[1], geom[0]]), poly);
        });
        
        const counts = {
            Good: inSector.filter(s => s.condition === 'Good').length,
            Suspicious: inSector.filter(s => s.condition === 'Suspicious').length,
            Dried: inSector.filter(s => s.condition === 'Dried').length,
            Unknown: inSector.filter(s => !s.condition).length,
        };
        
        const total = inSector.length;
        const healthScore = total > 0 ? (counts.Good / total) * 100 : 0;
        
        return {
            totalPlants: total,
            areaHa: ha,
            densityPerHa: ha > 0 ? total / ha : 0,
            counts,
            healthScore,
            status: healthScore > 90 ? 'Healthy' : healthScore > 70 ? 'Warning' : 'Critical'
        };
    } catch (e) {
        console.error("Sector audit failed", e);
        return null;
    }
};

const isLatLngValid = (p: any): boolean => {
    if (!p || !Array.isArray(p) || p.length !== 2) return false;
    return Number.isFinite(p[0]) && Number.isFinite(p[1]);
};

/**
 * Offsets features by a certain distance.
 */
export const offsetFeatures = (features: any[], distanceMeters: number): any[] => {
    return features.map(f => {
        try {
            if (!f.geometry) return f;
            if (Array.isArray(f.geometry[0])) {
                const line = turf.lineString(f.geometry.map((p: any) => [p[1], p[0]]));
                const offset = turf.lineOffset(line, distanceMeters, { units: 'meters' });
                return {
                    ...f,
                    geometry: offset.geometry.coordinates.map(c => [c[1], c[0]])
                };
            } else {
                const point = turf.point([f.geometry[1], f.geometry[0]]);
                const destination = turf.destination(point, distanceMeters, 90, { units: 'meters' });
                return {
                    ...f,
                    geometry: [destination.geometry.coordinates[1], destination.geometry.coordinates[0]]
                };
            }
        } catch (e) {
            return f;
        }
    });
};

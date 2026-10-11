/**
 * gisWorkerLogic.ts
 * Pure, stateless Turf.js computations. Can be executed in a dedicated Web Worker
 * or as an immediate microtask fallback without affecting React UI thread.
 */

import * as turf from '@turf/turf';
import { PlantationFeature, SeedlingPlantationFeature, AreaPlantationFeature, LinePlantationFeature } from '../../types';
import { EmptyLandAnalysis, PopulatedLandAnalysis } from '../types';

/**
 * Calculates empty land arable potential, azimuth orientation, and trench layout estimations.
 */
export function analyzeEmptyLand(
    coords: [number, number][],
    targetTrenchSpacing = 3.0,
    targetPlantSpacing = 1.0
): EmptyLandAnalysis {
    if (!coords || coords.length < 3) {
        return {
            hasBoundary: false,
            areaSquareMeters: 0,
            areaHectares: 0,
            aspectRatio: 1,
            recommendedAzimuthDegrees: 0,
            dominantDirection: 'N/A',
            estimatedTrenchCount: 0,
            recommendedTrenchSpacingMeters: targetTrenchSpacing,
            recommendedPlantSpacingMeters: targetPlantSpacing,
            estimatedSeedlingCapacity: 0,
            recommendations: ['Boundary contains fewer than 3 vertices. Please define an enclosed field polygon.']
        };
    }

    try {
        const closed = [...coords];
        if (closed[0][0] !== closed[closed.length - 1][0] || closed[0][1] !== closed[closed.length - 1][1]) {
            closed.push(closed[0]);
        }

        // Turf expects [lng, lat]
        const poly = turf.polygon([closed.map(c => [c[1], c[0]])]);
        const areaSqM = turf.area(poly);
        const areaHa = areaSqM / 10000;

        const bbox = turf.bbox(poly); // [minLng, minLat, maxLng, maxLat]
        const widthMeters = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'meters' });
        const heightMeters = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' });

        const aspectRatio = heightMeters > 0 ? Number((widthMeters / heightMeters).toFixed(2)) : 1;

        // Determine dominant azimuth (bearing along longest dimension)
        let azimuth = 0;
        if (heightMeters >= widthMeters) {
            // North-South dominant
            azimuth = 0; // True North
        } else {
            // East-West dominant
            azimuth = 90;
        }

        // Or compute bearing between first two vertices
        if (coords.length >= 2) {
            const b = turf.bearing([coords[0][1], coords[0][0]], [coords[1][1], coords[1][0]]);
            azimuth = Math.round((b + 360) % 180); // Normalized 0-180 orientation
        }

        const dominantDirection = azimuth < 25 || azimuth > 155 ? 'North-South (Optimal for maximum sunlight exposure)' : 'East-West (Optimal for slope drainage alignment)';

        // Estimated trenches across the shorter dimension
        const shorterDim = Math.min(widthMeters, heightMeters);
        const longerDim = Math.max(widthMeters, heightMeters);
        const estimatedTrenchCount = Math.max(1, Math.floor(shorterDim / targetTrenchSpacing));

        // Theoretical total linear meters of trenches
        const totalLinearMeters = estimatedTrenchCount * longerDim * 0.85; // 85% land efficiency factor (headlands/buffer)
        const estimatedSeedlingCapacity = Math.max(0, Math.floor(totalLinearMeters / targetPlantSpacing));

        const recommendations: string[] = [
            `Total arable ground: ${areaHa.toFixed(2)} ha (${Math.round(areaSqM).toLocaleString()} m²).`,
            `Recommended trench orientation: ${azimuth}° (${dominantDirection}).`,
            `With ${targetTrenchSpacing}m row spacing, the plot can accommodate approximately ${estimatedTrenchCount} rows.`,
            `Estimated seedling capacity at ${targetPlantSpacing}m in-row spacing: ~${estimatedSeedlingCapacity.toLocaleString()} plants.`,
            `Design suggestion: Reserve at least 4.5m headland margin on boundary perimeters for tractor turns.`
        ];

        return {
            hasBoundary: true,
            areaSquareMeters: Math.round(areaSqM),
            areaHectares: Number(areaHa.toFixed(2)),
            aspectRatio,
            recommendedAzimuthDegrees: azimuth,
            dominantDirection,
            estimatedTrenchCount,
            recommendedTrenchSpacingMeters: targetTrenchSpacing,
            recommendedPlantSpacingMeters: targetPlantSpacing,
            estimatedSeedlingCapacity,
            recommendations
        };
    } catch (err: any) {
        console.error('[gisWorkerLogic] analyzeEmptyLand failed:', err);
        return {
            hasBoundary: false,
            areaSquareMeters: 0,
            areaHectares: 0,
            aspectRatio: 1,
            recommendedAzimuthDegrees: 0,
            dominantDirection: 'Error',
            estimatedTrenchCount: 0,
            recommendedTrenchSpacingMeters: targetTrenchSpacing,
            recommendedPlantSpacingMeters: targetPlantSpacing,
            estimatedSeedlingCapacity: 0,
            recommendations: [`Failed to compute boundary geometry: ${err?.message || 'Invalid coordinates'}`]
        };
    }
}

/**
 * Analyzes an existing populated plantation containing trenches, lines, and seedlings.
 */
export function analyzePopulatedLand(
    features: PlantationFeature[],
    targetSectorId?: string
): PopulatedLandAnalysis {
    let filteredFeatures = features;
    if (targetSectorId && targetSectorId !== 'ALL') {
        filteredFeatures = features.filter(f => f.id === targetSectorId || f.parentId === targetSectorId);
    }

    // Collect all seedlings
    const seedlings: SeedlingPlantationFeature[] = [];
    const trenches: LinePlantationFeature[] = [];
    const areas: AreaPlantationFeature[] = [];

    filteredFeatures.forEach(f => {
        if (f.type === 'seedling') {
            seedlings.push(f as SeedlingPlantationFeature);
        } else if (f.type === 'line' || f.type === 'trench') {
            const line = f as LinePlantationFeature;
            trenches.push(line);
            if (Array.isArray(line.bundledSeedlings)) {
                seedlings.push(...line.bundledSeedlings);
            }
        } else if (f.type === 'area' || f.type === 'sector') {
            const area = f as AreaPlantationFeature;
            areas.push(area);
            if (Array.isArray(area.bundledLines)) {
                area.bundledLines.forEach(bl => {
                    trenches.push(bl);
                    if (Array.isArray(bl.bundledSeedlings)) {
                        seedlings.push(...bl.bundledSeedlings);
                    }
                });
            }
        }
    });

    // Calculate total area
    let totalAreaSqM = 0;
    areas.forEach(a => {
        if (Array.isArray(a.geometry) && a.geometry.length >= 3) {
            try {
                const closed = [...a.geometry];
                if (closed[0][0] !== closed[closed.length - 1][0] || closed[0][1] !== closed[closed.length - 1][1]) {
                    closed.push(closed[0]);
                }
                const poly = turf.polygon([closed.map(c => [c[1], c[0]])]);
                totalAreaSqM += turf.area(poly);
            } catch {
                // Ignore malformed polygon
            }
        }
    });
    const totalAreaHa = Number((totalAreaSqM / 10000).toFixed(2));

    // Deduplicate seedlings by ID
    const uniqueSeedlingsMap = new Map<string, SeedlingPlantationFeature>();
    seedlings.forEach(s => {
        if (s && s.id) uniqueSeedlingsMap.set(s.id, s);
    });
    const uniqueSeedlings = Array.from(uniqueSeedlingsMap.values());

    const totalSeedlings = uniqueSeedlings.length;
    let good = 0;
    let suspicious = 0;
    let dried = 0;

    const varietyBreakdown: Record<string, { total: number; good: number; suspicious: number; dried: number }> = {};

    uniqueSeedlings.forEach(s => {
        const cond = s.condition || 'Good';
        const variety = (s.cropVariety || 'Standard').trim();

        if (!varietyBreakdown[variety]) {
            varietyBreakdown[variety] = { total: 0, good: 0, suspicious: 0, dried: 0 };
        }
        varietyBreakdown[variety].total++;

        if (cond === 'Dried') {
            dried++;
            varietyBreakdown[variety].dried++;
        } else if (cond === 'Suspicious') {
            suspicious++;
            varietyBreakdown[variety].suspicious++;
        } else {
            good++;
            varietyBreakdown[variety].good++;
        }
    });

    const healthPercentage = totalSeedlings > 0 ? Number(((good / totalSeedlings) * 100).toFixed(1)) : 100;
    const suspiciousPercentage = totalSeedlings > 0 ? Number(((suspicious / totalSeedlings) * 100).toFixed(1)) : 0;
    const driedPercentage = totalSeedlings > 0 ? Number(((dried / totalSeedlings) * 100).toFixed(1)) : 0;
    const densityPerHectare = totalAreaHa > 0 ? Math.round(totalSeedlings / totalAreaHa) : totalSeedlings;

    // Detect infill opportunities (missing seedlings or large gaps along trenches)
    const infillRecommendations: PopulatedLandAnalysis['infillRecommendations'] = [];

    trenches.forEach(t => {
        const lineSeedlings = uniqueSeedlings.filter(s => s.parentId === t.id);
        const driedInLine = lineSeedlings.filter(s => s.condition === 'Dried');
        
        if (driedInLine.length > 0) {
            infillRecommendations.push({
                trenchId: t.id,
                trenchName: t.name || 'Trench',
                suggestedInfillCount: driedInLine.length,
                coordinates: driedInLine.map(d => d.geometry),
                reason: `Replant required: ${driedInLine.length} dried seedling(s) marked for replacement.`
            });
        } else if (lineSeedlings.length > 0 && Array.isArray(t.geometry) && t.geometry.length >= 2) {
            // Check spacing gap
            try {
                const line = turf.lineString(t.geometry.map(c => [c[1], c[0]]));
                const lineLen = turf.length(line, { units: 'meters' });
                const spacing = t.defaultPlantSpacing || 1.0;
                const expectedCount = Math.floor(lineLen / spacing);
                const gapCount = expectedCount - lineSeedlings.length;

                if (gapCount >= 3) {
                    infillRecommendations.push({
                        trenchId: t.id,
                        trenchName: t.name || 'Trench',
                        suggestedInfillCount: gapCount,
                        reason: `Trench has ${gapCount} missing positions along ${lineLen.toFixed(1)}m length based on ${spacing}m target spacing.`
                    });
                }
            } catch {
                // Ignore line length error
            }
        }
    });

    // Generate Agronomic Summary
    let insight = `Plantation audit completed across ${totalSeedlings.toLocaleString()} seedlings. Overall vigor index is ${healthPercentage}%.`;
    if (driedPercentage > 5) {
        insight += ` Caution: Dried seedling mortality rate is at ${driedPercentage}%, exceeding the 3% agronomic baseline. Immediate root-zone inspection and targeted infill planting recommended.`;
    } else if (suspiciousPercentage > 10) {
        insight += ` Advisory: Elevated suspicious symptom rate (${suspiciousPercentage}%). Recommend foliar tissue testing and fungal pathogen screening across affected rows.`;
    } else {
        insight += ` Plantation health is in optimal commercial state with minimal stress markers observed.`;
    }

    return {
        totalAreaHectares: totalAreaHa,
        totalTrenches: trenches.length,
        totalSeedlings,
        conditionBreakdown: { good, suspicious, dried },
        healthPercentage,
        suspiciousPercentage,
        driedPercentage,
        varietyBreakdown,
        densityPerHectare,
        infillRecommendations,
        aiAgronomicInsight: insight
    };
}

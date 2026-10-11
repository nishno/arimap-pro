
import { PlantationFeature, SeedlingPlantationFeature } from '../types';

export interface VarietyInfo {
    name: string;
    description?: string;
    color?: string;
    totalCount: number;
    parentIds: string[];
}

export const getVarietyRegistry = (features: PlantationFeature[]): Record<string, VarietyInfo> => {
    const registry: Record<string, VarietyInfo> = {};
    
    // Seedlings are the source of truth for variety counts
    const seedlings = features.filter(f => f.type === 'seedling') as SeedlingPlantationFeature[];
    
    seedlings.forEach(s => {
        const variety = s.cropVariety || 'Unknown';
        if (!registry[variety]) {
            registry[variety] = {
                name: variety,
                totalCount: 0,
                parentIds: []
            };
        }
        registry[variety].totalCount += 1;
        if (s.parentId && !registry[variety].parentIds.includes(s.parentId)) {
            registry[variety].parentIds.push(s.parentId);
        }
    });
    
    return registry;
};

export const getVarietyByFeatureId = (features: PlantationFeature[], featureId: string): string[] => {
    const seedlings = features.filter(f => f.type === 'seedling' && f.parentId === featureId) as SeedlingPlantationFeature[];
    return Array.from(new Set(seedlings.map(s => s.cropVariety).filter(Boolean))) as string[];
};

export const getSeedlingCountByFeatureId = (features: PlantationFeature[], featureId: string): number => {
    return features.filter(f => f.type === 'seedling' && f.parentId === featureId).length;
};

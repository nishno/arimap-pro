/**
 * gis.worker.ts
 * Dedicated Web Worker for off-thread GIS mathematics and seedling aggregation.
 */

import { analyzeEmptyLand, analyzePopulatedLand } from './gisWorkerLogic';

self.onmessage = (event: MessageEvent) => {
    const { id, type, payload } = event.data || {};

    try {
        let result: any = null;

        if (type === 'ANALYZE_EMPTY_LAND') {
            const { boundaryCoords, trenchSpacing, plantSpacing } = payload || {};
            result = analyzeEmptyLand(boundaryCoords, trenchSpacing, plantSpacing);
        } else if (type === 'ANALYZE_POPULATED_LAND') {
            const { features, targetSectorId } = payload || {};
            result = analyzePopulatedLand(features, targetSectorId);
        } else {
            throw new Error(`Unknown worker job type: ${type}`);
        }

        self.postMessage({ id, success: true, result });
    } catch (err: any) {
        self.postMessage({ id, success: false, error: err?.message || 'Worker task failed' });
    }
};

export {};

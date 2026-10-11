/**
 * AIToolEngine.ts
 * Headless, decoupled AI and GIS orchestrator.
 * Connects to AppEventEngine to answer requests on-demand without coupling React views.
 */

import { appEngine } from '../AppEventEngine';
import {
    SpatialAnalysisResult,
    DiseaseDiagnosisRequest,
    DiseaseDiagnosisResult,
    DocOcrRequest,
    DocOcrResult,
    BtAuditRequest,
    BtAuditResult,
    AgronomistDiagnosis,
    RootGodAiBenchmarkRequest,
    RootGodAiBenchmarkResult
} from '../types';
import { analyzeEmptyLand, analyzePopulatedLand } from '../workers/gisWorkerLogic';
import { agronomicLedger } from './AgronomicLedger';
import { godAIKnowledgeEngine } from './GodAIKnowledgeEngine';
import { analyzePlantDisease, executeGeminiCall } from '../../services/geminiService';

export class AIToolEngine {
    private static instance: AIToolEngine | null = null;
    private initialized = false;
    private worker: Worker | null = null;
    private workerJobCounter = 0;
    private workerPendingJobs: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

    private constructor() {
        this.setupWorker();
    }

    public static getInstance(): AIToolEngine {
        if (!AIToolEngine.instance) {
            AIToolEngine.instance = new AIToolEngine();
        }
        return AIToolEngine.instance;
    }

    /**
     * Initializes the worker and registers all event bus topic handlers.
     */
    public init(): void {
        if (this.initialized) return;
        this.initialized = true;

        console.info('[AIToolEngine] Bootstrapping standalone AI & Spatial Engine listeners...');

        // 1. Spatial Analysis Bridge
        appEngine.registerHandler('REQUEST_SPATIAL_ANALYSIS', async (payload: {
            orgId: string;
            features: any[];
            targetSectorId?: string;
            boundaryCoords?: [number, number][];
        }): Promise<SpatialAnalysisResult> => {
            const startTime = Date.now();
            const { orgId, features = [], targetSectorId, boundaryCoords } = payload;

            let targetFeature: any = null;
            if (targetSectorId && targetSectorId !== 'ALL') {
                targetFeature = features.find(f => f.id === targetSectorId);
            }

            const relevantFeatures = targetFeature
                ? features.filter(f => f.id === targetSectorId || f.parentId === targetSectorId)
                : features;

            const hasPopulatedFeatures = targetFeature
                ? ((targetFeature.bundledLines && targetFeature.bundledLines.length > 0) ||
                   (targetFeature.plantCount && targetFeature.plantCount > 0) ||
                   relevantFeatures.some(f => f.type === 'seedling' || f.type === 'trench' || f.type === 'line'))
                : features.some(f => 
                    f.type === 'seedling' || 
                    f.type === 'trench' || 
                    f.type === 'line' ||
                    (f.type === 'area' && (f.bundledLines?.length > 0 || f.plantCount > 0))
                );

            if (!hasPopulatedFeatures && (boundaryCoords?.length || targetFeature?.geometry || features.some(f => f.type === 'area' || f.type === 'boundary'))) {
                // Empty Land Calculation
                let coords = boundaryCoords;
                if (!coords || coords.length < 3) {
                    if (targetFeature && Array.isArray(targetFeature.geometry) && targetFeature.geometry.length >= 3) {
                        coords = targetFeature.geometry;
                    } else {
                        const boundFeature = features.find(f => f.type === 'boundary' || f.type === 'area');
                        if (boundFeature && Array.isArray(boundFeature.geometry)) {
                            coords = boundFeature.geometry;
                        }
                    }
                }

                const emptyResult = await this.runWorkerJob('ANALYZE_EMPTY_LAND', {
                    boundaryCoords: coords || [],
                    trenchSpacing: 3.0,
                    plantSpacing: 1.0
                }).catch(() => analyzeEmptyLand(coords || []));

                return {
                    timestamp: new Date().toISOString(),
                    organizationId: orgId,
                    sectorId: targetSectorId,
                    mode: 'EMPTY_LAND',
                    emptyLand: emptyResult,
                    processingTimeMs: Date.now() - startTime
                };
            } else {
                // Populated Plantation Calculation
                const populatedResult = await this.runWorkerJob('ANALYZE_POPULATED_LAND', {
                    features: targetFeature ? relevantFeatures : features,
                    targetSectorId
                }).catch(() => analyzePopulatedLand(targetFeature ? relevantFeatures : features, targetSectorId));

                return {
                    timestamp: new Date().toISOString(),
                    organizationId: orgId,
                    sectorId: targetSectorId,
                    mode: 'POPULATED_PLANTATION',
                    populatedLand: populatedResult,
                    processingTimeMs: Date.now() - startTime
                };
            }
        });

        // 2. Clinical Disease Diagnosis
        appEngine.registerHandler('REQUEST_DISEASE_DIAGNOSIS', async (req: DiseaseDiagnosisRequest): Promise<DiseaseDiagnosisResult> => {
            try {
                const lang = req.language || 'en';
                const analysis = await analyzePlantDisease(req.base64Image, req.mimeType, lang);

                return {
                    diseaseName: analysis.diseaseName || 'Undiagnosed Foliar Anomaly',
                    confidence: analysis.confidence || 0.85,
                    severity: (analysis.severity as any) || 'Moderate',
                    description: analysis.description || 'Analysis completed.',
                    pathogenType: analysis.pathogenType || 'Biological / Environmental',
                    treatmentSuggestions: analysis.treatmentSuggestions || ['Apply organic bio-fungicide', 'Prune damaged tissue'],
                    recommendedActiveIngredients: analysis.recommendedActiveIngredients || ['Bacillus thuringiensis', 'Copper sulfate'],
                    preventionMeasures: analysis.preventionMeasures || ['Maintain proper row spacing', 'Monitor canopy moisture']
                };
            } catch (err: any) {
                console.warn('[AIToolEngine] Disease diagnosis notice:', err);
                return {
                    diseaseName: 'Clinical Analysis Inconclusive',
                    confidence: 0.5,
                    severity: 'Moderate',
                    description: `Automated vision inspection failed: ${err?.message || 'Network error'}. Standard agronomist verification advised.`,
                    pathogenType: 'Unknown',
                    treatmentSuggestions: ['Inspect foliage manually with 10x field loupe', 'Check irrigation pressure and soil EC'],
                    recommendedActiveIngredients: ['Bacillus thuringiensis'],
                    preventionMeasures: ['Isolate affected sector for 48 hours']
                };
            }
        });

        // 3. Document OCR & Lab Analysis
        appEngine.registerHandler('REQUEST_DOC_OCR', async (req: DocOcrRequest): Promise<DocOcrResult> => {
            try {
                const response = await executeGeminiCall({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    inlineData: {
                                        data: req.fileData.includes('base64,') ? req.fileData.split('base64,')[1] : req.fileData,
                                        mimeType: req.mimeType || 'application/pdf'
                                    }
                                },
                                {
                                    text: `Analyze this agronomic lab test document (${req.docType}). Extract all parameters, values, reference units, and return a JSON object with: { "parameters": { [key]: { "value": any, "unit": string, "status": "Optimal"|"Deficient"|"Excessive"|"Warning" } }, "summary": string, "actionItems": string[] }`
                                }
                            ]
                        }
                    ]
                });

                const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                let parsed: any = {};
                try {
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                } catch {
                    parsed = {};
                }

                return {
                    rawText,
                    parameters: parsed.parameters || {},
                    executiveSummary: parsed.summary || rawText.slice(0, 300) || 'Laboratory document successfully parsed.',
                    actionItems: parsed.actionItems || ['Review agronomic test report parameters']
                };
            } catch (err: any) {
                console.warn('[AIToolEngine] Doc OCR notice:', err);
                return {
                    rawText: '',
                    parameters: {},
                    executiveSummary: `Lab document parser encountered an error: ${err?.message || 'Format unsupported'}`,
                    actionItems: ['Ensure document is high resolution (minimum 300 DPI) and clearly legible.']
                };
            }
        });

        // 4. Bt Audit Memory Pipeline
        appEngine.registerHandler('QUERY_BT_AUDIT', async (req: BtAuditRequest): Promise<BtAuditResult> => {
            return await agronomicLedger.queryTreatmentHistory(
                req.organizationId,
                req.activeIngredient || 'Bacillus thuringiensis',
                req.sectorId
            );
        });

        // 5. Commit Clinical Diagnosis to Ledger
        appEngine.registerHandler('RECORD_CLINICAL_DIAGNOSIS', async (diagnosis: Omit<AgronomistDiagnosis, 'id' | 'createdAt'>): Promise<{ success: boolean; id: string }> => {
            const id = await agronomicLedger.saveDiagnosis(diagnosis);
            return { success: true, id };
        });

        // 6. Root "God AI" Intelligence Framework (System Admin Only)
        appEngine.registerHandler('ROOT_GOD_AI_BENCHMARK', async (req: RootGodAiBenchmarkRequest): Promise<RootGodAiBenchmarkResult> => {
            return await agronomicLedger.getRootGodAiBenchmark(req.isSystemAdmin, req.cropVariety);
        });

        // 7. Works & Tasks AI Project Manager & Agronomy Diagnostics
        appEngine.registerHandler('REQUEST_WORK_TASK_ANALYSIS', async (req: any) => {
            return godAIKnowledgeEngine.analyzeWorksAndTasks(req);
        });

        // 8. Omniscient God AI Cross-Company Synthesis (Super Admin Only)
        appEngine.registerHandler('SYNTHESIZE_OMNISCIENT_GOD_AI', async (req: any) => {
            const clinicalRecords = await agronomicLedger.getAllDiagnoses();
            return godAIKnowledgeEngine.synthesizeOmniscientGodAIMatrix(
                Boolean(req.isSystemAdmin),
                req.organizations || [],
                req.allWorkAssignments || [],
                req.allHarvestEntries || [],
                req.allPlantationFeatures || [],
                clinicalRecords
            );
        });

        // 9. Evolutionary Deep Learning Cycle
        appEngine.registerHandler('TRIGGER_DEEP_LEARNING_CYCLE', async (req: any) => {
            const clinicalRecords = await agronomicLedger.getAllDiagnoses();
            return godAIKnowledgeEngine.runDeepLearningCycle({
                ...req,
                clinicalLedgerDiagnoses: clinicalRecords
            });
        });

        // 10. Query Evolutionary Learned Heuristics
        appEngine.registerHandler('GET_LEARNED_HEURISTICS', async () => {
            return godAIKnowledgeEngine.getHeuristics();
        });

        console.info('[AIToolEngine] All AI & GIS engine handlers operational.');
    }

    private setupWorker(): void {
        if (typeof window === 'undefined' || !window.Worker) return;

        try {
            this.worker = new Worker(new URL('../workers/gis.worker.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = (e: MessageEvent) => {
                const { id, success, result, error } = e.data || {};
                const pending = this.workerPendingJobs.get(id);
                if (pending) {
                    this.workerPendingJobs.delete(id);
                    if (success) {
                        pending.resolve(result);
                    } else {
                        pending.reject(new Error(error || 'Worker calculation failed'));
                    }
                }
            };
            this.worker.onerror = (err) => {
                console.warn('[AIToolEngine] Worker thread error, falling back to main-thread microtask:', err);
            };
        } catch (err) {
            console.warn('[AIToolEngine] Worker instantiation bypassed, will use microtask execution:', err);
            this.worker = null;
        }
    }

    private async runWorkerJob(type: string, payload: any): Promise<any> {
        if (!this.worker) {
            // Fallback directly
            if (type === 'ANALYZE_EMPTY_LAND') {
                return analyzeEmptyLand(payload.boundaryCoords, payload.trenchSpacing, payload.plantSpacing);
            } else if (type === 'ANALYZE_POPULATED_LAND') {
                return analyzePopulatedLand(payload.features, payload.targetSectorId);
            }
            throw new Error(`Unsupported fallback job: ${type}`);
        }

        const id = `job_${Date.now()}_${++this.workerJobCounter}`;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.workerPendingJobs.delete(id);
                reject(new Error(`Worker job ${type} timed out`));
            }, 15000);

            this.workerPendingJobs.set(id, {
                resolve: (val) => {
                    clearTimeout(timeout);
                    resolve(val);
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            this.worker!.postMessage({ id, type, payload });
        });
    }
}

export const aiToolEngine = AIToolEngine.getInstance();

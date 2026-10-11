import { PlantationFeature, SeedlingPlantationFeature, AreaPlantationFeature, LinePlantationFeature } from '../types';

export interface EmptyLandAnalysis {
    hasBoundary: boolean;
    areaSquareMeters: number;
    areaHectares: number;
    aspectRatio: number;
    recommendedAzimuthDegrees: number;
    dominantDirection: string;
    estimatedTrenchCount: number;
    recommendedTrenchSpacingMeters: number;
    recommendedPlantSpacingMeters: number;
    estimatedSeedlingCapacity: number;
    recommendations: string[];
}

export interface PopulatedLandAnalysis {
    totalAreaHectares: number;
    totalTrenches: number;
    totalSeedlings: number;
    conditionBreakdown: {
        good: number;
        suspicious: number;
        dried: number;
    };
    healthPercentage: number;
    suspiciousPercentage: number;
    driedPercentage: number;
    varietyBreakdown: Record<string, {
        total: number;
        good: number;
        suspicious: number;
        dried: number;
    }>;
    densityPerHectare: number;
    infillRecommendations: {
        trenchId?: string;
        trenchName?: string;
        suggestedInfillCount: number;
        coordinates?: [number, number][];
        reason: string;
    }[];
    aiAgronomicInsight: string;
}

export interface SpatialAnalysisResult {
    timestamp: string;
    organizationId: string;
    sectorId?: string;
    sectorName?: string;
    mode: 'EMPTY_LAND' | 'POPULATED_PLANTATION';
    emptyLand?: EmptyLandAnalysis;
    populatedLand?: PopulatedLandAnalysis;
    processingTimeMs: number;
}

export interface DiseaseDiagnosisRequest {
    organizationId: string;
    base64Image: string;
    mimeType: string;
    cropType?: string;
    sectorId?: string;
    targetTrenchId?: string;
    notes?: string;
    language?: 'ka' | 'en';
}

export interface DiseaseDiagnosisResult {
    diseaseName: string;
    confidence: number;
    severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical';
    description: string;
    pathogenType: string;
    treatmentSuggestions: string[];
    recommendedActiveIngredients: string[];
    preventionMeasures: string[];
}

export interface DocOcrRequest {
    organizationId: string;
    fileData: string;
    mimeType: string;
    docType: 'SOIL_LAB' | 'WATER_LAB' | 'TREATMENT_PROTOCOL';
    sectorId?: string;
}

export interface DocOcrResult {
    rawText: string;
    parameters: Record<string, {
        value: number | string;
        unit: string;
        status: 'Optimal' | 'Deficient' | 'Excessive' | 'Warning';
        referenceRange?: string;
    }>;
    executiveSummary: string;
    actionItems: string[];
}

export interface AgronomistDiagnosis {
    id: string;
    organizationId: string;
    sectorId?: string;
    sectorName?: string;
    variety?: string;
    diagnosisType: 'DISEASE_DETECTION' | 'SOIL_ANALYSIS' | 'WATER_LAB' | 'FIELD_INSPECTION';
    findings: {
        diseaseOrCondition: string;
        confidence?: number;
        severity?: string;
        description: string;
        activeIngredientsRecommended: string[];
        recommendedDosage?: string;
        treatmentPlan?: string;
    };
    author: {
        uid: string;
        displayName: string;
        role: string;
    };
    verifiedByAgronomist: boolean;
    verificationNotes?: string;
    imageUrl?: string;
    createdAt: string;
    resolvedAt?: string;
    followUpOutcome?: {
        checkedAt: string;
        recoveryRatePercent: number;
        notes: string;
    };
}

export interface BtAuditRequest {
    organizationId: string;
    activeIngredient?: string; // Default: 'Bacillus thuringiensis'
    sectorId?: string;
}

export interface BtAuditRecord {
    diagnosisId: string;
    date: string;
    authorName: string;
    authorRole: string;
    sectorId?: string;
    sectorName?: string;
    variety?: string;
    activeIngredient: string;
    dosageApplied?: string;
    reportedCondition: string;
    canopyRecoveryRate?: number; // e.g. measured 14-30 days post-treatment
    status: 'Resolved' | 'Under Monitoring' | 'Requires Re-application';
    verified: boolean;
}

export interface BtAuditResult {
    activeIngredient: string;
    organizationId: string;
    totalApplications: number;
    verifiedInterventions: number;
    records: BtAuditRecord[];
    averageRecoveryRatePercent: number;
    executiveSummary: string;
}

export interface RootGodAiBenchmarkRequest {
    isSystemAdmin: boolean;
    cropVariety?: string;
    activeIngredient?: string;
    limit?: number;
}

export interface RootGodAiBenchmarkResult {
    authorized: boolean;
    totalAnonymizedCases: number;
    cropVarietyAggregates: {
        variety: string;
        commonConditions: { condition: string; prevalence: number }[];
        topActiveIngredients: { ingredient: string; averageRecoveryPercent: number; sampleCount: number }[];
    }[];
    platformInsights: string[];
}

export type AIAssistantMode = 'standard' | 'expert' | 'god_ai';

export interface TaskTypeMetric {
    taskType: string;
    count: number;
    completedCount: number;
    pendingCount: number;
    inProgressCount: number;
    completionRate: number;
    totalPlannedHours: number;
    totalActualHours: number;
    totalLaborCost: number;
    averageEfficiencyRatio: number; // actual vs planned
    bottlenecksDetected: string[];
}

export interface WorkTaskAnalysisRequest {
    organizationId: string;
    isSystemAdmin?: boolean;
    workAssignments: any[];
    harvestEntries?: any[];
    plantationFeatures?: any[];
    employees?: any[];
    machinery?: any[];
    nutritionPlans?: any[];
    notes?: any[];
}

export interface WorkTaskAnalysisResult {
    timestamp: string;
    organizationId: string;
    totalTasks: number;
    overallCompletionRate: number;
    taskMetricsByType: Record<string, TaskTypeMetric>;
    criticalBottlenecks: {
        taskId: string;
        workName: string;
        taskType: string;
        severity: 'high' | 'medium' | 'low';
        issue: string;
        recommendedAction: string;
    }[];
    laborProductivityIndex: number; // 0 - 100
    machineryUtilizationSummary: {
        activeUnits: number;
        utilizationScore: number;
        insights: string[];
    };
    agronomicTaskSynergy: {
        sprayTimelinessScore: number;
        irrigationConsistencyScore: number;
        harvestPacingScore: number;
        keyObservations: string[];
    };
    executiveSummary: string;
    aiProjectManagerRecommendations: string[];
}

export interface LearnedHeuristic {
    id: string;
    domain: 'agronomy' | 'project_management' | 'harvest_synergy' | 'pathogen_control';
    title: string;
    description: string;
    confidenceScore: number; // 0 - 100
    evidenceSampleCount: number;
    discoveredAt: string;
    lastValidatedAt: string;
    applicability: {
        crops?: string[];
        taskTypes?: string[];
        conditions?: string[];
    };
    recommendationAction: string;
}

export interface OmniscientGodAIMatrix {
    lastSynthesisTimestamp: string;
    totalOrganizationsMonitored: number;
    totalTasksAnalyzed: number;
    totalHarvestKgAnalyzed: number;
    totalClinicalCasesAnalyzed: number;
    crossCompanyLaborBenchmarks: {
        taskType: string;
        medianHoursPerHa: number;
        topQuartileHoursPerHa: number;
        industryBenchmarkComparison: string;
    }[];
    crossCompanyCropYieldAverages: {
        cropOrVariety: string;
        averageKgPerHectare: number;
        topPerformingPractice: string;
    }[];
    universalPathogenTrends: {
        pathogen: string;
        highestRiskPeriod: string;
        mostEffectiveIngredient: string;
        avgRecoveryRate: number;
    }[];
    learnedHeuristics: LearnedHeuristic[];
    systemAdminMacroInsights: string[];
}

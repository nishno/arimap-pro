import { db, auth, collection, query, where, getDocs, getDoc, setDoc, doc, deleteDoc, writeBatch } from '../firebase';
/**
 * clinicalAnalysisService.ts
 * 
 * Persistent storage and management service for AI Agricultural Analysis,
 * Agronomist Clinical Conclusions, Treatment/Nutrition Prescriptions, 
 * Preventive Measures Monitoring, and Peer Agronomist Learning.
 */
import { agronomicLedger } from '../new_engine/ai/AgronomicLedger';
import { AgronomistDiagnosis } from '../new_engine/types';
export type ClinicalAnalysisType = 'disease' | 'document' | 'agro_image' | 'soil';
export interface AgronomistPrescriptionConclusion {
    notes: string;
    severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical';
    prescribedTreatment: string;
    activeIngredients: string[];
    recommendedDosage: string;
    prescribedNutrition: string;
    preventiveMeasures: string;
    targetSectorOrPlot?: string;
    inspectionCadence?: string;
    authorName: string;
    authorRole: string;
    authorId?: string;
    isVerified: boolean;
    updatedAt: string;
}
export interface PeerComparisonCase {
    agronomistName: string;
    organization: string;
    condition: string;
    prescribedTreatment: string;
    prescribedNutrition: string;
    preventiveMeasure: string;
    recoveryOutcomePercent: number;
    dosage: string;
    activeIngredient: string;
    date: string;
}
export interface PeerComparisonData {
    targetCondition: string;
    similarCasesFound: number;
    topActiveIngredients: {
        ingredient: string;
        usagePercentage: number;
        avgRecoveryRate: number;
    }[];
    consensusTreatmentProtocol: string;
    consensusNutritionStrategy: string;
    preventiveRecommendation: string;
    observedCases: PeerComparisonCase[];
}
export interface SavedAgroAnalysisRecord {
    id: string;
    ownerId?: string;
    sourceCategory?: 'AI-generated' | 'Agronomist-created' | 'Combined';
    updatedAt?: string;
    plan?: any;
    type: ClinicalAnalysisType;
    title: string;
    createdAt: string;
    organizationId: string;
    imageDataUrl?: string;
    fileNames?: string[];
    rawAiResult: any;
    agronomistConclusion?: AgronomistPrescriptionConclusion;
    aiLearnedInsights?: string;
    peerComparison?: PeerComparisonData;
}
class ClinicalAnalysisService {
    /**
     * Retrieves all saved analysis records.
     */
    public async getSavedAnalyses(orgId?: string): Promise<SavedAgroAnalysisRecord[]> {
        const uid = auth.currentUser?.uid;
        if (!uid)
            return [];
        const filters = orgId ? [where('organizationId', '==', orgId)] : [where('ownerId', '==', uid)];
        const result = await getDocs(query(collection(db, 'clinicalRecords'), ...filters));
        const rows = result.docs.map(row => ({ ...row.data(), id: row.id }) as any), ids = new Set(rows.map(row => row.id));
        // Preserve real historical company diagnoses and the signed-in user's own local records.
        // Seed examples and records without a matching author are never imported from local storage.
        let legacy: SavedAgroAnalysisRecord[] = [];
        try {
            const local = JSON.parse(localStorage.getItem('agri_saved_clinical_analyses') || '[]');
            if (Array.isArray(local))
                legacy = local.filter(row => row.agronomistConclusion?.authorId === uid && row.organizationId === (orgId || ''));
        }
        catch { }
        if (orgId) {
            const diagnoses = await agronomicLedger.getDiagnosesForOrg(orgId, 50);
            legacy.push(...diagnoses.map(diagnosis => this.mapDiagnosisToRecord(diagnosis)));
        }
        const migration = [...new Map(legacy.map(row=>[row.id,row])).values()].filter(row => !ids.has(row.id));
        for(let offset=0;offset<migration.length;offset+=200){
            const batch=writeBatch(db);
            for(const row of migration.slice(offset,offset+200)){
                const saved={...row,createdAt:row.createdAt||new Date().toISOString(),ownerId:uid,sourceCategory:row.sourceCategory||(row.agronomistConclusion?.isVerified?'Combined':'AI-generated'),migrationSource:'legacy',isDeleted:false};
                batch.set(doc(db,'clinicalRecords',row.id),JSON.parse(JSON.stringify(saved)));rows.push(saved);
            }
            await batch.commit();
        }
        return rows.filter(row => !row.isDeleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    public async saveAnalysisRecord(record: Omit<SavedAgroAnalysisRecord, 'id' | 'createdAt'> & {
        id?: string;
        createdAt?: string;
    }): Promise<SavedAgroAnalysisRecord> {
        const uid = auth.currentUser?.uid;
        if (!uid)
            throw Error('Sign in to save your archive.');
        const saved = { ...record, id: record.id || crypto.randomUUID(), ownerId: record.ownerId || uid, createdAt: record.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), sourceCategory: record.sourceCategory || 'AI-generated' };
        await setDoc(doc(db, 'clinicalRecords', saved.id), JSON.parse(JSON.stringify(saved)));
        return saved;
    }
    public async updateAgronomistConclusion(recordId: string, conclusion: AgronomistPrescriptionConclusion, orgId?: string): Promise<SavedAgroAnalysisRecord | null> {
        const snapshot = await getDoc(doc(db, 'clinicalRecords', recordId));
        if (!snapshot.exists())
            return null;
        const record = { ...snapshot.data(), id: snapshot.id } as SavedAgroAnalysisRecord;
        if (orgId && record.organizationId !== orgId)
            throw Error('Company scope mismatch');
        return this.saveAnalysisRecord({ ...record, sourceCategory: record.rawAiResult && Object.keys(record.rawAiResult).length ? 'Combined' : 'Agronomist-created', agronomistConclusion: { ...conclusion, isVerified: false, updatedAt: new Date().toISOString() } });
    }
    public async deleteAnalysisRecord(id: string): Promise<boolean> { const snapshot = await getDoc(doc(db, 'clinicalRecords', id)); if (!snapshot.exists())
        return true; await setDoc(doc(db, 'clinicalRecords', id), { ...snapshot.data(), isDeleted: true }, { merge: true }); return true; }
    /**
     * Compares decisions and prescriptions made by other agronomists across history.
     */
    public async generatePeerComparison(conditionName: string): Promise<PeerComparisonData> { return { targetCondition: conditionName, similarCasesFound: 0, topActiveIngredients: [], consensusTreatmentProtocol: 'No validated comparison data available.', consensusNutritionStrategy: '', preventiveRecommendation: '', observedCases: [] }; }
    private mapDiagnosisToRecord(diag: AgronomistDiagnosis): SavedAgroAnalysisRecord {
        return {
            id: diag.id,
            type: diag.diagnosisType === 'DISEASE_DETECTION' ? 'disease' : 'agro_image',
            title: diag.findings?.diseaseOrCondition || 'Agronomic Diagnosis',
            createdAt: diag.createdAt,
            organizationId: diag.organizationId,
            imageDataUrl: diag.imageUrl,
            rawAiResult: {
                diseaseName: diag.findings?.diseaseOrCondition,
                description: diag.findings?.description,
                treatmentSuggestions: diag.findings?.activeIngredientsRecommended || []
            },
            agronomistConclusion: {
                notes: diag.verificationNotes || '',
                severity: (diag.findings?.severity as any) || 'Moderate',
                prescribedTreatment: diag.findings?.treatmentPlan || '',
                activeIngredients: diag.findings?.activeIngredientsRecommended || [],
                recommendedDosage: diag.findings?.recommendedDosage || '',
                prescribedNutrition: '',
                preventiveMeasures: '',
                authorName: diag.author?.displayName || 'Agronomist',
                authorRole: diag.author?.role || 'Agronomist',
                isVerified: diag.verifiedByAgronomist,
                updatedAt: diag.createdAt
            }
        };
    }
}
export const clinicalAnalysisService = new ClinicalAnalysisService();
